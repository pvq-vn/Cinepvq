package com.pvq.cinepvq.data.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.settings.SettingsRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.player.VideoResolution
import com.pvq.cinepvq.features.player.VideoTrackInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Single source of truth for all playback operations and presentation states in Cinepvq.
 *
 * Manages:
 * - A single, persistent ExoPlayer instance that survives navigation and presentation transitions.
 * - Presentation state transitions: HIDDEN, FULL_PORTRAIT, FULL_LANDSCAPE, MINI_IN_APP, SYSTEM_PIP.
 * - Previous presentation state memory to restore exact orientation (portrait -> portrait, landscape -> landscape).
 * - System PiP eligibility determination.
 * - Playback continuity (no stream reloading, position resets, or player re-creation).
 */
@OptIn(UnstableApi::class)
class PlaybackManager(
    private val context: Context,
    private val movieRepository: MovieRepository,
    private val videoSourceRepository: VideoSourceRepository,
    private val userSyncRepository: UserSyncRepository,
    private val settingsRepository: SettingsRepository
) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // ── Presentation States ──────────────────────────────────────────────────
    private val _presentationState = MutableStateFlow(PlayerPresentationState.HIDDEN)
    val presentationState: StateFlow<PlayerPresentationState> = _presentationState.asStateFlow()

    var previousPresentationState: PlayerPresentationState = PlayerPresentationState.FULL_PORTRAIT
        private set

    var pipPreviousPresentationState: PlayerPresentationState = PlayerPresentationState.FULL_PORTRAIT
        private set

    // ── Playback Metadata ────────────────────────────────────────────────────
    private val _movie = MutableStateFlow<MovieDetail?>(null)
    val movie: StateFlow<MovieDetail?> = _movie.asStateFlow()

    private val _currentEpisode = MutableStateFlow<EpisodeItem?>(null)
    val currentEpisode: StateFlow<EpisodeItem?> = _currentEpisode.asStateFlow()

    private val _availableSources = MutableStateFlow<List<StreamSource>>(emptyList())
    val availableSources: StateFlow<List<StreamSource>> = _availableSources.asStateFlow()

    private val _activeStream = MutableStateFlow<StreamSource?>(null)
    val activeStream: StateFlow<StreamSource?> = _activeStream.asStateFlow()

    private val _isLoadingStream = MutableStateFlow(false)
    val isLoadingStream: StateFlow<Boolean> = _isLoadingStream.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // ── Playback Controls & Progress States ──────────────────────────────────
    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPositionMs = MutableStateFlow(0L)
    val currentPositionMs: StateFlow<Long> = _currentPositionMs.asStateFlow()

    private val _durationMs = MutableStateFlow(0L)
    val durationMs: StateFlow<Long> = _durationMs.asStateFlow()

    private val _playbackSpeed = MutableStateFlow(1.0f)
    val playbackSpeed: StateFlow<Float> = _playbackSpeed.asStateFlow()

    private val _resolution = MutableStateFlow(VideoResolution.AUTO)
    val resolution: StateFlow<VideoResolution> = _resolution.asStateFlow()

    private val _availableVideoTracks = MutableStateFlow<List<VideoTrackInfo>>(emptyList())
    val availableVideoTracks: StateFlow<List<VideoTrackInfo>> = _availableVideoTracks.asStateFlow()

    private val _servers = MutableStateFlow<List<EpisodeServer>>(emptyList())
    val servers: StateFlow<List<EpisodeServer>> = _servers.asStateFlow()

    private val _selectedServerIndex = MutableStateFlow(0)
    val selectedServerIndex: StateFlow<Int> = _selectedServerIndex.asStateFlow()

    var currentSlug: String = ""
        private set
    var currentEpisodeSlug: String = ""
        private set
    var currentServerName: String? = null
        private set
    var currentEmbedUrl: String? = null
        private set

    var userPausedManually = false
        private set

    private var initialResumePositionMs: Long = 0L
    private var pendingSeekPositionMs: Long? = null
    private var pendingPlayWhenReady: Boolean? = null
    private var playerInitJob: Job? = null
    private var progressTrackingJob: Job? = null

    // ── Single Persistent ExoPlayer Instance ─────────────────────────────────
    val trackSelector = DefaultTrackSelector(context).apply {
        parameters = buildUponParameters()
            .setForceHighestSupportedBitrate(false)
            .setExceedVideoConstraintsIfNecessary(true)
            .build()
    }

    val exoPlayer: ExoPlayer = ExoPlayer.Builder(context)
        .setTrackSelector(trackSelector)
        .build().apply {
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                .setUsage(C.USAGE_MEDIA)
                .build()
            setAudioAttributes(audioAttributes, true)
            playWhenReady = false

            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(playing: Boolean) {
                    _isPlaying.value = playing
                }

                override fun onTracksChanged(tracks: Tracks) {
                    val videoTracks = mutableListOf<VideoTrackInfo>()
                    for (groupIndex in 0 until tracks.groups.size) {
                        val group = tracks.groups[groupIndex]
                        if (group.type == C.TRACK_TYPE_VIDEO) {
                            val mediaTrackGroup = group.mediaTrackGroup
                            for (trackIndex in 0 until mediaTrackGroup.length) {
                                val format = mediaTrackGroup.getFormat(trackIndex)
                                val isSelected = group.isTrackSelected(trackIndex)
                                val res = when {
                                    format.height >= 1080 -> VideoResolution.FHD
                                    format.height >= 720 -> VideoResolution.HD
                                    format.height >= 480 -> VideoResolution.SD
                                    format.height in 1..479 -> VideoResolution.LOW
                                    else -> VideoResolution.AUTO
                                }
                                val label = when (res) {
                                    VideoResolution.FHD -> "1080p (FHD)"
                                    VideoResolution.HD -> "720p (HD)"
                                    VideoResolution.SD -> "480p (SD)"
                                    VideoResolution.LOW -> "360p (Tiết kiệm)"
                                    VideoResolution.AUTO -> "Tự động"
                                }
                                videoTracks.add(
                                    VideoTrackInfo(
                                        width = format.width,
                                        height = format.height,
                                        bitrate = format.bitrate,
                                        isSelected = isSelected,
                                        label = label,
                                        resolution = res,
                                        groupIndex = groupIndex,
                                        trackIndex = trackIndex
                                    )
                                )
                            }
                        }
                    }
                    _availableVideoTracks.value = videoTracks
                    if (videoTracks.size <= 1) {
                        applyResolutionToPlayer(VideoResolution.AUTO, videoTracks)
                    } else if (_resolution.value != VideoResolution.AUTO) {
                        applyResolutionToPlayer(_resolution.value, videoTracks)
                    }
                }

                override fun onPositionDiscontinuity(
                    oldPosition: Player.PositionInfo,
                    newPosition: Player.PositionInfo,
                    reason: Int
                ) {
                    _currentPositionMs.value = currentPosition.coerceAtLeast(0L)
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        _durationMs.value = duration.coerceAtLeast(0L)
                        _currentPositionMs.value = currentPosition.coerceAtLeast(0L)
                    } else if (playbackState == Player.STATE_ENDED) {
                        if (_activeStream.value?.type == StreamType.HLS_DIRECT && duration > 0) {
                            recordProgress(currentEpisodeSlug, duration, duration)
                        }
                        val nextEp = getNextEpisode()
                        if (nextEp != null) {
                            playMovie(
                                slug = currentSlug,
                                episodeSlug = nextEp.slug,
                                serverName = currentServerName,
                                initialEmbedUrl = nextEp.embed,
                                resumePositionMs = 0L
                            )
                        }
                    }
                }
            })
        }

    init {
        startProgressTracking()
    }

    private fun startProgressTracking() {
        progressTrackingJob?.cancel()
        progressTrackingJob = scope.launch {
            while (isActive) {
                if (_activeStream.value?.type == StreamType.HLS_DIRECT) {
                    _currentPositionMs.value = exoPlayer.currentPosition.coerceAtLeast(0L)
                    if (exoPlayer.duration > 0) {
                        _durationMs.value = exoPlayer.duration.coerceAtLeast(0L)
                    }
                    if (exoPlayer.isPlaying && currentEpisodeSlug.isNotEmpty()) {
                        recordProgress(currentEpisodeSlug, _currentPositionMs.value, _durationMs.value)
                    }
                }
                delay(500)
            }
        }
    }

    val hasActivePlayback: Boolean
        get() = _activeStream.value != null && _presentationState.value != PlayerPresentationState.HIDDEN

    // ── Playback Initialization & Control ────────────────────────────────────
    fun playMovie(
        slug: String,
        episodeSlug: String,
        serverName: String? = null,
        initialEmbedUrl: String? = null,
        resumePositionMs: Long? = null,
        preferredSourceKey: String? = null,
        initialFullscreen: Boolean = false
    ) {
        val isSameMovie = (slug == currentSlug && currentSlug.isNotEmpty())
        val isSameEpisode = (episodeSlug == currentEpisodeSlug && currentEpisodeSlug.isNotEmpty())
        val isSameServer = (serverName == null || serverName == currentServerName)
        val hasValidStream = (_activeStream.value != null)

        currentSlug = slug
        currentEpisodeSlug = episodeSlug
        currentServerName = serverName
        currentEmbedUrl = initialEmbedUrl

        // Update presentation state if hidden or mini
        val targetPresentation = if (initialFullscreen || previousPresentationState == PlayerPresentationState.FULL_LANDSCAPE) {
            PlayerPresentationState.FULL_LANDSCAPE
        } else {
            PlayerPresentationState.FULL_PORTRAIT
        }

        if (_presentationState.value == PlayerPresentationState.HIDDEN ||
            _presentationState.value == PlayerPresentationState.MINI_IN_APP
        ) {
            _presentationState.value = targetPresentation
            previousPresentationState = targetPresentation
        }

        // If already playing this exact stream, do NOT reload stream, prepare, or reset position!
        if (isSameMovie && isSameEpisode && isSameServer && hasValidStream) {
            return
        }

        // Record progress for previous episode before switching
        if (_activeStream.value?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0 && exoPlayer.currentPosition > 0) {
            recordProgress(currentEpisodeSlug, exoPlayer.currentPosition, exoPlayer.duration)
        }

        playerInitJob?.cancel()
        playerInitJob = scope.launch {
            userSyncRepository.flushWatchProgress(slug)
            _isLoadingStream.value = true
            _errorMessage.value = null
            _activeStream.value = null

            // 1. Fetch movie detail
            val movieRes = movieRepository.getMovieDetail(slug)
            val detail = movieRes.getOrNull()
            _movie.value = detail

            val detailServers = detail?.episodes ?: emptyList()
            _servers.value = detailServers

            // 2. Select target server
            val targetServer = if (!serverName.isNullOrBlank()) {
                detailServers.find { it.serverName.equals(serverName, ignoreCase = true) }
                    ?: detailServers.find {
                        val isTm = serverName.contains("Thuyết minh", ignoreCase = true) || serverName.contains("TM", ignoreCase = true)
                        if (isTm) it.serverName.contains("Thuyết minh", ignoreCase = true) || it.serverName.contains("TM", ignoreCase = true)
                        else it.serverName.contains("Vietsub", ignoreCase = true)
                    }
                    ?: detailServers.firstOrNull()
            } else {
                detailServers.firstOrNull()
            }

            val serverIndex = detailServers.indexOf(targetServer).coerceAtLeast(0)
            _selectedServerIndex.value = serverIndex
            currentServerName = targetServer?.serverName ?: serverName

            // 3. Find matching episode
            val serverEpisodes = targetServer?.items ?: emptyList()
            var targetEp = serverEpisodes.find { it.slug == episodeSlug }
            if (targetEp == null) {
                val sourceEp = detail?.episodes?.flatMap { it.items }?.find { it.slug == episodeSlug }
                val targetName = sourceEp?.name ?: episodeSlug
                val targetDigits = targetName.filter { it.isDigit() }
                targetEp = if (targetDigits.isNotEmpty()) {
                    serverEpisodes.find { it.name.filter { c -> c.isDigit() } == targetDigits }
                } else null
            }
            if (targetEp == null) {
                targetEp = serverEpisodes.firstOrNull() ?: EpisodeItem(
                    name = episodeSlug,
                    slug = episodeSlug,
                    embed = initialEmbedUrl ?: ""
                )
            }
            _currentEpisode.value = targetEp

            // 4. Determine resume position
            if (resumePositionMs != null && resumePositionMs > 0L) {
                initialResumePositionMs = resumePositionMs
            } else {
                initialResumePositionMs = 0L
                val targetSlug = targetEp.slug
                val epProgressSec = userSyncRepository.getEpisodeProgress(slug, targetSlug)
                val epDurationSec = userSyncRepository.getEpisodeDuration(slug, targetSlug)

                if (epProgressSec > 0) {
                    val isNearEnd = epDurationSec > 0 && (epDurationSec - epProgressSec < 15 || (epProgressSec.toFloat() / epDurationSec) >= 0.95f)
                    if (!isNearEnd) {
                        initialResumePositionMs = epProgressSec * 1000L
                    }
                } else {
                    val history = userSyncRepository.getHistoryDirect(slug)
                    if (history != null && history.episodeSlug == targetSlug && history.currentTime > 0) {
                        val dur = history.duration
                        val isNearEnd = dur > 0 && (dur - history.currentTime < 15 || (history.currentTime.toFloat() / dur) >= 0.95f)
                        if (!isNearEnd) {
                            initialResumePositionMs = history.currentTime * 1000L
                        }
                    }
                }
            }

            // 5. Resolve streams
            val epNum = targetEp.name.filter { it.isDigit() }.toIntOrNull() ?: 1
            val effectiveM3u8 = targetEp.m3u8Url?.ifBlank { null }
                ?: if (targetEp.embed.contains(".m3u8")) targetEp.embed else null
            val effectiveEmbed = targetEp.embed.ifBlank { initialEmbedUrl }

            val sources = videoSourceRepository.resolveStreams(
                slug = slug,
                episode = epNum,
                episodeSlug = targetEp.slug,
                serverName = targetServer?.serverName ?: serverName,
                fallbackM3u8 = effectiveM3u8,
                fallbackEmbed = effectiveEmbed
            )

            _availableSources.value = sources

            val effectivePreferredKey = if (!preferredSourceKey.isNullOrBlank() && preferredSourceKey != "auto") {
                preferredSourceKey
            } else {
                try {
                    settingsRepository.playerSettings.first().defaultSource
                } catch (_: Exception) {
                    "auto"
                }
            }

            val preferredMatch = if (!effectivePreferredKey.isNullOrBlank() && effectivePreferredKey != "auto") {
                sources.firstOrNull { it.isAvailable && matchSource(it, effectivePreferredKey) }
            } else null

            val chosen = preferredMatch ?: sources.firstOrNull { it.isAvailable }

            if (chosen != null) {
                _activeStream.value = chosen
                preparePlayerWithStream(chosen, initialResumePositionMs)
            } else {
                _errorMessage.value = "Không tìm thấy nguồn phát khả dụng cho tập này"
            }

            _isLoadingStream.value = false
        }
    }

    private fun preparePlayerWithStream(stream: StreamSource, targetPosMs: Long) {
        if (stream.type == StreamType.HLS_DIRECT) {
            val mediaItem = MediaItem.Builder()
                .setUri(stream.url)
                .apply {
                    if (stream.url.contains(".m3u8") || stream.url.contains("/m3u8")) {
                        setMimeType(MimeTypes.APPLICATION_M3U8)
                    }
                }
                .build()

            val shouldPlay = pendingPlayWhenReady ?: (!userPausedManually)
            pendingPlayWhenReady = null

            exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                .buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
                .build()

            exoPlayer.setMediaItem(mediaItem, targetPosMs)
            exoPlayer.playWhenReady = shouldPlay
            exoPlayer.prepare()
        } else {
            // Embed mode: stop ExoPlayer to free up hardware codecs
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
        }
    }

    private fun matchSource(source: StreamSource, preferredKey: String): Boolean {
        if (!source.isAvailable) return false
        val key = preferredKey.lowercase().trim()
        if (key == "auto" || key.isEmpty()) return true
        val id = source.sourceId.lowercase()
        val name = source.name.lowercase()
        val displayName = source.displayName.lowercase()

        return when (key) {
            "k20" -> id.contains("k20") || name.contains("k20") || displayName.contains("k20")
            "kkphim" -> id.contains("kkphim") || name.contains("kkphim") || displayName.contains("kkphim")
            "vsmov" -> id.contains("vsmov") || name.contains("vsmov") || displayName.contains("vsmov")
            "nguonc" -> id.contains("nguonc") || name.contains("nguonc") || id.contains("embed_fallback") || name.contains("streamc") || displayName.contains("nguonc")
            else -> id.contains(key) || name.contains(key) || displayName.contains(key)
        }
    }

    fun switchStream(source: StreamSource) {
        if (source.sourceId == _activeStream.value?.sourceId) return
        val capturedPos = if (_activeStream.value?.type == StreamType.HLS_DIRECT && exoPlayer.currentPosition > 0L) {
            exoPlayer.currentPosition
        } else {
            _currentPositionMs.value
        }
        val wasPlaying = if (_activeStream.value?.type == StreamType.HLS_DIRECT) {
            if (exoPlayer.playbackState == Player.STATE_READY) exoPlayer.isPlaying else !userPausedManually
        } else {
            !userPausedManually
        }

        if (_activeStream.value?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0 && capturedPos > 0) {
            recordProgress(currentEpisodeSlug, capturedPos, exoPlayer.duration)
        }

        pendingPlayWhenReady = wasPlaying
        _activeStream.value = source
        preparePlayerWithStream(source, capturedPos)
    }

    fun selectServer(index: Int) {
        val serverList = _servers.value
        val newServer = serverList.getOrNull(index) ?: return
        _selectedServerIndex.value = index
        currentServerName = newServer.serverName

        val currentEp = _currentEpisode.value
        val targetDigits = currentEp?.name?.filter { it.isDigit() } ?: ""
        val matchingEp = newServer.items.find { it.slug == currentEpisodeSlug }
            ?: if (targetDigits.isNotEmpty()) newServer.items.find { it.name.filter { c -> c.isDigit() } == targetDigits } else null
            ?: newServer.items.firstOrNull()

        if (matchingEp != null) {
            playMovie(
                slug = currentSlug,
                episodeSlug = matchingEp.slug,
                serverName = newServer.serverName,
                initialEmbedUrl = matchingEp.embed,
                resumePositionMs = if (exoPlayer.currentPosition > 0L) exoPlayer.currentPosition else _currentPositionMs.value
            )
        }
    }

    // ── Presentation Transitions ─────────────────────────────────────────────
    fun minimize() {
        if (_presentationState.value == PlayerPresentationState.FULL_PORTRAIT ||
            _presentationState.value == PlayerPresentationState.FULL_LANDSCAPE
        ) {
            previousPresentationState = _presentationState.value
        }
        _presentationState.value = PlayerPresentationState.MINI_IN_APP
    }

    fun expand(): PlayerPresentationState {
        val target = if (previousPresentationState == PlayerPresentationState.FULL_LANDSCAPE) {
            PlayerPresentationState.FULL_LANDSCAPE
        } else {
            PlayerPresentationState.FULL_PORTRAIT
        }
        _presentationState.value = target
        return target
    }

    fun setPresentation(state: PlayerPresentationState) {
        if (state == PlayerPresentationState.FULL_PORTRAIT || state == PlayerPresentationState.FULL_LANDSCAPE) {
            previousPresentationState = state
        }
        _presentationState.value = state
    }

    fun closePlayback() {
        if (_activeStream.value?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0 && exoPlayer.currentPosition > 0) {
            recordProgress(currentEpisodeSlug, exoPlayer.currentPosition, exoPlayer.duration)
        }
        playerInitJob?.cancel()
        userPausedManually = true
        exoPlayer.pause()
        exoPlayer.stop()
        exoPlayer.clearMediaItems()
        _activeStream.value = null
        _currentEpisode.value = null
        _movie.value = null
        currentSlug = ""
        currentEpisodeSlug = ""
        currentServerName = null
        currentEmbedUrl = null
        _currentPositionMs.value = 0L
        _durationMs.value = 0L
        _presentationState.value = PlayerPresentationState.HIDDEN
        previousPresentationState = PlayerPresentationState.FULL_PORTRAIT
        pipPreviousPresentationState = PlayerPresentationState.FULL_PORTRAIT
    }

    fun pause() {
        exoPlayer.pause()
        userPausedManually = true
    }

    fun play() {
        exoPlayer.play()
        userPausedManually = false
    }

    fun togglePlayPause() {
        if (exoPlayer.isPlaying) {
            pause()
        } else {
            play()
        }
    }

    fun seekTo(posMs: Long) {
        _currentPositionMs.value = posMs
        exoPlayer.seekTo(posMs)
    }

    fun setPlaybackSpeed(speed: Float) {
        _playbackSpeed.value = speed
        exoPlayer.setPlaybackSpeed(speed)
    }

    fun setResolution(res: VideoResolution) {
        _resolution.value = res
        applyResolutionToPlayer(res, _availableVideoTracks.value)
    }

    private fun applyResolutionToPlayer(res: VideoResolution, tracks: List<VideoTrackInfo>) {
        if (res == VideoResolution.AUTO || tracks.size <= 1) {
            exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                .buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
                .setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
                .build()
        } else {
            val matchingTrack = tracks.find { it.resolution == res }
            if (matchingTrack != null) {
                val group = exoPlayer.currentTracks.groups.getOrNull(matchingTrack.groupIndex)?.mediaTrackGroup
                if (group != null) {
                    exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                        .buildUpon()
                        .setOverrideForType(
                            TrackSelectionOverride(group, listOf(matchingTrack.trackIndex))
                        )
                        .build()
                }
            } else {
                val maxH = res.maxLines
                val maxW = if (maxH == Int.MAX_VALUE) Int.MAX_VALUE else (maxH * 16) / 9
                exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                    .buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
                    .setMaxVideoSize(maxW, maxH)
                    .build()
            }
        }
    }

    fun getNextEpisode(): EpisodeItem? {
        val detail = _movie.value ?: return null
        val currentEp = _currentEpisode.value ?: return null
        val server = detail.episodes.firstOrNull { it.items.any { item -> item.slug == currentEp.slug } }
            ?: detail.episodes.firstOrNull() ?: return null
        val currentIndex = server.items.indexOfFirst { it.slug == currentEp.slug }
        if (currentIndex != -1 && currentIndex < server.items.size - 1) {
            return server.items[currentIndex + 1]
        }
        return null
    }

    fun getPreviousEpisode(): EpisodeItem? {
        val detail = _movie.value ?: return null
        val currentEp = _currentEpisode.value ?: return null
        val server = detail.episodes.firstOrNull { it.items.any { item -> item.slug == currentEp.slug } }
            ?: detail.episodes.firstOrNull() ?: return null
        val currentIndex = server.items.indexOfFirst { it.slug == currentEp.slug }
        if (currentIndex > 0) {
            return server.items[currentIndex - 1]
        }
        return null
    }

    fun playNext() {
        val nextEp = getNextEpisode() ?: return
        playMovie(
            slug = currentSlug,
            episodeSlug = nextEp.slug,
            serverName = currentServerName,
            initialEmbedUrl = nextEp.embed,
            resumePositionMs = 0L
        )
    }

    fun playPrevious() {
        val prevEp = getPreviousEpisode() ?: return
        playMovie(
            slug = currentSlug,
            episodeSlug = prevEp.slug,
            serverName = currentServerName,
            initialEmbedUrl = prevEp.embed,
            resumePositionMs = 0L
        )
    }

    fun recordProgress(forEpisodeSlug: String, currentMs: Long, durationMs: Long) {
        val m = _movie.value ?: return
        val ep = _currentEpisode.value ?: return
        if (ep.slug != forEpisodeSlug) return

        val currentSec = currentMs / 1000L
        val durationSec = durationMs / 1000L
        if (currentSec <= 0) return

        scope.launch {
            userSyncRepository.recordWatchProgress(
                movieSlug = m.slug,
                movieName = m.name,
                originalName = m.originalName,
                thumbUrl = m.thumbUrl,
                episodeSlug = ep.slug,
                episodeName = ep.displayName,
                currentTime = currentSec,
                duration = durationSec
            )
        }
    }

    // ── System PiP Support ───────────────────────────────────────────────────
    fun shouldEnterPip(): Boolean {
        val isCurrentlyPlaying = exoPlayer.isPlaying
        val isEligiblePresentation = _presentationState.value in listOf(
            PlayerPresentationState.FULL_PORTRAIT,
            PlayerPresentationState.FULL_LANDSCAPE,
            PlayerPresentationState.MINI_IN_APP
        )
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
        val isScreenOn = powerManager?.isInteractive ?: true
        return hasActivePlayback && isCurrentlyPlaying && isEligiblePresentation && isScreenOn
    }

    fun enterPip() {
        if (_presentationState.value != PlayerPresentationState.SYSTEM_PIP) {
            pipPreviousPresentationState = _presentationState.value
            _presentationState.value = PlayerPresentationState.SYSTEM_PIP
        }
    }

    fun restoreFromPip(): PlayerPresentationState {
        val target = if (pipPreviousPresentationState == PlayerPresentationState.SYSTEM_PIP) {
            previousPresentationState
        } else {
            pipPreviousPresentationState
        }
        _presentationState.value = target
        return target
    }

    fun onPipModeChanged(isInPip: Boolean) {
        if (isInPip) {
            enterPip()
        } else {
            restoreFromPip()
        }
    }
}
