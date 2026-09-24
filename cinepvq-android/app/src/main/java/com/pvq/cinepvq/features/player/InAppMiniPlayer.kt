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

/**
 * YouTube-style floating in-app mini player.
 *
 * Requirements:
 * - Floating overlay positioned in the bottom area above bottom nav.
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

    Surface(
        modifier = modifier
            .width(210.dp)
            .height(118.dp)
            .semantics { contentDescription = "In-App Mini Player" }
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                onExpand()
            },
        shape = RoundedCornerShape(12.dp),
        color = Color.Black,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f)),
        shadowElevation = 10.dp
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // ── Video Surface Layer ──────────────────────────────────────────
            if (activeStream?.type == StreamType.EMBED) {
                EmbedPlayerView(
                    url = activeStream!!.url,
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
                // Top-Left: Play / Pause Button (Clean, compact YouTube style)
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        .clip(CircleShape)
                        .clickable { playbackManager.togglePlayPause() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Tạm dừng" else "Phát",
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
