package com.pvq.cinepvq.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pvq.cinepvq.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: SettingsViewModel = viewModel()
) {
    val settings by viewModel.playerSettings.collectAsStateWithLifecycle()

    var showSpeedDialog by remember { mutableStateOf(false) }
    var showSourceDialog by remember { mutableStateOf(false) }
    var showResolutionDialog by remember { mutableStateOf(false) }
    var showSeekDialog by remember { mutableStateOf(false) }

    val speedOptions = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 1.75f, 2.0f)
    val sourceOptions = listOf(
        "auto" to "Tự động (Ưu tiên nguồn nhanh nhất)",
        "k20" to "VIP 1 (K20)",
        "kkphim" to "VIP 2 (KKPhim)",
        "vsmov" to "Dự phòng 1 (VSMOV)",
        "nguonc" to "Dự phòng 2 (NguonC)"
    )
    val resolutionOptions = listOf(
        "auto" to "Tự động (Khuyên dùng)",
        "1080p" to "1080p (Full HD)",
        "720p" to "720p (HD)",
        "480p" to "480p (SD)",
        "360p" to "360p (Tiết kiệm dữ liệu)"
    )
    val seekOptions = listOf(5, 10, 15, 30)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Cài đặt",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = CinepvqTextPrimary
                        )
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Quay lại",
                            tint = CinepvqTextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CinepvqBackground
                )
            )
        },
        containerColor = CinepvqBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Group 1: Video Playback
            SettingsSectionHeader(title = "Trình phát & Trải nghiệm")
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, CinepvqBorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    SettingsItemRow(
                        icon = Icons.Default.Speed,
                        title = "Tốc độ phát mặc định",
                        value = "${settings.defaultPlaybackSpeed}x",
                        onClick = { showSpeedDialog = true }
                    )
                    HorizontalDivider(color = CinepvqBorderSubtle, modifier = Modifier.padding(horizontal = 16.dp))
                    SettingsItemRow(
                        icon = Icons.Default.FastForward,
                        title = "Thời gian tua nhanh/lùi",
                        value = "${settings.defaultSeekDuration} giây",
                        onClick = { showSeekDialog = true }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Group 2: Sources & Resolution
            SettingsSectionHeader(title = "Nguồn phát & Chất lượng")
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, CinepvqBorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    val currentSourceName = sourceOptions.firstOrNull { it.first == settings.defaultSource }?.second
                        ?: settings.defaultSource
                    SettingsItemRow(
                        icon = Icons.Default.Dns,
                        title = "Nguồn phát mặc định",
                        value = currentSourceName,
                        onClick = { showSourceDialog = true }
                    )
                    HorizontalDivider(color = CinepvqBorderSubtle, modifier = Modifier.padding(horizontal = 16.dp))
                    val currentResName = resolutionOptions.firstOrNull { it.first == settings.defaultResolution }?.second
                        ?: settings.defaultResolution
                    SettingsItemRow(
                        icon = Icons.Default.HighQuality,
                        title = "Độ phân giải mặc định",
                        value = currentResName,
                        onClick = { showResolutionDialog = true }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Group 3: Information
            SettingsSectionHeader(title = "Thông tin ứng dụng")
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, CinepvqBorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    SettingsInfoRow(
                        icon = Icons.Default.Info,
                        title = "Phiên bản",
                        value = "1.0.0 (Build 2026.09)"
                    )
                    HorizontalDivider(color = CinepvqBorderSubtle, modifier = Modifier.padding(horizontal = 16.dp))
                    SettingsInfoRow(
                        icon = Icons.Default.PlayCircle,
                        title = "Trình phát",
                        value = "ExoPlayer Media3"
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Dialog: Speed
    if (showSpeedDialog) {
        OptionSelectorDialog(
            title = "Chọn tốc độ phát mặc định",
            options = speedOptions.map { it to "${it}x" },
            selectedOption = settings.defaultPlaybackSpeed,
            onOptionSelected = {
                viewModel.setPlaybackSpeed(it)
                showSpeedDialog = false
            },
            onDismiss = { showSpeedDialog = false }
        )
    }

    // Dialog: Seek Duration
    if (showSeekDialog) {
        OptionSelectorDialog(
            title = "Chọn thời gian tua (giây)",
            options = seekOptions.map { it to "$it giây" },
            selectedOption = settings.defaultSeekDuration,
            onOptionSelected = {
                viewModel.setSeekDuration(it)
                showSeekDialog = false
            },
            onDismiss = { showSeekDialog = false }
        )
    }

    // Dialog: Source
    if (showSourceDialog) {
        OptionSelectorDialog(
            title = "Chọn nguồn phát mặc định",
            options = sourceOptions,
            selectedOption = settings.defaultSource,
            onOptionSelected = {
                viewModel.setSource(it)
                showSourceDialog = false
            },
            onDismiss = { showSourceDialog = false }
        )
    }

    // Dialog: Resolution
    if (showResolutionDialog) {
        OptionSelectorDialog(
            title = "Chọn độ phân giải mặc định",
            options = resolutionOptions,
            selectedOption = settings.defaultResolution,
            onOptionSelected = {
                viewModel.setResolution(it)
                showResolutionDialog = false
            },
            onDismiss = { showResolutionDialog = false }
        )
    }
}

@Composable
private fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge.copy(
            fontWeight = FontWeight.SemiBold,
            color = CinepvqPrimaryLight,
            letterSpacing = 0.5.sp
        ),
        modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
    )
}

@Composable
private fun SettingsItemRow(
    icon: ImageVector,
    title: String,
    value: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(CinepvqSurfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = CinepvqPrimary,
                modifier = Modifier.size(20.dp)
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.Medium,
                    color = CinepvqTextPrimary
                )
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = CinepvqTextSecondary
                )
            )
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = CinepvqTextMuted,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun SettingsInfoRow(
    icon: ImageVector,
    title: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(CinepvqSurfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = CinepvqTextMuted,
                modifier = Modifier.size(20.dp)
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.Medium,
                    color = CinepvqTextPrimary
                )
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = CinepvqTextSecondary
                )
            )
        }
    }
}

@Composable
private fun <T> OptionSelectorDialog(
    title: String,
    options: List<Pair<T, String>>,
    selectedOption: T,
    onOptionSelected: (T) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinepvqSurfaceElevated,
        titleContentColor = CinepvqTextPrimary,
        textContentColor = CinepvqTextSecondary,
        title = {
            Text(text = title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                options.forEach { (option, label) ->
                    val isSelected = option == selectedOption
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { onOptionSelected(option) }
                            .padding(vertical = 12.dp, horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = isSelected,
                            onClick = { onOptionSelected(option) },
                            colors = RadioButtonDefaults.colors(
                                selectedColor = CinepvqPrimary,
                                unselectedColor = CinepvqTextMuted
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = label,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                color = if (isSelected) CinepvqPrimaryLight else CinepvqTextPrimary,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                            )
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Đóng", color = CinepvqPrimaryLight)
            }
        }
    )
}
