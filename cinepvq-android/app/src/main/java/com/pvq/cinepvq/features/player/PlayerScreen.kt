package com.pvq.cinepvq.features.player

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Build
import android.util.Rational
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
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
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.ui.theme.*
import kotlinx.coroutines.delay
import java.util.Locale

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    slug: String,
    episodeSlug: String,
    serverName: String? = null,
    embedUrl: String? = null,
    isFullscreen: Boolean = false,
    onFullscreenToggle: (Boolean) -> Unit = {},
    onBackClick: () -> Unit,
    onSwitchEpisode: (String, String) -> Unit,
    viewModel: PlayerViewModel = viewModel()
) {
    val context = LocalContext.current
    val activity = context as? Activity

    LaunchedEffect(slug, episodeSlug) {
        viewModel.initializePlayer(slug, episodeSlug, serverName, embedUrl)
    }

    val movie by viewModel.movie.collectAsStateWithLifecycle()
    val episode by viewModel.currentEpisode.collectAsStateWithLifecycle()
    val activeStream by viewModel.activeStream.collectAsStateWithLifecycle()
    val availableSources by viewModel.availableSources.collectAsStateWithLifecycle()
    val isLoadingStream by viewModel.isLoadingStream.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    var isPlaying by remember { mutableStateOf(true) }
    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var isControlsVisible by remember { mutableStateOf(true) }
    var showSourceDialog by remember { mutableStateOf(false) }
    var currentPlaybackSpeed by remember { mutableFloatStateOf(1f) }

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
                        // Play next episode automatically if available
                        val nextEp = viewModel.getNextEpisode()
                        if (nextEp != null) {
                            onSwitchEpisode(slug, nextEp.slug)
                        }
                    }
                }
            })
        }
    }

    // Load stream into ExoPlayer only when activeStream is HLS_DIRECT
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

            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.prepare()

            if (viewModel.initialResumePositionMs > 0) {
                exoPlayer.seekTo(viewModel.initialResumePositionMs)
            }
            exoPlayer.play()
        } else {
            // If stream is EMBED or UNAVAILABLE, pause ExoPlayer so it doesn't conflict
            exoPlayer.pause()
        }
    }

    // Ticking progress tracking & record progress every 1s (only during ExoPlayer playback)
    LaunchedEffect(exoPlayer, activeStream) {
        while (true) {
            if (activeStream?.type == StreamType.HLS_DIRECT && exoPlayer.isPlaying) {
                currentPositionMs = exoPlayer.currentPosition.coerceAtLeast(0L)
                durationMs = exoPlayer.duration.coerceAtLeast(0L)
                viewModel.recordProgress(currentPositionMs, durationMs)
            }
            delay(1000)
        }
    }

    // Auto-hide controls overlay after 4 seconds
    LaunchedEffect(isControlsVisible, isPlaying) {
        if (isControlsVisible && isPlaying) {
            delay(4000)
            isControlsVisible = false
        }
    }

    // Lifecycle cleanup
    DisposableEffect(exoPlayer) {
        onDispose {
            if (activeStream?.type == StreamType.HLS_DIRECT) {
                viewModel.recordProgress(exoPlayer.currentPosition, exoPlayer.duration)
            }
            exoPlayer.release()
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    // Handle Back Navigation
    BackHandler {
        if (isFullscreen) {
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
                // ── In-App Web View for Iframe Embed (NguonC / VSMOV) ────────
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
                            .statusBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                            .align(Alignment.TopCenter)
                            .background(Color.Black.copy(alpha = 0.6f)),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = onBackClick) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Quay lại",
                                    tint = Color.White
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = movie?.name ?: "Cinepvq",
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Server Embed (${activeStream?.displayName})",
                                    color = CinepvqPrimaryLight,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        if (availableSources.size > 1) {
                            TextButton(onClick = { showSourceDialog = true }) {
                                Text(
                                    text = "Đổi Nguồn",
                                    color = CinepvqPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
            else -> {
                // ── Native HLS ExoPlayer Surface View ─────────────────────────
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = exoPlayer
                            useController = false // Custom Compose Controls
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) {
                            isControlsVisible = !isControlsVisible
                        }
                )

                // ── Controls Overlay ──────────────────────────────────────────
                AnimatedVisibility(
                    visible = isControlsVisible,
                    enter = fadeIn(),
                    exit = fadeOut()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.5f))
                    ) {
                        // ── Top Bar ──
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding()
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                                .align(Alignment.TopCenter),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                IconButton(
                                    onClick = {
                                        if (isFullscreen) {
                                            onFullscreenToggle(false)
                                        } else {
                                            onBackClick()
                                        }
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                        contentDescription = "Quay lại",
                                        tint = Color.White
                                    )
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                Column {
                                    Text(
                                        text = movie?.name ?: "Cinepvq Player",
                                        color = Color.White,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = if (episode != null) "Tập ${episode!!.name}" else "",
                                        color = CinepvqPrimaryLight,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            // PiP and Server Selector
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                // Source / Quality Selector
                                if (availableSources.size > 1) {
                                    TextButton(onClick = { showSourceDialog = true }) {
                                        Text(
                                            text = activeStream?.displayName ?: "Server",
                                            color = CinepvqPrimaryLight,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }

                                // Picture-in-Picture Button
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    IconButton(
                                        onClick = {
                                            try {
                                                val pipParams = PictureInPictureParams.Builder()
                                                    .setAspectRatio(Rational(16, 9))
                                                    .build()
                                                activity?.enterPictureInPictureMode(pipParams)
                                            } catch (_: Exception) {}
                                        }
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.PictureInPicture,
                                            contentDescription = "Picture-in-Picture",
                                            tint = Color.White
                                        )
                                    }
                                }
                            }
                        }

                        // ── Center Play/Pause & Skip Controls ──
                        Row(
                            modifier = Modifier.align(Alignment.Center),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(28.dp)
                        ) {
                            // Rewind 10s
                            IconButton(
                                onClick = {
                                    exoPlayer.seekTo((exoPlayer.currentPosition - 10000L).coerceAtLeast(0L))
                                },
                                modifier = Modifier
                                    .size(48.dp)
                                    .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Replay10,
                                    contentDescription = "Tua lại 10s",
                                    tint = Color.White,
                                    modifier = Modifier.size(28.dp)
                                )
                            }

                            // Play / Pause Toggle
                            IconButton(
                                onClick = {
                                    if (exoPlayer.isPlaying) {
                                        exoPlayer.pause()
                                    } else {
                                        exoPlayer.play()
                                    }
                                },
                                modifier = Modifier
                                    .size(64.dp)
                                    .background(CinepvqPrimary, CircleShape)
                            ) {
                                Icon(
                                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                    contentDescription = if (isPlaying) "Tạm dừng" else "Phát",
                                    tint = Color.White,
                                    modifier = Modifier.size(36.dp)
                                )
                            }

                            // Forward 10s
                            IconButton(
                                onClick = {
                                    exoPlayer.seekTo((exoPlayer.currentPosition + 10000L).coerceAtMost(exoPlayer.duration))
                                },
                                modifier = Modifier
                                    .size(48.dp)
                                    .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Forward10,
                                    contentDescription = "Tua đi 10s",
                                    tint = Color.White,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        }

                        // ── Bottom Controls Bar ──
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.BottomCenter)
                                .navigationBarsPadding()
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                        ) {
                            // Scrubber Slider
                            Slider(
                                value = if (durationMs > 0) currentPositionMs.toFloat() else 0f,
                                onValueChange = { pos ->
                                    currentPositionMs = pos.toLong()
                                    exoPlayer.seekTo(pos.toLong())
                                },
                                valueRange = 0f..durationMs.toFloat().coerceAtLeast(1f),
                                colors = SliderDefaults.colors(
                                    thumbColor = CinepvqPrimary,
                                    activeTrackColor = CinepvqPrimary,
                                    inactiveTrackColor = Color.White.copy(alpha = 0.3f)
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Time indicators
                                Text(
                                    text = "${formatDuration(currentPositionMs)} / ${formatDuration(durationMs)}",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    // Speed toggle
                                    TextButton(
                                        onClick = {
                                            val nextSpeed = when (currentPlaybackSpeed) {
                                                1.0f -> 1.25f
                                                1.25f -> 1.5f
                                                1.5f -> 2.0f
                                                2.0f -> 0.75f
                                                else -> 1.0f
                                            }
                                            currentPlaybackSpeed = nextSpeed
                                            exoPlayer.setPlaybackSpeed(nextSpeed)
                                        }
                                    ) {
                                        Text(
                                            text = "${currentPlaybackSpeed}x",
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    // Next Episode
                                    val nextEp = viewModel.getNextEpisode()
                                    if (nextEp != null) {
                                        IconButton(onClick = { onSwitchEpisode(slug, nextEp.slug) }) {
                                            Icon(
                                                imageVector = Icons.Default.SkipNext,
                                                contentDescription = "Tập tiếp theo",
                                                tint = Color.White
                                            )
                                        }
                                    }

                                    // Fullscreen Toggle
                                    IconButton(
                                        onClick = {
                                            onFullscreenToggle(!isFullscreen)
                                        }
                                    ) {
                                        Icon(
                                            imageVector = if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                                            contentDescription = "Toàn màn hình",
                                            tint = Color.White
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Stream Source Selector Modal ──────────────────────────────────────
        if (showSourceDialog) {
            AlertDialog(
                onDismissRequest = { showSourceDialog = false },
                title = { Text("Chọn Nguồn Phát", fontWeight = FontWeight.Bold, color = CinepvqTextPrimary) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        availableSources.forEach { source ->
                            val isSelected = source.sourceId == activeStream?.sourceId
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.switchStream(source)
                                        showSourceDialog = false
                                    },
                                colors = CardDefaults.cardColors(
                                    containerColor = if (isSelected) CinepvqPrimary.copy(alpha = 0.2f) else CinepvqSurfaceVariant
                                ),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(source.displayName, fontWeight = FontWeight.Bold, color = CinepvqTextPrimary)
                                        Text(source.name, fontSize = 11.sp, color = CinepvqTextMuted)
                                    }
                                    if (isSelected) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = CinepvqPrimary)
                                    }
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showSourceDialog = false }) {
                        Text("Đóng", color = CinepvqPrimary)
                    }
                },
                containerColor = CinepvqSurface
            )
        }
    }
}

private fun formatDuration(millis: Long): String {
    val totalSeconds = millis / 1000
    val seconds = totalSeconds % 60
    val minutes = (totalSeconds / 60) % 60
    val hours = totalSeconds / 3600
    return if (hours > 0) {
        String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.US, "%02d:%02d", minutes, seconds)
    }
}
