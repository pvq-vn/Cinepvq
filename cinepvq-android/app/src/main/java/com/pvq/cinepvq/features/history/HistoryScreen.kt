package com.pvq.cinepvq.features.history

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.pvq.cinepvq.core.designsystem.components.EmptyView
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import com.pvq.cinepvq.ui.theme.*

@Composable
fun HistoryScreen(
    onResumeMovie: (String, String?) -> Unit,
    onExploreClick: () -> Unit,
    viewModel: HistoryViewModel = viewModel()
) {
    val historyList by viewModel.history.collectAsStateWithLifecycle()
    var showClearConfirm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
    ) {
        // Title Bar with Clear All Action
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.History,
                    contentDescription = null,
                    tint = CinepvqPrimary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Lịch Sử Xem",
                    color = CinepvqTextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "(${historyList.size})",
                    color = CinepvqTextMuted,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Normal
                )
            }

            if (historyList.isNotEmpty()) {
                IconButton(onClick = { showClearConfirm = true }) {
                    Icon(
                        imageVector = Icons.Default.DeleteSweep,
                        contentDescription = "Xóa toàn bộ lịch sử",
                        tint = CinepvqTextMuted
                    )
                }
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            if (historyList.isEmpty()) {
                EmptyView(
                    message = "Bạn chưa xem bộ phim nào gần đây",
                    actionLabel = "Khám phá phim ngay",
                    onAction = onExploreClick
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 80.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(historyList, key = { it.slug }) { item ->
                        HistoryRowCard(
                            item = item,
                            onClick = { onResumeMovie(item.slug, item.episodeSlug) },
                            onDeleteClick = { viewModel.removeHistory(item.slug) }
                        )
                    }
                }
            }
        }
    }

    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            containerColor = CinepvqSurface,
            title = {
                Text("Xóa lịch sử xem", color = CinepvqTextPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            },
            text = {
                Text(
                    "Bạn có chắc muốn xóa toàn bộ lịch sử xem phim trên thiết bị này và đồng bộ về máy chủ không?",
                    color = CinepvqTextSecondary,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.clearHistory()
                        showClearConfirm = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CinepvqRed)
                ) {
                    Text("Xóa hết", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) {
                    Text("Hủy", color = CinepvqTextMuted)
                }
            }
        )
    }
}

@Composable
private fun HistoryRowCard(
    item: WatchHistoryItem,
    onClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(CinepvqSurface)
            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail with progress indicator
            Box(
                modifier = Modifier
                    .width(110.dp)
                    .height(66.dp)
                    .clip(RoundedCornerShape(8.dp))
            ) {
                AsyncImage(
                    model = item.thumbUrl,
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Play icon
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .align(Alignment.Center)
                        .background(Color.Black.copy(alpha = 0.65f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Progress Bar
                LinearProgressIndicator(
                    progress = { item.progressPercent },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .align(Alignment.BottomCenter),
                    color = CinepvqPrimary,
                    trackColor = Color.White.copy(alpha = 0.3f),
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Metadata Column
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    color = CinepvqTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = item.episodeName ?: "Tập 1",
                    color = CinepvqPrimaryLight,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(3.dp))

                val progressMinutes = item.currentTime / 60
                val durationMinutes = item.duration / 60
                Text(
                    text = if (durationMinutes > 0) "Đã xem $progressMinutes / $durationMinutes phút" else "Đã xem $progressMinutes phút",
                    color = CinepvqTextMuted,
                    fontSize = 11.sp
                )
            }

            // Remove button
            IconButton(
                onClick = onDeleteClick,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Xóa",
                    tint = CinepvqTextMuted,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
