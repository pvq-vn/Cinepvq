package com.pvq.cinepvq.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.pvq.cinepvq.core.network.model.AppVersionDto
import com.pvq.cinepvq.core.update.UpdateUiState
import com.pvq.cinepvq.ui.theme.*
import java.io.File
import java.util.Locale

@Composable
fun UpdateDialog(
    state: UpdateUiState,
    onStartDownload: (AppVersionDto) -> Unit,
    onInstall: (File) -> Unit,
    onDismiss: () -> Unit
) {
    if (state is UpdateUiState.Idle || state is UpdateUiState.Checking) {
        return
    }

    val isForced = when (state) {
        is UpdateUiState.UpdateAvailable -> state.isForced
        is UpdateUiState.Downloading -> state.versionInfo.forceUpdate
        is UpdateUiState.ReadyToInstall -> state.versionInfo.forceUpdate
        is UpdateUiState.Error -> state.versionInfo?.forceUpdate ?: false
        else -> false
    }

    Dialog(
        onDismissRequest = {
            if (!isForced) {
                onDismiss()
            }
        },
        properties = DialogProperties(
            dismissOnBackPress = !isForced,
            dismissOnClickOutside = !isForced
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            shape = RoundedCornerShape(24.dp),
            color = CinepvqSurface,
            tonalElevation = 8.dp,
            border = CardDefaults.outlinedCardBorder().copy(
                brush = androidx.compose.ui.graphics.SolidColor(CinepvqBorder)
            )
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                when (state) {
                    is UpdateUiState.UpdateAvailable -> {
                        UpdateAvailableContent(
                            versionInfo = state.versionInfo,
                            isForced = state.isForced,
                            onUpdateClick = { onStartDownload(state.versionInfo) },
                            onDismissClick = onDismiss
                        )
                    }

                    is UpdateUiState.Downloading -> {
                        DownloadingContent(
                            progress = state.progress,
                            bytesDownloaded = state.bytesDownloaded,
                            totalBytes = state.totalBytes
                        )
                    }

                    is UpdateUiState.ReadyToInstall -> {
                        ReadyToInstallContent(
                            versionInfo = state.versionInfo,
                            isForced = state.versionInfo.forceUpdate,
                            onInstallClick = { onInstall(state.apkFile) },
                            onDismissClick = onDismiss
                        )
                    }

                    is UpdateUiState.Error -> {
                        ErrorContent(
                            message = state.message,
                            canRetry = state.canRetry,
                            versionInfo = state.versionInfo,
                            onRetryClick = {
                                state.versionInfo?.let { onStartDownload(it) }
                            },
                            onDismissClick = onDismiss
                        )
                    }

                    else -> {}
                }
            }
        }
    }
}

@Composable
private fun UpdateAvailableContent(
    versionInfo: AppVersionDto,
    isForced: Boolean,
    onUpdateClick: () -> Unit,
    onDismissClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(CinepvqBadge),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.SystemUpdate,
            contentDescription = null,
            tint = CinepvqPrimary,
            modifier = Modifier.size(28.dp)
        )
    }

    Spacer(modifier = Modifier.height(16.dp))

    Text(
        text = "Đã có bản cập nhật mới",
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        color = CinepvqTextPrimary,
        textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(6.dp))

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = CinepvqPrimaryContainer
        ) {
            Text(
                text = "Phiên bản ${versionInfo.versionName}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = CinepvqPrimaryLight,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }

        if (isForced) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = CinepvqRed.copy(alpha = 0.2f)
            ) {
                Text(
                    text = "Bắt buộc",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = CinepvqRed,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }

    if (versionInfo.changelog.isNotEmpty()) {
        Spacer(modifier = Modifier.height(16.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(CinepvqSurfaceVariant.copy(alpha = 0.6f))
                .padding(14.dp)
                .heightIn(max = 160.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = "Nội dung cập nhật:",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = CinepvqTextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            versionInfo.changelog.forEach { note ->
                Row(
                    modifier = Modifier.padding(vertical = 2.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text = "• ",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = CinepvqPrimary
                    )
                    Text(
                        text = note,
                        fontSize = 12.sp,
                        color = CinepvqTextPrimary,
                        lineHeight = 18.sp
                    )
                }
            }
        }
    }

    Spacer(modifier = Modifier.height(24.dp))

    Button(
        onClick = onUpdateClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary)
    ) {
        Icon(
            imageVector = Icons.Default.Download,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "Cập nhật ngay",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White
        )
    }

    if (!isForced) {
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(
            onClick = onDismissClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
        ) {
            Text(
                text = "Để sau",
                fontSize = 13.sp,
                color = CinepvqTextSecondary
            )
        }
    }
}

@Composable
private fun DownloadingContent(
    progress: Float,
    bytesDownloaded: Long,
    totalBytes: Long
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(CinepvqBadge),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Download,
            contentDescription = null,
            tint = CinepvqPrimary,
            modifier = Modifier.size(28.dp)
        )
    }

    Spacer(modifier = Modifier.height(16.dp))

    Text(
        text = "Đang tải bản cập nhật...",
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        color = CinepvqTextPrimary,
        textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(8.dp))

    Text(
        text = "Vui lòng giữ ứng dụng mở trong giây lát",
        fontSize = 12.sp,
        color = CinepvqTextSecondary,
        textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(20.dp))

    if (progress >= 0f) {
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = CinepvqPrimary,
            trackColor = CinepvqSurfaceVariant
        )
    } else {
        LinearProgressIndicator(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = CinepvqPrimary,
            trackColor = CinepvqSurfaceVariant
        )
    }

    Spacer(modifier = Modifier.height(12.dp))

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        val downloadedMb = bytesDownloaded.toDouble() / (1024 * 1024)
        if (totalBytes > 0) {
            val totalMb = totalBytes.toDouble() / (1024 * 1024)
            val percent = (progress * 100).toInt().coerceIn(0, 100)
            Text(
                text = String.format(Locale.US, "%.1f / %.1f MB", downloadedMb, totalMb),
                fontSize = 12.sp,
                color = CinepvqTextSecondary
            )
            Text(
                text = "$percent%",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = CinepvqPrimary
            )
        } else {
            Text(
                text = String.format(Locale.US, "%.1f MB", downloadedMb),
                fontSize = 12.sp,
                color = CinepvqTextSecondary
            )
            Text(
                text = "Đang tải...",
                fontSize = 12.sp,
                color = CinepvqPrimary
            )
        }
    }

    Spacer(modifier = Modifier.height(12.dp))

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            imageVector = Icons.Default.Security,
            contentDescription = null,
            tint = CinepvqGreen,
            modifier = Modifier.size(14.dp)
        )
        Text(
            text = "Tự động xác thực mã SHA-256 sau khi tải",
            fontSize = 11.sp,
            color = CinepvqTextMuted
        )
    }
}

@Composable
private fun ReadyToInstallContent(
    versionInfo: AppVersionDto,
    isForced: Boolean,
    onInstallClick: () -> Unit,
    onDismissClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(CinepvqGreen.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            tint = CinepvqGreen,
            modifier = Modifier.size(28.dp)
        )
    }

    Spacer(modifier = Modifier.height(16.dp))

    Text(
        text = "Tải về hoàn tất!",
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        color = CinepvqTextPrimary,
        textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(8.dp))

    Text(
        text = "Bản cập nhật v${versionInfo.versionName} đã sẵn sàng cài đặt. Dữ liệu cá nhân, lịch sử xem và yêu thích sẽ được bảo toàn nguyên vẹn.",
        fontSize = 13.sp,
        color = CinepvqTextSecondary,
        textAlign = TextAlign.Center,
        lineHeight = 18.sp
    )

    Spacer(modifier = Modifier.height(24.dp))

    Button(
        onClick = onInstallClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = CinepvqGreen)
    ) {
        Text(
            text = "Cài đặt ngay",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White
        )
    }

    if (!isForced) {
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(
            onClick = onDismissClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
        ) {
            Text(
                text = "Để sau",
                fontSize = 13.sp,
                color = CinepvqTextSecondary
            )
        }
    }
}

@Composable
private fun ErrorContent(
    message: String,
    canRetry: Boolean,
    versionInfo: AppVersionDto?,
    onRetryClick: () -> Unit,
    onDismissClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(CinepvqRed.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            tint = CinepvqRed,
            modifier = Modifier.size(28.dp)
        )
    }

    Spacer(modifier = Modifier.height(16.dp))

    Text(
        text = "Không thể cập nhật",
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        color = CinepvqTextPrimary,
        textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(8.dp))

    Text(
        text = message,
        fontSize = 13.sp,
        color = CinepvqTextSecondary,
        textAlign = TextAlign.Center,
        lineHeight = 18.sp
    )

    Spacer(modifier = Modifier.height(24.dp))

    if (canRetry && versionInfo != null) {
        Button(
            onClick = onRetryClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary)
        ) {
            Text(
                text = "Thử lại",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
    }

    TextButton(
        onClick = onDismissClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(40.dp)
    ) {
        Text(
            text = "Đóng",
            fontSize = 13.sp,
            color = CinepvqTextSecondary
        )
    }
}
