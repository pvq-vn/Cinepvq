package com.pvq.cinepvq.features.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.ui.theme.*

// Supported playback speed options
val PLAYBACK_SPEED_OPTIONS = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)

// Supported resolution options
enum class VideoResolution(val label: String, val shortLabel: String, val maxLines: Int) {
    AUTO("Tự động (Khuyên dùng)", "Tự động", Int.MAX_VALUE),
    FHD("1080p (FHD)", "1080p", 1080),
    HD("720p (HD)", "720p", 720),
    SD("480p (SD)", "480p", 480),
    LOW("360p (Tiết kiệm data)", "360p", 360)
}

enum class SettingsSubLevel {
    MAIN,
    SPEED,
    RESOLUTION
}

/**
 * 2-Level Bottom Sheet for Player Settings:
 * Level 1: Tốc độ phát > 1.0x, Độ phân giải > Tự động
 * Level 2: Sub-setting lists with Back < and X buttons
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerSettingsBottomSheet(
    currentSpeed: Float,
    onSpeedChange: (Float) -> Unit,
    currentResolution: VideoResolution,
    onResolutionChange: (VideoResolution) -> Unit,
    onDismiss: () -> Unit
) {
    var currentLevel by remember { mutableStateOf(SettingsSubLevel.MAIN) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CinepvqSurface,
        tonalElevation = 12.dp,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(CinepvqBorder)
            )
        },
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
        ) {
            // FIXED HEADER (Pinned at top of container, close X never scrolls away)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                when (currentLevel) {
                    SettingsSubLevel.MAIN -> {
                        Text(
                            text = "Cài đặt phát",
                            color = CinepvqTextPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    SettingsSubLevel.SPEED -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            IconButton(
                                onClick = { currentLevel = SettingsSubLevel.MAIN },
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(CinepvqSurfaceVariant, CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Quay lại",
                                    tint = CinepvqTextPrimary,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            Text(
                                text = "Tốc độ phát",
                                color = CinepvqTextPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    SettingsSubLevel.RESOLUTION -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            IconButton(
                                onClick = { currentLevel = SettingsSubLevel.MAIN },
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(CinepvqSurfaceVariant, CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Quay lại",
                                    tint = CinepvqTextPrimary,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            Text(
                                text = "Độ phân giải",
                                color = CinepvqTextPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .size(32.dp)
                        .background(CinepvqSurfaceVariant, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = CinepvqTextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            HorizontalDivider(color = CinepvqBorderSubtle, thickness = 1.dp)

            // SCROLLABLE CONTENT BODY (Only content scrolls)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                when (currentLevel) {
                    SettingsSubLevel.MAIN -> {
                        SettingsNavigationItem(
                            icon = Icons.Default.Speed,
                            title = "Tốc độ phát",
                            currentValue = if (currentSpeed == 1.0f) "1.0x (Chuẩn)" else "${currentSpeed}x",
                            onClick = { currentLevel = SettingsSubLevel.SPEED }
                        )

                        SettingsNavigationItem(
                            icon = Icons.Default.HighQuality,
                            title = "Độ phân giải",
                            currentValue = currentResolution.shortLabel,
                            onClick = { currentLevel = SettingsSubLevel.RESOLUTION }
                        )
                    }
                    SettingsSubLevel.SPEED -> {
                        PLAYBACK_SPEED_OPTIONS.forEach { speed ->
                            val isSelected = currentSpeed == speed
                            SettingOptionRow(
                                label = if (speed == 1.0f) "1.0x (Chuẩn)" else "${speed}x",
                                isSelected = isSelected,
                                onClick = {
                                    onSpeedChange(speed)
                                    currentLevel = SettingsSubLevel.MAIN
                                }
                            )
                        }
                    }
                    SettingsSubLevel.RESOLUTION -> {
                        VideoResolution.entries.forEach { res ->
                            val isSelected = currentResolution == res
                            SettingOptionRow(
                                label = res.label,
                                isSelected = isSelected,
                                onClick = {
                                    onResolutionChange(res)
                                    currentLevel = SettingsSubLevel.MAIN
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

/**
 * Bottom Sheet for Video Source Switching
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerSourceBottomSheet(
    sources: List<StreamSource>,
    activeSource: StreamSource?,
    onSelectSource: (StreamSource) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CinepvqSurface,
        tonalElevation = 12.dp,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(CinepvqBorder)
            )
        },
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 12.dp)
                ) {
                    Text(
                        text = "Nguồn phát video",
                        color = CinepvqTextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Chọn nguồn phát dự phòng nếu video bị gián đoạn",
                        color = CinepvqTextMuted,
                        fontSize = 12.sp
                    )
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .size(32.dp)
                        .background(CinepvqSurfaceVariant, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = CinepvqTextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            HorizontalDivider(color = CinepvqBorderSubtle, thickness = 1.dp)

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sources) { source ->
                    val isSelected = source.sourceId == activeSource?.sourceId
                    val isHls = source.type == StreamType.HLS_DIRECT

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSelected) CinepvqPrimary.copy(alpha = 0.15f) else CinepvqSurfaceVariant)
                            .border(
                                width = 1.dp,
                                color = if (isSelected) CinepvqPrimary else CinepvqBorderSubtle,
                                shape = RoundedCornerShape(12.dp)
                            )
                            .clickable {
                                onSelectSource(source)
                                onDismiss()
                            }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                imageVector = if (isHls) Icons.Default.Stream else Icons.Default.Public,
                                contentDescription = null,
                                tint = if (isSelected) CinepvqPrimary else CinepvqTextMuted,
                                modifier = Modifier.size(22.dp)
                            )
                            Column {
                                Text(
                                    text = source.displayName,
                                    color = if (isSelected) CinepvqTextPrimary else CinepvqTextSecondary,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = if (isHls) "Phát trực tiếp HLS (Mượt, tùy chỉnh đầy đủ)" else "Trình phát nhúng dự phòng",
                                    color = CinepvqTextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Đang chọn",
                                tint = CinepvqPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

/**
 * Bottom Sheet for Audio / Language / Server Selection
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerAudioLanguageBottomSheet(
    servers: List<EpisodeServer>,
    selectedServerIndex: Int,
    onSelectServer: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CinepvqSurface,
        tonalElevation = 12.dp,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(CinepvqBorder)
            )
        },
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 12.dp)
                ) {
                    Text(
                        text = "Ngôn ngữ & Âm thanh",
                        color = CinepvqTextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Chọn bản dịch, lồng tiếng hoặc máy chủ phát",
                        color = CinepvqTextMuted,
                        fontSize = 12.sp
                    )
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .size(32.dp)
                        .background(CinepvqSurfaceVariant, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = CinepvqTextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            HorizontalDivider(color = CinepvqBorderSubtle, thickness = 1.dp)

            if (servers.isEmpty()) {
                Text(
                    text = "Không có tùy chọn âm thanh bổ sung",
                    color = CinepvqTextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp)
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(servers.size) { index ->
                        val server = servers[index]
                        val isSelected = index == selectedServerIndex

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) CinepvqPrimary.copy(alpha = 0.15f) else CinepvqSurfaceVariant)
                                .border(
                                    width = 1.dp,
                                    color = if (isSelected) CinepvqPrimary else CinepvqBorderSubtle,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable {
                                    onSelectServer(index)
                                    onDismiss()
                                }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Audiotrack,
                                    contentDescription = null,
                                    tint = if (isSelected) CinepvqPrimary else CinepvqTextMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                                Column {
                                    Text(
                                        text = server.serverName,
                                        color = if (isSelected) CinepvqTextPrimary else CinepvqTextSecondary,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 14.sp
                                    )
                                    Text(
                                        text = "${server.items.size} tập khả dụng",
                                        color = CinepvqTextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                            }

                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Đang chọn",
                                    tint = CinepvqPrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

// ── Private Helper UI Components ──────────────────────────────────────────

@Composable
private fun SettingsTabItem(
    title: String,
    icon: ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) CinepvqPrimary else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) Color.White else CinepvqTextSecondary,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = title,
                color = if (isSelected) Color.White else CinepvqTextSecondary,
                fontSize = 13.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}

@Composable
private fun SettingsNavigationItem(
    icon: ImageVector,
    title: String,
    currentValue: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CinepvqSurfaceVariant)
            .border(
                width = 1.dp,
                color = CinepvqBorderSubtle,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = CinepvqTextSecondary,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = title,
                color = CinepvqTextPrimary,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = currentValue,
                color = CinepvqPrimary,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp
            )
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = CinepvqTextMuted,
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

@Composable
private fun SettingOptionRow(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isSelected) CinepvqPrimary.copy(alpha = 0.15f) else CinepvqSurfaceVariant)
            .border(
                width = 1.dp,
                color = if (isSelected) CinepvqPrimary else CinepvqBorderSubtle,
                shape = RoundedCornerShape(10.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = if (isSelected) CinepvqTextPrimary else CinepvqTextSecondary,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            fontSize = 14.sp
        )

        if (isSelected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Đã chọn",
                tint = CinepvqPrimary,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}
