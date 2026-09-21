package com.pvq.cinepvq.features.player

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.ui.theme.*
import java.util.Locale

/**
 * Clean, cinematic Player Controls Overlay.
 *
 * Implements:
 * - Single continuous seekbar track (thin razor when controls hidden; interactive with small thumb when visible)
 * - Removed purple endpoint dot on track
 * - Clean icon-only buttons with 44dp hit targets (NO circular backgrounds or heavy borders)
 * - Prominent center Play/Pause hero button
 * - Dedicated Fullscreen control bar (seekbar above minimal bottom icons, no cluttering text pills)
 * - Compact web-inspired Audio Sync warning banner
 * - Screen Lock overlay with transient hint
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerControls(
    isVisible: Boolean,
    movie: MovieDetail?,
    episode: EpisodeItem?,
    isPlaying: Boolean,
    currentPositionMs: Long,
    durationMs: Long,
    isFullscreen: Boolean,
    hasPrevious: Boolean,
    hasNext: Boolean,
    activeStream: StreamSource?,
    availableSources: List<StreamSource>,
    servers: List<EpisodeServer>,
    selectedServerIndex: Int,
    isFavorite: Boolean = false,
    isWatchLater: Boolean = false,
    isScreenLocked: Boolean = false,
    showLockHint: Boolean = false,
    showSyncWarning: Boolean = false,
    showLanguageButton: Boolean = true,
    showQuickEpisodeSelector: Boolean = false,
    allEpisodes: List<EpisodeItem> = emptyList(),
    onTogglePlayPause: () -> Unit,
    onSeekTo: (Long) -> Unit,
    onPreviousClick: () -> Unit,
    onNextClick: () -> Unit,
    onTopExitClick: () -> Unit,
    onFullscreenToggle: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenSources: () -> Unit,
    onOpenAudioLanguage: () -> Unit,
    onToggleLock: () -> Unit = {},
    onDismissLockHint: () -> Unit = {},
    onShowLockHint: () -> Unit = {},
    onDismissSyncWarning: () -> Unit = {},
    onToggleFavorite: () -> Unit = {},
    onToggleWatchLater: () -> Unit = {},
    onOpenComments: () -> Unit = {},
    onShareClick: () -> Unit = {},
    onToggleQuickEpisodes: () -> Unit = {},
    onSelectQuickEpisode: (EpisodeItem) -> Unit = {},
    onDismissControls: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var isDraggingSlider by remember { mutableStateOf(false) }
    var dragPositionMs by remember { mutableLongStateOf(0L) }

    Box(modifier = modifier.fillMaxSize()) {
        // ── 1. Thin Bottom Progress Line (ONLY when controls are HIDDEN & not locked) ──
        if (!isVisible && !isScreenLocked) {
            val progressFraction = if (durationMs > 0) {
                (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
            } else 0f

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .height(2.5.dp)
                    .background(Color.White.copy(alpha = 0.15f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(progressFraction)
                        .background(CinepvqPrimary)
                )
            }
        }

        // ── 2. Screen Locked Overlay ──
        if (isScreenLocked) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) {
                        onShowLockHint()
                    }
            ) {
                // Transient Lock Hint Pill
                AnimatedVisibility(
                    visible = showLockHint,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut(),
                    modifier = Modifier.align(Alignment.Center)
                ) {
                    Surface(
                        shape = RoundedCornerShape(24.dp),
                        color = Color.Black.copy(alpha = 0.85f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)),
                        shadowElevation = 8.dp
                    ) {
                        Row(
                            modifier = Modifier
                                .clickable { onToggleLock() }
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = CinepvqPrimaryLight,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = "Màn hình đã khóa — Chạm để mở khóa",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
            return@Box
        }

        // ── 3. Full Controls Overlay ──
        AnimatedVisibility(
            visible = isVisible,
            enter = fadeIn(tween(200)),
            exit = fadeOut(tween(200)),
            modifier = Modifier.fillMaxSize()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.45f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) {
                        onDismissControls()
                    }
            ) {
                // ── Top Bar with Gradient Scrim ──
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Black.copy(alpha = 0.85f),
                                    Color.Black.copy(alpha = 0.4f),
                                    Color.Transparent
                                )
                            )
                        )
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) {}
                        .padding(
                            top = if (isFullscreen) 16.dp else 4.dp,
                            bottom = 16.dp,
                            start = if (isFullscreen) 20.dp else 12.dp,
                            end = if (isFullscreen) 20.dp else 12.dp
                        )
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        PlayerTopBar(
                            movieTitle = movie?.name ?: "",
                            episodeName = episode?.name ?: "",
                            isFullscreen = isFullscreen,
                            showLanguageButton = showLanguageButton,
                            onExitClick = onTopExitClick,
                            onOpenAudioLanguage = onOpenAudioLanguage,
                            onOpenSources = onOpenSources,
                            onOpenSettings = onOpenSettings,
                            onToggleLock = onToggleLock
                        )

                        // Compact Audio Sync Warning Banner
                        if (showSyncWarning) {
                            Spacer(modifier = Modifier.height(8.dp))
                            AudioSyncWarningBanner(onDismiss = onDismissSyncWarning)
                        }
                    }
                }

                // ── Center Controls [Previous] [Play/Pause] [Next] ──
                Row(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) {}
                        .padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(36.dp)
                ) {
                    // Previous Episode Button (Clean, no circle border)
                    IconButton(
                        onClick = onPreviousClick,
                        enabled = hasPrevious,
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.SkipPrevious,
                            contentDescription = "Tập trước",
                            tint = if (hasPrevious) Color.White else Color.White.copy(alpha = 0.3f),
                            modifier = Modifier.size(28.dp)
                        )
                    }

                    // Play / Pause Hero Button (Prominent violet gradient treatment)
                    IconButton(
                        onClick = onTogglePlayPause,
                        modifier = Modifier
                            .size(64.dp)
                            .background(
                                brush = CinepvqBrandGradient,
                                shape = CircleShape
                            )
                            .border(
                                width = 1.5.dp,
                                color = Color.White.copy(alpha = 0.35f),
                                shape = CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Tạm dừng" else "Phát",
                            tint = Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    // Next Episode Button (Clean, no circle border)
                    IconButton(
                        onClick = onNextClick,
                        enabled = hasNext,
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.SkipNext,
                            contentDescription = "Tập tiếp theo",
                            tint = if (hasNext) Color.White else Color.White.copy(alpha = 0.3f),
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }

                // ── Bottom Scrubber & Controls ──
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.5f),
                                    Color.Black.copy(alpha = 0.95f)
                                )
                            )
                        )
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) {}
                        .padding(
                            bottom = if (isFullscreen) 10.dp else 4.dp,
                            start = if (isFullscreen) 20.dp else 12.dp,
                            end = if (isFullscreen) 20.dp else 12.dp
                        )
                ) {
                    // In Fullscreen: Quick Episode Selector popover if toggled
                    if (isFullscreen && showQuickEpisodeSelector && allEpisodes.isNotEmpty()) {
                        PlayerQuickEpisodeSelector(
                            episodes = allEpisodes,
                            currentEpisodeSlug = episode?.slug ?: "",
                            onSelectEpisode = onSelectQuickEpisode,
                            onClose = onToggleQuickEpisodes
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                    }

                    // ── 1. Interactive Seekbar Track (Positioned ABOVE action icons) ──
                    val currentSliderValue = if (isDraggingSlider) {
                        dragPositionMs.toFloat()
                    } else {
                        if (durationMs > 0) currentPositionMs.toFloat() else 0f
                    }
                    val maxRange = durationMs.toFloat().coerceAtLeast(1f)

                    Slider(
                        value = currentSliderValue.coerceIn(0f, maxRange),
                        onValueChange = { pos ->
                            isDraggingSlider = true
                            dragPositionMs = pos.toLong()
                        },
                        onValueChangeFinished = {
                            isDraggingSlider = false
                            onSeekTo(dragPositionMs)
                        },
                        valueRange = 0f..maxRange,
                        thumb = {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .background(CinepvqPrimary, CircleShape)
                                    .border(1.5.dp, Color.White, CircleShape)
                            )
                        },
                        track = { sliderState ->
                            SliderDefaults.Track(
                                sliderState = sliderState,
                                drawStopIndicator = null, // REMOVES endpoint purple dot
                                colors = SliderDefaults.colors(
                                    activeTrackColor = CinepvqPrimary,
                                    inactiveTrackColor = Color.White.copy(alpha = 0.25f)
                                ),
                                modifier = Modifier.height(3.5.dp)
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(24.dp)
                    )

                    // ── 2. Bottom Row: Timestamps & Action Icons ──
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Timestamps: 11:46 / 38:27
                        val displayPosition = if (isDraggingSlider) dragPositionMs else currentPositionMs
                        Text(
                            text = "${formatDuration(displayPosition)} / ${formatDuration(durationMs)}",
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )

                        // Action buttons (Icon-only, no circles, web style)
                        if (isFullscreen) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                // Episode Selector Icon
                                if (allEpisodes.isNotEmpty()) {
                                    IconButton(
                                        onClick = onToggleQuickEpisodes,
                                        modifier = Modifier.size(44.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.ViewList,
                                            contentDescription = "Chọn tập",
                                            tint = if (showQuickEpisodeSelector) CinepvqPrimary else Color.White.copy(alpha = 0.9f),
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }

                                // Favorite Icon
                                IconButton(
                                    onClick = onToggleFavorite,
                                    modifier = Modifier.size(44.dp)
                                ) {
                                    Icon(
                                        imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                        contentDescription = "Yêu thích",
                                        tint = if (isFavorite) CinepvqRed else Color.White.copy(alpha = 0.9f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // Watch Later Icon
                                IconButton(
                                    onClick = onToggleWatchLater,
                                    modifier = Modifier.size(44.dp)
                                ) {
                                    Icon(
                                        imageVector = if (isWatchLater) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                                        contentDescription = "Xem sau",
                                        tint = if (isWatchLater) CinepvqPrimaryLight else Color.White.copy(alpha = 0.9f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // Comments Icon
                                IconButton(
                                    onClick = onOpenComments,
                                    modifier = Modifier.size(44.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Comment,
                                        contentDescription = "Bình luận",
                                        tint = Color.White.copy(alpha = 0.9f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // Share Icon
                                IconButton(
                                    onClick = onShareClick,
                                    modifier = Modifier.size(44.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Share,
                                        contentDescription = "Chia sẻ",
                                        tint = Color.White.copy(alpha = 0.9f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // Fullscreen Exit Icon
                                IconButton(
                                    onClick = onFullscreenToggle,
                                    modifier = Modifier.size(44.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.FullscreenExit,
                                        contentDescription = "Thu nhỏ màn hình",
                                        tint = Color.White,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }
                        } else {
                            // Portrait: Enter Fullscreen Icon
                            IconButton(
                                onClick = onFullscreenToggle,
                                modifier = Modifier.size(44.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Fullscreen,
                                    contentDescription = "Toàn màn hình",
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
}

// ── Sub-Components ────────────────────────────────────────────────────────

@Composable
private fun PlayerTopBar(
    movieTitle: String,
    episodeName: String,
    isFullscreen: Boolean,
    showLanguageButton: Boolean,
    onExitClick: () -> Unit,
    onOpenAudioLanguage: () -> Unit,
    onOpenSources: () -> Unit,
    onOpenSettings: () -> Unit,
    onToggleLock: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Left Area: Down arrow icon + Title in Fullscreen (clean icon, no circle border)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f, fill = false)
        ) {
            IconButton(
                onClick = onExitClick,
                modifier = Modifier.size(44.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.KeyboardArrowDown,
                    contentDescription = if (isFullscreen) "Thoát toàn màn hình" else "Thu nhỏ",
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }

            if (isFullscreen && movieTitle.isNotBlank()) {
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f, fill = false)) {
                    Text(
                        text = movieTitle,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (episodeName.isNotBlank()) {
                        val displayEpisode = com.pvq.cinepvq.core.designsystem.utils.EpisodeDisplayFormatter.format(episodeName)
                        Text(
                            text = displayEpisode,
                            color = CinepvqPrimaryLight,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Right Area: Clean Icon-Only Buttons (Lock, Language, Source, Settings)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            // Lock Screen Button (Fullscreen only)
            if (isFullscreen) {
                IconButton(
                    onClick = onToggleLock,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LockOpen,
                        contentDescription = "Khóa màn hình",
                        tint = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Language / Audio Icon-only Button
            if (showLanguageButton) {
                IconButton(
                    onClick = onOpenAudioLanguage,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Translate,
                        contentDescription = "Ngôn ngữ",
                        tint = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Video Source Icon-only Button
            IconButton(
                onClick = onOpenSources,
                modifier = Modifier.size(44.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Dns,
                    contentDescription = "Nguồn phát",
                    tint = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.size(20.dp)
                )
            }

            // Settings Button
            IconButton(
                onClick = onOpenSettings,
                modifier = Modifier.size(44.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Cài đặt",
                    tint = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

/**
 * Compact, web-styled audio sync warning banner.
 * Uses semi-transparent dark rounded capsule, amber border, small info icon and compact dismiss X.
 */
@Composable
private fun AudioSyncWarningBanner(
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = CircleShape,
            color = Color(0xFF0C0A09).copy(alpha = 0.92f),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.35f)),
            shadowElevation = 8.dp
        ) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 12.dp, vertical = 6.dp)
                    .widthIn(max = 480.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = Color(0xFFFBBF24),
                    modifier = Modifier.size(14.dp)
                )
                Text(
                    text = "Thời gian giữa các bản có thể không đồng bộ. Bạn có thể tự điều chỉnh nếu cần.",
                    color = Color(0xFFFDE68A),
                    fontSize = 12.sp,
                    lineHeight = 15.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(20.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = Color.White.copy(alpha = 0.7f),
                        modifier = Modifier.size(12.dp)
                    )
                }
            }
        }
    }
}

/**
 * Formats a duration in milliseconds to HH:MM:SS or MM:SS format.
 */
private fun formatDuration(millis: Long): String {
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
