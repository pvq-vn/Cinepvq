package com.pvq.cinepvq.features.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.player.VideoSourceRepository
import com.pvq.cinepvq.data.settings.SettingsRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class PlayerViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val videoSourceRepository: VideoSourceRepository = CinepvqApp.instance.videoSourceRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository,
    private val settingsRepository: SettingsRepository = CinepvqApp.instance.settingsRepository
) : ViewModel() {

    private val _movie = MutableStateFlow<MovieDetail?>(null)
    val movie: StateFlow<MovieDetail?> = _movie.asStateFlow()

    private val _currentEpisode = MutableStateFlow<EpisodeItem?>(null)
    val currentEpisode: StateFlow<EpisodeItem?> = _currentEpisode.asStateFlow()

    private val _availableSources = MutableStateFlow<List<StreamSource>>(emptyList())
    val availableSources: StateFlow<List<StreamSource>> = _availableSources.asStateFlow()

    private val _activeStream = MutableStateFlow<StreamSource?>(null)
    val activeStream: StateFlow<StreamSource?> = _activeStream.asStateFlow()

    private val _isLoadingStream = MutableStateFlow(true)
    val isLoadingStream: StateFlow<Boolean> = _isLoadingStream.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var playerInitJob: Job? = null

    var initialResumePositionMs: Long = 0L
        private set

    fun initializePlayer(
        slug: String,
        episodeSlug: String,
        serverName: String? = null,
        initialEmbedUrl: String? = null,
        resumePositionMs: Long? = null,
        preferredSourceKey: String? = null
    ) {
        playerInitJob?.cancel()
        playerInitJob = viewModelScope.launch {
            userSyncRepository.flushWatchProgress(slug)
            _isLoadingStream.value = true
            _errorMessage.value = null
            _activeStream.value = null

            // 1. Fetch movie detail
            val movieRes = movieRepository.getMovieDetail(slug)
            val detail = movieRes.getOrNull()
            _movie.value = detail

            // 2. Select target server matching serverName, or fallback to first server
            val targetServer = if (!serverName.isNullOrBlank()) {
                detail?.episodes?.find { it.serverName.equals(serverName, ignoreCase = true) }
                    ?: detail?.episodes?.find {
                        val isTm = serverName.contains("Thuyết minh", ignoreCase = true) || serverName.contains("TM", ignoreCase = true)
                        if (isTm) it.serverName.contains("Thuyết minh", ignoreCase = true) || it.serverName.contains("TM", ignoreCase = true)
                        else it.serverName.contains("Vietsub", ignoreCase = true)
                    }
                    ?: detail?.episodes?.firstOrNull()
            } else {
                detail?.episodes?.firstOrNull()
            }

            // 3. Find matching episode in targetServer (match slug, then digit number, fallback to first)
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

            // 4. Resume position logic:
            // Case A: If explicit resumePositionMs passed (e.g. user toggled Vietsub -> Thuyết Minh at 18:25), use it!
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
                    // Fallback to movie watch history if episode matches
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

            // 5. Extract episode number for resolver if available
            val epNum = targetEp.name.filter { it.isDigit() }.toIntOrNull() ?: 1

            // 6. Resolve multi-source stream with the actual target server & episode URLs
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

            if (preferredMatch == null && !effectivePreferredKey.isNullOrBlank() && effectivePreferredKey != "auto") {
                val availableSummary = sources.joinToString(", ") { "${it.sourceId}(${it.name})" }
                android.util.Log.w("SOURCE_RESOLVE_FAILED", """
                    SOURCE_RESOLVE_FAILED
                    requestedSource=$effectivePreferredKey
                    availableSources=[$availableSummary]
                    reason=No available source matching key '$effectivePreferredKey'
                """.trimIndent())
            }

            val chosen = preferredMatch ?: sources.firstOrNull { it.isAvailable }

            if (chosen != null) {
                android.util.Log.d("PLAYER_INIT", """
                    PLAYER_INIT
                    slug=$slug
                    episode=${targetEp.name}
                    requestedDefaultSource=$effectivePreferredKey
                    matchedSource=${chosen.sourceId}
                    sourceId=${chosen.sourceId}
                    sourceName=${chosen.name}
                    streamType=${chosen.type}
                    streamUrl=${chosen.url}
                """.trimIndent())
                _activeStream.value = chosen
            } else {
                android.util.Log.e("SOURCE_RESOLVE_FAILED", """
                    SOURCE_RESOLVE_FAILED
                    requestedSource=$effectivePreferredKey
                    availableSources=[]
                    reason=No available sources for episode
                """.trimIndent())
                _errorMessage.value = "Không tìm thấy nguồn phát khả dụng cho tập này"
            }

            _isLoadingStream.value = false
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
        playerInitJob?.cancel()
        _activeStream.value = source
    }

    fun recordProgress(forEpisodeSlug: String, currentMs: Long, durationMs: Long) {
        val m = _movie.value ?: return
        val ep = _currentEpisode.value ?: return
        // Guard against race condition where stale playback loop records to new episode
        if (ep.slug != forEpisodeSlug) return

        val currentSec = currentMs / 1000L
        val durationSec = durationMs / 1000L

        if (currentSec <= 0) return

        viewModelScope.launch {
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

    override fun onCleared() {
        super.onCleared()
        playerInitJob?.cancel()
        val currentSlug = _movie.value?.slug
        viewModelScope.launch {
            userSyncRepository.flushWatchProgress(currentSlug)
        }
    }
}
