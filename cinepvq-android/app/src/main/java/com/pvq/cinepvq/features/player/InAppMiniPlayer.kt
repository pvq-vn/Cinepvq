package com.pvq.cinepvq.features.player

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerView
import com.pvq.cinepvq.data.player.PlaybackManager
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.player.embed.EmbedPlayerView

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.IntOffset
import kotlin.math.roundToInt

/**
 * YouTube-style floating in-app mini player.
 *
 * Requirements:
 * - Floating overlay positioned in the bottom area above bottom nav.
 * - Draggable: user can hold and move player to different areas on screen.
 * - Controls: ONLY Play/Pause (top-left) and Close 'X' (top-right).
 * - Tapping anywhere on the video restores full player to its previous presentation orientation.
 * - Does not recreate player, reload stream, or reset playback position.
 */
@OptIn(UnstableApi::class)
@Composable
fun InAppMiniPlayer(
    playbackManager: PlaybackManager,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isPlaying by playbackManager.isPlaying.collectAsStateWithLifecycle()
    val activeStream by playbackManager.activeStream.collectAsStateWithLifecycle()

    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val screenWidthPx = with(density) { configuration.screenWidthDp.dp.toPx() }
    val screenHeightPx = with(density) { configuration.screenHeightDp.dp.toPx() }
    val viewConfig = LocalViewConfiguration.current
    val miniWidthPx = with(density) { 210.dp.toPx() }
    val miniHeightPx = with(density) { 118.dp.toPx() }

    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    val touchSlop = viewConfig.touchSlop

    Surface(
        modifier = modifier
            .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
            .width(210.dp)
            .height(118.dp)
            .semantics { contentDescription = "In-App Mini Player" }
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    var isDrag = false
                    var totalDist = 0f
                    val pointerId = down.id

                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == pointerId } ?: break
                        if (change.changedToUp()) {
                            if (!isDrag) {
                                onExpand()
                            }
                            break
                        }
                        val posChange = change.positionChange()
                        totalDist += posChange.getDistance()
                        if (totalDist > touchSlop) {
                            isDrag = true
                        }
                        if (isDrag) {
                            change.consume()
                            val minX = -(screenWidthPx - miniWidthPx - 24.dp.toPx())
                            val maxX = 16.dp.toPx()
                            val minY = -(screenHeightPx - miniHeightPx - 100.dp.toPx())
                            val maxY = 60.dp.toPx()
                            offsetX = (offsetX + posChange.x).coerceIn(minX, maxX)
                            offsetY = (offsetY + posChange.y).coerceIn(minY, maxY)
                        }
                    }
                }
            },
        shape = RoundedCornerShape(12.dp),
        color = Color.Black,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f)),
        shadowElevation = 10.dp
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            val currentStream = activeStream
            if (currentStream?.type == StreamType.EMBED) {
                AndroidView(
                    factory = { ctx ->
                        val container = object : FrameLayout(ctx) {
                            override fun onInterceptTouchEvent(ev: android.view.MotionEvent?): Boolean = true
                            override fun onTouchEvent(event: android.view.MotionEvent?): Boolean = false
                        }.apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            setBackgroundColor(android.graphics.Color.BLACK)
                        }
                        val wv = playbackManager.cachedEmbedWebView
                            ?: playbackManager.getOrCreateEmbedWebView(ctx, currentStream.url).first
                        (wv.parent as? ViewGroup)?.removeView(wv)
                        wv.layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        container.addView(wv)
                        wv.onResume()
                        container
                    },
                    update = { container ->
                        val wv = playbackManager.cachedEmbedWebView
                            ?: playbackManager.getOrCreateEmbedWebView(container.context, currentStream.url).first
                        if (wv.parent !== container) {
                            (wv.parent as? ViewGroup)?.removeView(wv)
                            wv.layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            container.addView(wv)
                            wv.onResume()
                        }
                    },
                    onRelease = { container ->
                        container.removeAllViews()
                    },
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(12.dp))
                )
            } else {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = playbackManager.exoPlayer
                            useController = false
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    update = { playerView ->
                        if (playerView.player !== playbackManager.exoPlayer) {
                            playerView.player = playbackManager.exoPlayer
                        }
                    },
                    onRelease = { playerView ->
                        playerView.player = null
                    },
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(12.dp))
                )
            }

            // ── Subtle Top Gradient Scrim for Controls ──────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(36.dp)
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Black.copy(alpha = 0.5f),
                                Color.Transparent
                            )
                        )
                    )
            )

            // ── Top Micro-Controls: [Play/Pause] on top-left, [Close X] on top-right ──
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 6.dp)
                    .align(Alignment.TopCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Top-Left: Play / Pause Button (Clean, compact YouTube style - works universally)
                val isEmbedPlaying by playbackManager.isEmbedPlaying.collectAsStateWithLifecycle()
                val isVideoPlaying = if (activeStream?.type == StreamType.EMBED) {
                    isEmbedPlaying || !playbackManager.userPausedManually
                } else isPlaying

                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        .clip(CircleShape)
                        .clickable {
                            playbackManager.togglePlayPause()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isVideoPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isVideoPlaying) "Tạm dừng" else "Phát",
                        tint = Color.White,
                        modifier = Modifier.size(15.dp)
                    )
                }

                // Top-Right: Close 'X' Button (Clean, compact YouTube style)
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        .clip(CircleShape)
                        .clickable { playbackManager.closePlayback() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng mini player",
                        tint = Color.White,
                        modifier = Modifier.size(15.dp)
                    )
                }
            }
        }
    }
}
