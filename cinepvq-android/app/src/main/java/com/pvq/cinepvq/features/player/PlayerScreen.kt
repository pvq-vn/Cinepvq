package com.pvq.cinepvq.features.player

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.player.PlaybackManager
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
import androidx.media3.ui.PlayerView
import com.pvq.cinepvq.core.designsystem.components.ErrorView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.player.embed.EmbedPlayerView
import com.pvq.cinepvq.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.abs

private enum class GestureMode {
    SEEK,
    VERTICAL
}

private enum class SeekSide {
    LEFT,
    RIGHT
}

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    slug: String,
    episodeSlug: String,
    serverName: String? = null,
    embedUrl: String? = null,
    isFullscreen: Boolean = false,
    onFullscreenToggle: (Boolean) -> Unit = {},
    onBackClick: () -> Unit = {},
    onMinimize: () -> Unit = onBackClick,
    onSwitchEpisode: (String, String) -> Unit = { _, _ -> },
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
    isWatchLater: Boolean = false,
    onToggleWatchLater: () -> Unit = {},
    onOpenComments: () -> Unit = {},
    onShareClick: () -> Unit = {},
    servers: List<EpisodeServer> = emptyList(),
    selectedServerIndex: Int = 0,
    onOpenAudioLanguage: () -> Unit = {},
    showSyncWarning: Boolean = false,
    onDismissSyncWarning: () -> Unit = {},
    allEpisodes: List<EpisodeItem> = emptyList(),
    viewModel: PlayerViewModel = viewModel(),
    qaControls: Boolean = false,
    qaBrightness: Float = -1f,
    qaVolume: Float = -1f,
    qaSeek: Long = -1L
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val viewConfig = LocalViewConfiguration.current
    val density = LocalDensity.current
    val dragThresholdPx = remember(density) { with(density) { 120.dp.toPx() } }
    var dragOffsetY by remember { mutableFloatStateOf(0f) }

    // Audio manager for volume control
    val audioManager = remember(context) { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    val maxVolume = remember(audioManager) { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1) }

    val playbackManager = remember { CinepvqApp.instance.playbackManager }
    val exoPlayer = playbackManager.exoPlayer
    val trackSelector = playbackManager.trackSelector

    val isPlaying by playbackManager.isPlaying.collectAsStateWithLifecycle()
    val presentationState by playbackManager.presentationState.collectAsStateWithLifecycle()
    val shouldAttachPlayer = presentationState == com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_PORTRAIT ||
                             presentationState == com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_LANDSCAPE
    var userPausedManually by remember { mutableStateOf(playbackManager.userPausedManually) }
    var currentPositionMs by remember {
        mutableLongStateOf(
            if (playbackManager.currentPositionMs.value > 0L) playbackManager.currentPositionMs.value
            else if (exoPlayer.currentPosition > 0L) exoPlayer.currentPosition
            else 0L
        )
    }
    var durationMs by remember {
        mutableLongStateOf(
            if (playbackManager.durationMs.value > 0L) playbackManager.durationMs.value
            else if (exoPlayer.duration > 0L) exoPlayer.duration
            else 0L
        )
    }

    LaunchedEffect(Unit) {
        launch {
            playbackManager.currentPositionMs.collect { pos ->
                if (pos > 0L) currentPositionMs = pos
            }
        }
        launch {
            playbackManager.durationMs.collect { dur ->
                if (dur > 0L) durationMs = dur
            }
        }
    }
    var isControlsVisible by remember { mutableStateOf(qaControls) }

    // Screen Lock State
    var isScreenLocked by remember { mutableStateOf(false) }
    var showLockHint by remember { mutableStateOf(false) }

    // Bottom Sheets State
    var showSettingsSheet by remember { mutableStateOf(false) }
    var showSourcesSheet by remember { mutableStateOf(false) }
    var showQuickEpisodeSelector by remember { mutableStateOf(false) }

    val settingsRepository = remember { com.pvq.cinepvq.CinepvqApp.instance.settingsRepository }
    val playerSettings by settingsRepository.playerSettings.collectAsStateWithLifecycle(initialValue = com.pvq.cinepvq.data.settings.PlayerSettings())
    val coroutineScope = rememberCoroutineScope()

    var currentSwitchGeneration by remember { mutableIntStateOf(0) }
    var previousSpeedBeforeBoost by remember { mutableFloatStateOf(1.0f) }
    var doubleTapSeekSide by remember { mutableStateOf<SeekSide?>(null) }
    var doubleTapAccumulatedSec by remember { mutableIntStateOf(0) }
    var doubleTapTriggerCounter by remember { mutableIntStateOf(0) }

    var lastTapTime by remember { mutableLongStateOf(0L) }
    var lastTapPos by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    var pendingSingleTapJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }

    // Translation warning: tied to actual playback start of new source
    var isPlaybackStartedWarningVisible by remember { mutableStateOf(false) }
    var pendingWarningTrigger by remember { mutableStateOf(false) }

    LaunchedEffect(showSyncWarning) {
        if (showSyncWarning) {
            pendingWarningTrigger = true
        }
    }

    LaunchedEffect(isPlaybackStartedWarningVisible) {
        if (isPlaybackStartedWarningVisible) {
            delay(5000)
            isPlaybackStartedWarningVisible = false
            onDismissSyncWarning()
        }
    }

    // Playback Speed & Resolution state
    var currentPlaybackSpeed by remember { mutableFloatStateOf(1.0f) }
    var currentResolution by remember { mutableStateOf(VideoResolution.AUTO) }

    LaunchedEffect(doubleTapTriggerCounter) {
        if (doubleTapTriggerCounter > 0) {
            delay(800)
            doubleTapSeekSide = null
            doubleTapAccumulatedSec = 0
            doubleTapTriggerCounter = 0
        }
    }


    // Playback state restoration across server / stream source transitions
    var pendingSeekPositionMs by remember { mutableStateOf<Long?>(null) }
    var pendingPlayWhenReady by remember { mutableStateOf<Boolean?>(null) }

    // Embed/Iframe fullscreen custom view state (Browser / Cốc Cốc UX)
    var customEmbedView by remember { mutableStateOf<View?>(null) }
    var customEmbedCallback by remember { mutableStateOf<WebChromeClient.CustomViewCallback?>(null) }

    // Video tracks & resolution metadata
    var activeVideoWidth by remember { mutableIntStateOf(0) }
    var activeVideoHeight by remember { mutableIntStateOf(0) }
    var activeVideoBitrate by remember { mutableIntStateOf(0) }
    var availableVideoTracks by remember { mutableStateOf<List<VideoTrackInfo>>(emptyList()) }

    // Fullscreen Gesture HUD states
    var brightnessLevel by remember { mutableFloatStateOf(if (qaBrightness >= 0f) qaBrightness else 0.5f) }
    var showBrightnessHud by remember { mutableStateOf(qaBrightness >= 0f) }
    var volumeLevel by remember { mutableFloatStateOf(if (qaVolume >= 0f) qaVolume else 0.5f) }
    var showVolumeHud by remember { mutableStateOf(qaVolume >= 0f) }
    var seekDeltaSeconds by remember { mutableIntStateOf(if (qaSeek >= 0L) 15 else 0) }
    var seekTargetPositionMs by remember { mutableLongStateOf(if (qaSeek >= 0L) qaSeek else 0L) }
    var showSeekHud by remember { mutableStateOf(qaSeek >= 0L) }
    var isSpeedBoosting by remember { mutableStateOf(false) }

    // Fullscreen System Bars (Immersive mode, YouTube-like transient swipe)
    val view = LocalView.current
    DisposableEffect(isFullscreen) {
        val window = (view.context as? Activity)?.window
        if (window != null) {
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            if (isFullscreen) {
                insetsController.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                insetsController.show(WindowInsetsCompat.Type.systemBars())
            }
        }
        onDispose {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                val insetsController = WindowCompat.getInsetsController(window, view)
                insetsController.show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    val movie by viewModel.movie.collectAsStateWithLifecycle()
    val episode by viewModel.currentEpisode.collectAsStateWithLifecycle()
    val activeStream by viewModel.activeStream.collectAsStateWithLifecycle()
    val availableSources by viewModel.availableSources.collectAsStateWithLifecycle()
    val isLoadingStream by viewModel.isLoadingStream.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    // Auto-hide lock hint after 3 seconds
    LaunchedEffect(showLockHint) {
        if (showLockHint) {
            delay(3000)
            showLockHint = false
        }
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                if (playing && pendingWarningTrigger && exoPlayer.playbackState == Player.STATE_READY) {
                    pendingWarningTrigger = false
                    isPlaybackStartedWarningVisible = true
                }
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
                            if (isSelected) {
                                activeVideoWidth = format.width
                                activeVideoHeight = format.height
                                activeVideoBitrate = format.bitrate
                            }
                        }
                    }
                }
                availableVideoTracks = videoTracks
                if (videoTracks.size <= 1) {
                    applyResolution(exoPlayer, VideoResolution.AUTO, videoTracks)
                } else if (currentResolution != VideoResolution.AUTO) {
                    applyResolution(exoPlayer, currentResolution, videoTracks)
                }
            }

            override fun onVideoSizeChanged(videoSize: VideoSize) {
                if (videoSize.width > 0 && videoSize.height > 0) {
                    activeVideoWidth = videoSize.width
                    activeVideoHeight = videoSize.height
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    if (pendingWarningTrigger && (exoPlayer.isPlaying || exoPlayer.playWhenReady)) {
                        pendingWarningTrigger = false
                        isPlaybackStartedWarningVisible = true
                    }
                } else if (playbackState == Player.STATE_ENDED) {
                    val nextEp = viewModel.getNextEpisode()
                    if (nextEp != null) {
                        onSwitchEpisode(slug, nextEp.slug)
                    }
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                android.util.Log.e("PLAYER_ERROR", "sourceId=${activeStream?.sourceId}, error=${error.message}", error)
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
        }
    }

    LaunchedEffect(playerSettings.defaultPlaybackSpeed) {
        if (currentPlaybackSpeed == 1.0f && playerSettings.defaultPlaybackSpeed != 1.0f) {
            currentPlaybackSpeed = playerSettings.defaultPlaybackSpeed
            exoPlayer.setPlaybackSpeed(playerSettings.defaultPlaybackSpeed)
        }
    }

    LaunchedEffect(playerSettings.defaultResolution) {
        if (currentResolution == VideoResolution.AUTO && playerSettings.defaultResolution != "auto") {
            val defaultRes = when (playerSettings.defaultResolution) {
                "1080p" -> VideoResolution.FHD
                "720p" -> VideoResolution.HD
                "480p" -> VideoResolution.SD
                "360p" -> VideoResolution.LOW
                else -> VideoResolution.AUTO
            }
            if (defaultRes != VideoResolution.AUTO) {
                currentResolution = defaultRes
                if (availableVideoTracks.size > 1) {
                    applyResolution(exoPlayer, defaultRes, availableVideoTracks)
                }
            }
        }
    }

    // When server or episode changes, cleanly transition stream and manage resume position
    var lastLoadedServer by remember { mutableStateOf(serverName) }
    var lastLoadedEpisode by remember { mutableStateOf(episodeSlug) }

    LaunchedEffect(slug, episodeSlug, serverName) {
        if (customEmbedView != null) {
            try {
                customEmbedCallback?.onCustomViewHidden()
            } catch (_: Exception) {}
            customEmbedView = null
            customEmbedCallback = null
        }
        val isEpisodeChanged = (episodeSlug != lastLoadedEpisode)
        val isServerChanged = (serverName != lastLoadedServer)

        if (isServerChanged) {
            // User switched server (e.g. Vietsub -> Thuyết minh, Server 1 -> Server 2)
            // MUST preserve current playback position and play/pause state!
            val capturedPos = if (exoPlayer.currentPosition > 0L) exoPlayer.currentPosition else currentPositionMs
            val wasPlaying = if (exoPlayer.playbackState == Player.STATE_READY) exoPlayer.isPlaying else !userPausedManually

            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0 && capturedPos > 0) {
                viewModel.recordProgress(lastLoadedEpisode, capturedPos, exoPlayer.duration)
            }

            pendingSeekPositionMs = capturedPos
            pendingPlayWhenReady = wasPlaying
            currentPositionMs = capturedPos

            lastLoadedEpisode = episodeSlug
            lastLoadedServer = serverName

            viewModel.initializePlayer(
                slug,
                episodeSlug,
                serverName,
                embedUrl,
                resumePositionMs = capturedPos,
                preferredSourceKey = playerSettings.defaultSource
            )
        } else if (isEpisodeChanged) {
            // Genuine navigation to a DIFFERENT episode (Next / Previous / direct pick)
            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0) {
                viewModel.recordProgress(lastLoadedEpisode, exoPlayer.currentPosition, exoPlayer.duration)
            }
            userPausedManually = false
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
            currentPositionMs = 0L
            durationMs = 0L
            pendingSeekPositionMs = null
            pendingPlayWhenReady = null

            lastLoadedEpisode = episodeSlug
            lastLoadedServer = serverName

            viewModel.initializePlayer(
                slug,
                episodeSlug,
                serverName,
                embedUrl,
                resumePositionMs = null,
                preferredSourceKey = playerSettings.defaultSource
            )
        } else {
            lastLoadedEpisode = episodeSlug
            lastLoadedServer = serverName
            viewModel.initializePlayer(
                slug,
                episodeSlug,
                serverName,
                embedUrl,
                resumePositionMs = null,
                preferredSourceKey = playerSettings.defaultSource
            )
        }
    }



    // Auto-hide controls overlay after 4 seconds of playback (disabled if qaControls/qaHud requested)
    LaunchedEffect(isControlsVisible, isPlaying) {
        if (isControlsVisible && isPlaying && !qaControls && qaBrightness < 0f && qaVolume < 0f && qaSeek < 0L) {
            delay(4000)
            isControlsVisible = false
        }
    }

    // Handle Back Navigation
    BackHandler {
        if (customEmbedView != null) {
            try {
                customEmbedCallback?.onCustomViewHidden()
            } catch (_: Exception) {}
            customEmbedView = null
            customEmbedCallback = null
            onFullscreenToggle(false)
        } else if (isScreenLocked) {
            isScreenLocked = false
            showLockHint = false
        } else if (isFullscreen) {
            onFullscreenToggle(false)
        } else {
            onBackClick()
        }
    }

        val dragFraction = if (!isFullscreen && dragThresholdPx > 0f) (dragOffsetY / (dragThresholdPx * 2.2f)).coerceIn(0f, 1f) else 0f
        val dragScale = 1f - (dragFraction * 0.22f)
        val cornerRadius = (dragFraction * 14).dp

        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(
                    if (!isFullscreen && dragOffsetY > 0f) {
                        Modifier
                            .offset { IntOffset(0, dragOffsetY.toInt()) }
                            .graphicsLayer {
                                scaleX = dragScale
                                scaleY = dragScale
                                alpha = 1f - (dragFraction * 0.15f)
                            }
                            .clip(RoundedCornerShape(cornerRadius))
                    } else Modifier
                )
                .pointerInput(isFullscreen, isScreenLocked) {
                    if (isFullscreen || isScreenLocked) return@pointerInput
                    val touchSlop = viewConfig.touchSlop
                    awaitEachGesture {
                        val down = awaitFirstDown(pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial, requireUnconsumed = false)
                        val startPos = down.position
                        var isDraggingDown = false

                        while (true) {
                            val event = awaitPointerEvent(pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial)
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break

                            if (!change.pressed) {
                                if (isDraggingDown) {
                                    if (dragOffsetY > dragThresholdPx) {
                                        dragOffsetY = 0f
                                        onMinimize()
                                    } else {
                                        val currentOffset = dragOffsetY
                                        coroutineScope.launch {
                                            Animatable(currentOffset).animateTo(
                                                targetValue = 0f,
                                                animationSpec = spring(
                                                    dampingRatio = Spring.DampingRatioLowBouncy,
                                                    stiffness = Spring.StiffnessMedium
                                                )
                                            ) {
                                                dragOffsetY = value
                                            }
                                        }
                                    }
                                }
                                break
                            }

                            val dragX = change.position.x - startPos.x
                            val dragY = change.position.y - startPos.y

                            if (!isDraggingDown) {
                                if (dragY > touchSlop && dragY > kotlin.math.abs(dragX) * 1.3f) {
                                    isDraggingDown = true
                                    change.consume()
                                    dragOffsetY = dragY
                                }
                            } else {
                                change.consume()
                                dragOffsetY = dragY.coerceAtLeast(0f)
                            }
                        }
                    }
                }
                .background(Color.Black)
        ) {
        when {
            isLoadingStream -> {
                LoadingView()
            }
            errorMessage != null && activeStream == null -> {
                ErrorView(
                    message = errorMessage ?: "Không thể phát video",
                    onRetry = { viewModel.initializePlayer(slug, episodeSlug, serverName, embedUrl) }
                )
            }
            activeStream?.type == StreamType.EMBED -> {
                // ── In-App Web View for Iframe Embed (Configured for streaming hosts) ──
                key(activeStream!!.url) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        if (customEmbedView != null) {
                            // Fullscreen custom view container (WebChromeClient onShowCustomView)
                            AndroidView(
                                factory = { _ ->
                                    FrameLayout(context).apply {
                                        layoutParams = ViewGroup.LayoutParams(
                                            ViewGroup.LayoutParams.MATCH_PARENT,
                                            ViewGroup.LayoutParams.MATCH_PARENT
                                        )
                                        setBackgroundColor(android.graphics.Color.BLACK)
                                        val parent = customEmbedView?.parent as? ViewGroup
                                        parent?.removeView(customEmbedView)
                                        addView(
                                            customEmbedView,
                                            FrameLayout.LayoutParams(
                                                ViewGroup.LayoutParams.MATCH_PARENT,
                                                ViewGroup.LayoutParams.MATCH_PARENT
                                            )
                                        )
                                    }
                                },
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            EmbedPlayerView(
                                url = activeStream!!.url,
                                modifier = Modifier.fillMaxSize(),
                                onCustomViewChange = { view, callback ->
                                    customEmbedView = view
                                    customEmbedCallback = callback
                                    if (view != null) {
                                        onFullscreenToggle(true)
                                    } else {
                                        onFullscreenToggle(false)
                                    }
                                }
                            )

                            // Overlay Top Bar for Embed
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .then(if (isFullscreen) Modifier else Modifier.statusBarsPadding())
                                    .padding(horizontal = 16.dp, vertical = 12.dp)
                                    .align(Alignment.TopCenter)
                                    .background(Color.Black.copy(alpha = 0.65f)),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    IconButton(
                                        onClick = { onMinimize() },
                                        modifier = Modifier.size(40.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Filled.KeyboardArrowDown,
                                            contentDescription = "Thu nhỏ",
                                            tint = Color.White,
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(
                                            text = movie?.name ?: "Cinepvq",
                                            color = Color.White,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = "Nguồn nhúng: ${activeStream?.displayName}",
                                            color = CinepvqPrimaryLight,
                                            fontSize = 11.sp
                                        )
                                    }
                                }

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (availableSources.size > 1) {
                                        TextButton(
                                            onClick = { showSourcesSheet = true },
                                            colors = ButtonDefaults.textButtonColors(contentColor = CinepvqPrimaryLight)
                                        ) {
                                            Icon(Icons.Default.Dns, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "Đổi Nguồn",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                    IconButton(
                                        onClick = { onFullscreenToggle(!isFullscreen) },
                                        modifier = Modifier.size(40.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                                            contentDescription = if (isFullscreen) "Thoát toàn màn hình" else "Toàn màn hình",
                                            tint = Color.White,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else -> {
            // 1. Video Surface Layer (Pure ExoPlayer Surface)
            Box(modifier = Modifier.fillMaxSize()) {
                    AndroidView(
                        factory = { ctx ->
                            PlayerView(ctx).apply {
                                player = if (shouldAttachPlayer) exoPlayer else null
                                useController = false
                                layoutParams = FrameLayout.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                            }
                        },
                        update = { playerView ->
                            val target = if (shouldAttachPlayer) exoPlayer else null
                            if (playerView.player !== target) {
                                playerView.player = target
                            }
                        },
                        onRelease = { playerView ->
                            playerView.player = null
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }

                // 2. Gesture & Tap Detection Layer (ONLY active when controls are HIDDEN and screen is UNLOCKED)
                if (!isControlsVisible && !isScreenLocked) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .semantics { contentDescription = "Video Player Area" }
                            .pointerInput(isFullscreen) {
                                val touchSlop = viewConfig.touchSlop
                                val longPressTimeout = 400L
                                val doubleTapTimeout = 320L

                                awaitEachGesture {
                                    val down = awaitFirstDown(requireUnconsumed = false)
                                    val startPos = down.position
                                    val startTime = System.currentTimeMillis()
                                    val isLeftHalf = startPos.x < size.width / 2f
                                    var totalDragX = 0f
                                    var totalDragY = 0f
                                    var hasMoved = false
                                    var gestureMode: GestureMode? = null

                                    val seekStep = playerSettings.defaultSeekDuration.coerceAtLeast(5)
                                    val initialBrightness = activity?.window?.attributes?.screenBrightness.let {
                                        if (it == null || it < 0f) 0.5f else it
                                    }
                                    val initialVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / maxVolume

                                    while (true) {
                                        val event = awaitPointerEvent()
                                        val change = event.changes.firstOrNull { it.id == down.id } ?: break

                                        if (!change.pressed) {
                                            // Finger released / UP
                                            if (isSpeedBoosting) {
                                                isSpeedBoosting = false
                                                exoPlayer.setPlaybackSpeed(previousSpeedBeforeBoost)
                                            } else if (showSeekHud) {
                                                exoPlayer.seekTo(seekTargetPositionMs)
                                                currentPositionMs = seekTargetPositionMs
                                                showSeekHud = false
                                            } else if (!hasMoved) {
                                                val elapsedSinceLast = startTime - lastTapTime
                                                val wasLeftHalf = lastTapPos.x < size.width / 2f
                                                val isSameSide = (isLeftHalf == wasLeftHalf)
                                                val isDoubleTap = elapsedSinceLast in 40L..doubleTapTimeout && isSameSide

                                                if (isDoubleTap) {
                                                    pendingSingleTapJob?.cancel()
                                                    pendingSingleTapJob = null
                                                    lastTapTime = 0L

                                                    val side = if (isLeftHalf) SeekSide.LEFT else SeekSide.RIGHT
                                                    val delta = if (isLeftHalf) -seekStep else seekStep
                                                    val newPos = (exoPlayer.currentPosition + delta * 1000L).coerceIn(0L, durationMs.coerceAtLeast(0L))
                                                    exoPlayer.seekTo(newPos)
                                                    currentPositionMs = newPos

                                                    if (doubleTapSeekSide == side) {
                                                        doubleTapAccumulatedSec += seekStep
                                                    } else {
                                                        doubleTapSeekSide = side
                                                        doubleTapAccumulatedSec = seekStep
                                                    }
                                                    doubleTapTriggerCounter++
                                                } else {
                                                    lastTapTime = startTime
                                                    lastTapPos = startPos
                                                    pendingSingleTapJob?.cancel()
                                                    pendingSingleTapJob = coroutineScope.launch {
                                                        delay(doubleTapTimeout)
                                                        isControlsVisible = true
                                                    }
                                                }
                                            }
                                            showBrightnessHud = false
                                            showVolumeHud = false
                                            break
                                        }

                                        val dragX = change.position.x - startPos.x
                                        val dragY = change.position.y - startPos.y
                                        totalDragX = dragX
                                        totalDragY = dragY

                                        if (!hasMoved) {
                                            if (abs(dragX) > touchSlop || abs(dragY) > touchSlop) {
                                                hasMoved = true
                                                pendingSingleTapJob?.cancel()
                                                lastTapTime = 0L
                                                if (isFullscreen) {
                                                    gestureMode = if (abs(dragX) > abs(dragY)) GestureMode.SEEK else GestureMode.VERTICAL
                                                }
                                            } else if ((System.currentTimeMillis() - startTime) >= longPressTimeout && !isSpeedBoosting) {
                                                // Long Press Triggered (Works in portrait and fullscreen!)
                                                pendingSingleTapJob?.cancel()
                                                lastTapTime = 0L
                                                previousSpeedBeforeBoost = exoPlayer.playbackParameters.speed
                                                exoPlayer.setPlaybackSpeed(2.0f)
                                                isSpeedBoosting = true
                                            }
                                        }

                                        if (isFullscreen && gestureMode != null) {
                                            if (gestureMode == GestureMode.SEEK) {
                                                change.consume()
                                                val deltaSec = (totalDragX / (size.width * 0.55f) * 90f).toInt()
                                                seekDeltaSeconds = deltaSec
                                                seekTargetPositionMs = (currentPositionMs + deltaSec * 1000L).coerceIn(0L, durationMs.coerceAtLeast(1L))
                                                showSeekHud = true
                                            } else if (gestureMode == GestureMode.VERTICAL) {
                                                change.consume()
                                                val deltaPercent = -totalDragY / (size.height * 0.7f)
                                                if (isLeftHalf) {
                                                    val newB = (initialBrightness + deltaPercent).coerceIn(0.01f, 1.0f)
                                                    brightnessLevel = newB
                                                    activity?.window?.attributes = activity?.window?.attributes?.apply { screenBrightness = newB }
                                                    showBrightnessHud = true
                                                } else {
                                                    val newV = (initialVolume + deltaPercent).coerceIn(0f, 1.0f)
                                                    volumeLevel = newV
                                                    val volIdx = (newV * maxVolume).toInt().coerceIn(0, maxVolume)
                                                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, volIdx, 0)
                                                    showVolumeHud = true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                    )
                }

                // 3. Screen Locked Tap Area
                if (isScreenLocked) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) {
                                showLockHint = true
                            }
                    )
                }

                // ── Gesture Feedback HUD Overlays ─────────────────────────────
                // 1. Volume HUD (Clean level bar, ZERO stop indicator/dot)
                if (showVolumeHud) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.Black.copy(alpha = 0.85f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.15f)),
                            shadowElevation = 12.dp
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = if (volumeLevel == 0f) Icons.AutoMirrored.Filled.VolumeMute else Icons.AutoMirrored.Filled.VolumeUp,
                                    contentDescription = null,
                                    tint = CinepvqPrimaryLight,
                                    modifier = Modifier.size(28.dp)
                                )
                                Text(
                                    text = "Âm lượng ${Math.round(volumeLevel * 100)}%",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Box(
                                    modifier = Modifier
                                        .width(100.dp)
                                        .height(4.dp)
                                        .background(Color.White.copy(alpha = 0.2f), RoundedCornerShape(2.dp))
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxHeight()
                                            .fillMaxWidth(fraction = volumeLevel.coerceIn(0f, 1f))
                                            .background(CinepvqPrimary, RoundedCornerShape(2.dp))
                                    )
                                }
                            }
                        }
                    }
                }

                // 2. Brightness HUD (Clean level bar, ZERO stop indicator/dot)
                if (showBrightnessHud) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.Black.copy(alpha = 0.85f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.15f)),
                            shadowElevation = 12.dp
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.WbSunny,
                                    contentDescription = null,
                                    tint = Color(0xFFFFA726),
                                    modifier = Modifier.size(28.dp)
                                )
                                Text(
                                    text = "Độ sáng ${Math.round(brightnessLevel * 100)}%",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Box(
                                    modifier = Modifier
                                        .width(100.dp)
                                        .height(4.dp)
                                        .background(Color.White.copy(alpha = 0.2f), RoundedCornerShape(2.dp))
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxHeight()
                                            .fillMaxWidth(fraction = brightnessLevel.coerceIn(0f, 1f))
                                            .background(Color(0xFFFFA726), RoundedCornerShape(2.dp))
                                    )
                                }
                            }
                        }
                    }
                }

                // 3. Seek HUD
                if (showSeekHud) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.Black.copy(alpha = 0.85f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.15f)),
                            shadowElevation = 12.dp
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 24.dp, vertical = 14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = if (seekDeltaSeconds >= 0) Icons.Default.FastForward else Icons.Default.FastRewind,
                                    contentDescription = null,
                                    tint = CinepvqPrimaryLight,
                                    modifier = Modifier.size(28.dp)
                                )
                                Text(
                                    text = formatSeekTime(seekTargetPositionMs),
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = if (seekDeltaSeconds >= 0) "+${seekDeltaSeconds}s" else "${seekDeltaSeconds}s",
                                    color = CinepvqPrimaryLight,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // 4. Speed Boost HUD (Hold 2.0x)
                if (isSpeedBoosting) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 40.dp),
                        contentAlignment = Alignment.TopCenter
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.Black.copy(alpha = 0.8f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                            shadowElevation = 8.dp
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.FastForward,
                                    contentDescription = null,
                                    tint = CinepvqPrimaryLight,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "2.0x Tốc độ phát",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // 5. Double Tap Seek HUD (Left / Right)
                if (doubleTapSeekSide != null) {
                    val isLeft = doubleTapSeekSide == SeekSide.LEFT
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 48.dp),
                        contentAlignment = if (isLeft) Alignment.CenterStart else Alignment.CenterEnd
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.Black.copy(alpha = 0.8f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, CinepvqPrimary.copy(alpha = 0.5f)),
                            shadowElevation = 8.dp
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 22.dp, vertical = 14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = if (isLeft) Icons.Default.FastRewind else Icons.Default.FastForward,
                                    contentDescription = null,
                                    tint = CinepvqPrimaryLight,
                                    modifier = Modifier.size(28.dp)
                                )
                                Text(
                                    text = if (isLeft) "↶ ${doubleTapAccumulatedSec}s" else "${doubleTapAccumulatedSec}s ↷",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // Next/Previous episode availability
                val nextEpisode = viewModel.getNextEpisode()
                val prevEpisode = viewModel.getPreviousEpisode()
                val effectiveServers = servers.ifEmpty { movie?.episodes ?: emptyList() }
                val effectiveEpisodes = allEpisodes.ifEmpty {
                    effectiveServers.getOrNull(selectedServerIndex)?.items ?: emptyList()
                }

                // ── Controls Overlay ─────────────────────────────────────────
                PlayerControls(
                    isVisible = isControlsVisible,
                    movie = movie,
                    episode = episode,
                    isPlaying = isPlaying,
                    currentPositionMs = currentPositionMs,
                    durationMs = durationMs,
                    isFullscreen = isFullscreen,
                    hasPrevious = prevEpisode != null,
                    hasNext = nextEpisode != null,
                    activeStream = activeStream,
                    availableSources = availableSources,
                    servers = effectiveServers,
                    selectedServerIndex = selectedServerIndex,
                    isFavorite = isFavorite,
                    isWatchLater = isWatchLater,
                    isScreenLocked = isScreenLocked,
                    showLockHint = showLockHint,
                    showSyncWarning = isPlaybackStartedWarningVisible,
                    showLanguageButton = effectiveServers.size > 1,
                    showQuickEpisodeSelector = showQuickEpisodeSelector,
                    allEpisodes = effectiveEpisodes,
                    onTogglePlayPause = {
                        if (exoPlayer.isPlaying) {
                            exoPlayer.pause()
                            userPausedManually = true
                        } else {
                            exoPlayer.play()
                            userPausedManually = false
                        }
                    },
                    onSeekTo = { posMs ->
                        currentPositionMs = posMs
                        exoPlayer.seekTo(posMs)
                    },
                    onPreviousClick = {
                        if (prevEpisode != null) {
                            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0) {
                                viewModel.recordProgress(episodeSlug, exoPlayer.currentPosition, exoPlayer.duration)
                            }
                            userPausedManually = false
                            exoPlayer.stop()
                            exoPlayer.clearMediaItems()
                            currentPositionMs = 0L
                            durationMs = 0L
                            onSwitchEpisode(slug, prevEpisode.slug)
                        }
                    },
                    onNextClick = {
                        if (nextEpisode != null) {
                            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0) {
                                viewModel.recordProgress(episodeSlug, exoPlayer.currentPosition, exoPlayer.duration)
                            }
                            userPausedManually = false
                            exoPlayer.stop()
                            exoPlayer.clearMediaItems()
                            currentPositionMs = 0L
                            durationMs = 0L
                            onSwitchEpisode(slug, nextEpisode.slug)
                        }
                    },
                    onTopExitClick = {
                        onMinimize()
                    },
                    onFullscreenToggle = {
                        onFullscreenToggle(!isFullscreen)
                    },
                    onOpenSettings = { showSettingsSheet = true },
                    onOpenSources = { showSourcesSheet = true },
                    onOpenAudioLanguage = onOpenAudioLanguage,
                    onToggleLock = {
                        isScreenLocked = !isScreenLocked
                        showLockHint = false
                        if (isScreenLocked) isControlsVisible = false
                    },
                    onDismissLockHint = { showLockHint = false },
                    onShowLockHint = { showLockHint = true },
                    onDismissSyncWarning = onDismissSyncWarning,
                    onToggleFavorite = onToggleFavorite,
                    onToggleWatchLater = onToggleWatchLater,
                    onOpenComments = onOpenComments,
                    onShareClick = onShareClick,
                    onToggleQuickEpisodes = { showQuickEpisodeSelector = !showQuickEpisodeSelector },
                    onSelectQuickEpisode = { ep ->
                        showQuickEpisodeSelector = false
                        if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0) {
                            viewModel.recordProgress(episodeSlug, exoPlayer.currentPosition, exoPlayer.duration)
                        }
                        userPausedManually = false
                        exoPlayer.stop()
                        exoPlayer.clearMediaItems()
                        currentPositionMs = 0L
                        durationMs = 0L
                        onSwitchEpisode(slug, ep.slug)
                    },
                    onDismissControls = {
                        isControlsVisible = false
                    }
                )
            }
        }

        // ── Player Settings Bottom Sheet (Speed & Resolution) ──────────────
        if (showSettingsSheet) {
            PlayerSettingsBottomSheet(
                currentSpeed = currentPlaybackSpeed,
                onSpeedChange = { speed ->
                    currentPlaybackSpeed = speed
                    exoPlayer.setPlaybackSpeed(speed)
                },
                currentResolution = currentResolution,
                onResolutionChange = { res ->
                    currentResolution = res
                    applyResolution(exoPlayer, res, availableVideoTracks)
                },
                availableVideoTracks = availableVideoTracks,
                activeVideoWidth = activeVideoWidth,
                activeVideoHeight = activeVideoHeight,
                activeVideoBitrate = activeVideoBitrate,
                onDismiss = { showSettingsSheet = false }
            )
        }

        // ── Stream Source Selector Bottom Sheet ─────────────────────────────
        if (showSourcesSheet) {
            PlayerSourceBottomSheet(
                sources = availableSources,
                activeSource = activeStream,
                onSelectSource = { source ->
                    if (source.sourceId != activeStream?.sourceId) {
                        if (customEmbedView != null) {
                            try {
                                customEmbedCallback?.onCustomViewHidden()
                            } catch (_: Exception) {}
                            customEmbedView = null
                            customEmbedCallback = null
                            onFullscreenToggle(false)
                        }
                        val capturedPos = if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.currentPosition > 0L) {
                            exoPlayer.currentPosition
                        } else {
                            currentPositionMs
                        }
                        val wasPlaying = if (activeStream?.type == StreamType.HLS_DIRECT) {
                            if (exoPlayer.playbackState == Player.STATE_READY) exoPlayer.isPlaying else !userPausedManually
                        } else {
                            !userPausedManually
                        }
                        if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0 && capturedPos > 0) {
                            viewModel.recordProgress(episodeSlug, capturedPos, exoPlayer.duration)
                        }
                        pendingSeekPositionMs = capturedPos
                        pendingPlayWhenReady = wasPlaying
                        showSourcesSheet = false
                        viewModel.switchStream(source)
                    }
                },
                onDismiss = { showSourcesSheet = false }
            )
        }
    }
}

private fun formatSeekTime(millis: Long): String {
    val totalSeconds = (millis / 1000).coerceAtLeast(0)
    val seconds = totalSeconds % 60
    val minutes = (totalSeconds / 60) % 60
    val hours = totalSeconds / 3600

    return if (hours > 0) {
        String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.ROOT, "%02d:%02d", minutes, seconds)
    }
}

@OptIn(UnstableApi::class)
private fun applyResolution(player: ExoPlayer, res: VideoResolution, tracks: List<VideoTrackInfo>) {
    if (res == VideoResolution.AUTO || tracks.size <= 1) {
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
            .setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
            .build()
    } else {
        val matchingTrack = tracks.find { it.resolution == res }
        if (matchingTrack != null) {
            val group = player.currentTracks.groups.getOrNull(matchingTrack.groupIndex)?.mediaTrackGroup
            if (group != null) {
                player.trackSelectionParameters = player.trackSelectionParameters
                    .buildUpon()
                    .setOverrideForType(
                        TrackSelectionOverride(group, listOf(matchingTrack.trackIndex))
                    )
                    .build()
            }
        } else {
            val maxH = res.maxLines
            val maxW = if (maxH == Int.MAX_VALUE) Int.MAX_VALUE else (maxH * 16) / 9
            player.trackSelectionParameters = player.trackSelectionParameters
                .buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
                .setMaxVideoSize(maxW, maxH)
                .build()
        }
    }
}
