package com.pvq.cinepvq.features.player

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.view.ViewGroup
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
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.pvq.cinepvq.core.designsystem.components.ErrorView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.ui.theme.*
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.abs

private enum class GestureMode {
    SEEK,
    VERTICAL
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

    // Audio manager for volume control
    val audioManager = remember(context) { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    val maxVolume = remember(audioManager) { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1) }

    var isPlaying by remember { mutableStateOf(true) }
    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var isControlsVisible by remember { mutableStateOf(qaControls) }

    // Screen Lock State
    var isScreenLocked by remember { mutableStateOf(false) }
    var showLockHint by remember { mutableStateOf(false) }

    // Bottom Sheets State
    var showSettingsSheet by remember { mutableStateOf(false) }
    var showSourcesSheet by remember { mutableStateOf(false) }
    var showQuickEpisodeSelector by remember { mutableStateOf(false) }

    // Playback Speed & Resolution state
    var currentPlaybackSpeed by remember { mutableFloatStateOf(1.0f) }
    var currentResolution by remember { mutableStateOf(VideoResolution.AUTO) }

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

    // Auto-hide sync warning after 6 seconds
    LaunchedEffect(showSyncWarning) {
        if (showSyncWarning) {
            delay(6000)
            onDismissSyncWarning()
        }
    }

    // Initialize ExoPlayer
    val exoPlayer = remember(context) {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = true
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(playing: Boolean) {
                    isPlaying = playing
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        durationMs = duration.coerceAtLeast(0L)
                    } else if (playbackState == Player.STATE_ENDED) {
                        if (activeStream?.type == StreamType.HLS_DIRECT && duration > 0) {
                            viewModel.recordProgress(episodeSlug, duration, duration)
                        }
                        val nextEp = viewModel.getNextEpisode()
                        if (nextEp != null) {
                            onSwitchEpisode(slug, nextEp.slug)
                        }
                    }
                }
            })
        }
    }

    // When server or episode changes, cleanly transition stream and manage resume position
    var lastLoadedServer by remember { mutableStateOf(serverName) }
    var lastLoadedEpisode by remember { mutableStateOf(episodeSlug) }

    LaunchedEffect(slug, episodeSlug, serverName) {
        val isEpisodeChanged = (episodeSlug != lastLoadedEpisode)
        val isServerChanged = (serverName != lastLoadedServer)

        if (isEpisodeChanged) {
            // Flush progress for the episode we are leaving before switching
            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0) {
                viewModel.recordProgress(lastLoadedEpisode, exoPlayer.currentPosition, exoPlayer.duration)
            }
            // Cleanly stop and reset media on the existing ExoPlayer instance
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
            currentPositionMs = 0L
            durationMs = 0L
        }

        // Only preserve current playback position if switching server/translation for the SAME episode!
        val resumePos = if (isServerChanged && !isEpisodeChanged && currentPositionMs > 0L) {
            currentPositionMs
        } else {
            null
        }

        lastLoadedEpisode = episodeSlug
        lastLoadedServer = serverName

        viewModel.initializePlayer(slug, episodeSlug, serverName, embedUrl, resumePositionMs = resumePos)
    }

    // Load stream into ExoPlayer with clean state reset
    LaunchedEffect(activeStream) {
        val stream = activeStream ?: return@LaunchedEffect
        if (stream.type == StreamType.HLS_DIRECT) {
            val mediaItem = MediaItem.Builder()
                .setUri(stream.url)
                .apply {
                    if (stream.url.contains(".m3u8") || stream.url.contains("/m3u8")) {
                        setMimeType(MimeTypes.APPLICATION_M3U8)
                    }
                }
                .build()

            // Reset position on media item change
            exoPlayer.setMediaItem(mediaItem, /* resetPosition = */ true)
            exoPlayer.prepare()

            val resumePos = viewModel.initialResumePositionMs
            if (resumePos > 0L) {
                exoPlayer.seekTo(resumePos)
                currentPositionMs = resumePos
            } else {
                currentPositionMs = 0L
            }
            exoPlayer.play()
        } else {
            exoPlayer.pause()
        }
    }

    // Record progress every 1s (tied strictly to current episodeSlug to prevent race conditions)
    LaunchedEffect(exoPlayer, activeStream, episodeSlug) {
        while (true) {
            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.isPlaying) {
                currentPositionMs = exoPlayer.currentPosition.coerceAtLeast(0L)
                durationMs = exoPlayer.duration.coerceAtLeast(0L)
                viewModel.recordProgress(episodeSlug, currentPositionMs, durationMs)
            }
            delay(1000)
        }
    }

    // Auto-hide controls overlay after 4 seconds of playback (disabled if qaControls/qaHud requested)
    LaunchedEffect(isControlsVisible, isPlaying) {
        if (isControlsVisible && isPlaying && !qaControls && qaBrightness < 0f && qaVolume < 0f && qaSeek < 0L) {
            delay(4000)
            isControlsVisible = false
        }
    }

    // Lifecycle cleanup - Keyed ONLY to exoPlayer so it is NOT released on episode switch
    DisposableEffect(exoPlayer) {
        onDispose {
            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.duration > 0) {
                viewModel.recordProgress(episodeSlug, exoPlayer.currentPosition, exoPlayer.duration)
            }
            exoPlayer.release()
            // Do NOT touch requestedOrientation in onDispose to prevent breaking layout on split screen
        }
    }

    // Handle Back Navigation
    BackHandler {
        if (isScreenLocked) {
            isScreenLocked = false
            showLockHint = false
        } else if (isFullscreen) {
            onFullscreenToggle(false)
        } else {
            onBackClick()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
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
                // ── In-App Web View for Iframe Embed ────────────────────────
                Box(modifier = Modifier.fillMaxSize()) {
                    AndroidView(
                        factory = { ctx ->
                            android.webkit.WebView(ctx).apply {
                                layoutParams = FrameLayout.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.mediaPlaybackRequiresUserGesture = false
                                webChromeClient = android.webkit.WebChromeClient()
                                webViewClient = android.webkit.WebViewClient()
                                loadUrl(activeStream!!.url)
                            }
                        },
                        modifier = Modifier.fillMaxSize()
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
                                onClick = {
                                    if (isFullscreen) onFullscreenToggle(false) else onBackClick()
                                },
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
                    }
                }
            }
            else -> {
                // 1. Video Surface Layer (Pure ExoPlayer Surface)
                Box(modifier = Modifier.fillMaxSize()) {
                    AndroidView(
                        factory = { ctx ->
                            PlayerView(ctx).apply {
                                player = exoPlayer
                                useController = false
                                layoutParams = FrameLayout.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                            }
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
                            .pointerInput(isFullscreen, currentPlaybackSpeed) {
                                val touchSlop = viewConfig.touchSlop
                                val longPressTimeout = 500L

                                awaitEachGesture {
                                    val down = awaitFirstDown(requireUnconsumed = false)
                                    val startPos = down.position
                                    val startTime = System.currentTimeMillis()
                                    val isLeftHalf = startPos.x < size.width / 2f
                                    var totalDragX = 0f
                                    var totalDragY = 0f
                                    var hasMoved = false
                                    var isSpeedBoosting = false
                                    var gestureMode: GestureMode? = null

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
                                                exoPlayer.setPlaybackSpeed(currentPlaybackSpeed)
                                            }
                                            if (showSeekHud) {
                                                exoPlayer.seekTo(seekTargetPositionMs)
                                                currentPositionMs = seekTargetPositionMs
                                                showSeekHud = false
                                            } else if (!hasMoved && !isSpeedBoosting && (System.currentTimeMillis() - startTime) < longPressTimeout) {
                                                // Single tap on video: SHOW CONTROLS IMMEDIATELY!
                                                isControlsVisible = true
                                            }
                                            showBrightnessHud = false
                                            showVolumeHud = false
                                            break
                                        }

                                        if (isFullscreen) {
                                            val dragX = change.position.x - startPos.x
                                            val dragY = change.position.y - startPos.y
                                            totalDragX = dragX
                                            totalDragY = dragY

                                            if (!hasMoved) {
                                                if (abs(dragX) > touchSlop || abs(dragY) > touchSlop) {
                                                    hasMoved = true
                                                    gestureMode = if (abs(dragX) > abs(dragY)) GestureMode.SEEK else GestureMode.VERTICAL
                                                } else if ((System.currentTimeMillis() - startTime) >= longPressTimeout && !isSpeedBoosting) {
                                                    isSpeedBoosting = true
                                                    exoPlayer.setPlaybackSpeed(2.0f)
                                                }
                                            }

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
                    showSyncWarning = showSyncWarning,
                    showLanguageButton = effectiveServers.size > 1,
                    showQuickEpisodeSelector = showQuickEpisodeSelector,
                    allEpisodes = effectiveEpisodes,
                    onTogglePlayPause = {
                        if (exoPlayer.isPlaying) {
                            exoPlayer.pause()
                        } else {
                            exoPlayer.play()
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
                            exoPlayer.stop()
                            exoPlayer.clearMediaItems()
                            currentPositionMs = 0L
                            durationMs = 0L
                            onSwitchEpisode(slug, nextEpisode.slug)
                        }
                    },
                    onTopExitClick = {
                        if (isFullscreen) {
                            onFullscreenToggle(false)
                        } else {
                            onBackClick()
                        }
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
                    val params = exoPlayer.trackSelectionParameters.buildUpon()
                    when (res) {
                        VideoResolution.AUTO -> params.setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
                        VideoResolution.FHD -> params.setMaxVideoSize(1920, 1080)
                        VideoResolution.HD -> params.setMaxVideoSize(1280, 720)
                        VideoResolution.SD -> params.setMaxVideoSize(854, 480)
                        VideoResolution.LOW -> params.setMaxVideoSize(640, 360)
                    }
                    exoPlayer.trackSelectionParameters = params.build()
                },
                onDismiss = { showSettingsSheet = false }
            )
        }

        // ── Stream Source Selector Bottom Sheet ─────────────────────────────
        if (showSourcesSheet) {
            PlayerSourceBottomSheet(
                sources = availableSources,
                activeSource = activeStream,
                onSelectSource = { source ->
                    viewModel.switchStream(source)
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
