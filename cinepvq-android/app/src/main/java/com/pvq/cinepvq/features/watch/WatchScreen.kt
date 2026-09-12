package com.pvq.cinepvq.features.watch

import android.content.pm.ActivityInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pvq.cinepvq.core.designsystem.components.ErrorView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.features.detail.DetailViewModel
import com.pvq.cinepvq.features.player.PlayerScreen
import com.pvq.cinepvq.ui.theme.*

private const val CHUNK_SIZE = 30

@Composable
fun WatchScreen(
    slug: String,
    initialEpisodeSlug: String,
    initialServerName: String? = null,
    initialEmbedUrl: String? = null,
    onBackClick: () -> Unit,
    onNavigateToMovie: (String) -> Unit,
    viewModel: DetailViewModel = viewModel()
) {
    val context = LocalContext.current
    val activity = context as? ComponentActivity

    LaunchedEffect(slug) {
        viewModel.loadMovie(slug)
    }

    val movie by viewModel.movieDetail.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val selectedServerIndex by viewModel.selectedServerIndex.collectAsStateWithLifecycle()

    var activeChunkIndex by remember { mutableIntStateOf(0) }
    var currentEpisodeSlug by remember { mutableStateOf(initialEpisodeSlug) }
    var currentServerName by remember { mutableStateOf(initialServerName) }
    var currentEmbedUrl by remember { mutableStateOf(initialEmbedUrl) }

    // This handles fullscreen toggles from within the Player
    var isFullscreen by remember { mutableStateOf(false) }

    BackHandler {
        if (isFullscreen) {
            isFullscreen = false
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        } else {
            onBackClick()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .then(if (isFullscreen) Modifier else Modifier.statusBarsPadding())
    ) {
        // Player Section (Sticky at the top)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (isFullscreen) Modifier.fillMaxSize() else Modifier.aspectRatio(16f / 9f))
                .background(Color.Black)
        ) {
            PlayerScreen(
                slug = slug,
                episodeSlug = currentEpisodeSlug,
                serverName = currentServerName,
                embedUrl = currentEmbedUrl,
                isFullscreen = isFullscreen,
                onFullscreenToggle = { fullscreen ->
                    isFullscreen = fullscreen
                    activity?.requestedOrientation = if (fullscreen) {
                        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    }
                },
                onBackClick = onBackClick,
                onSwitchEpisode = { _, epSlug ->
                    currentEpisodeSlug = epSlug
                }
            )
        }

        // When fullscreen is active, hide the details
        if (!isFullscreen) {
            Box(modifier = Modifier.weight(1f)) {
                when {
                    isLoading && movie == null -> LoadingView()
                    errorMessage != null && movie == null -> ErrorView(
                        message = errorMessage ?: "Không thể tải danh sách tập phim",
                        onRetry = { viewModel.loadMovie(slug) }
                    )
                    movie != null -> {
                        val detail = movie!!
                        val currentServer = detail.episodes.getOrNull(selectedServerIndex)
                            ?: detail.episodes.firstOrNull()
                        val allEpisodes = currentServer?.items ?: emptyList()

                        // Episode chunks
                        val totalChunks = if (allEpisodes.isNotEmpty()) (allEpisodes.size + CHUNK_SIZE - 1) / CHUNK_SIZE else 1
                        val safeChunk = activeChunkIndex.coerceIn(0, (totalChunks - 1).coerceAtLeast(0))
                        val displayedEpisodes = allEpisodes.drop(safeChunk * CHUNK_SIZE).take(CHUNK_SIZE)

                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 40.dp)
                        ) {
                            item {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp)
                                ) {
                                    Text(
                                        text = detail.name,
                                        color = CinepvqTextPrimary,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    val currentEpData = allEpisodes.find { it.slug == currentEpisodeSlug }
                                    if (currentEpData != null) {
                                        Text(
                                            text = "Đang xem: Tập ${currentEpData.name}",
                                            color = CinepvqPrimaryLight,
                                            fontSize = 14.sp,
                                            modifier = Modifier.padding(top = 4.dp)
                                        )
                                    }
                                }
                            }

                            // ── Audio / Server Switcher Tabs ──
                            if (detail.episodes.size > 1) {
                                item {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 16.dp, vertical = 8.dp)
                                    ) {
                                        Text(
                                            text = "Máy chủ & Thuyết minh",
                                            color = CinepvqTextPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(bottom = 8.dp)
                                        )

                                        LazyRow(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            itemsIndexed(detail.episodes) { index, server ->
                                                val isSelected = index == selectedServerIndex
                                                FilterChip(
                                                    selected = isSelected,
                                                    onClick = {
                                                        viewModel.selectServer(index)
                                                        activeChunkIndex = 0
                                                    },
                                                    label = {
                                                        Text(
                                                            text = server.serverName,
                                                            fontSize = 12.sp,
                                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                                        )
                                                    },
                                                    colors = FilterChipDefaults.filterChipColors(
                                                        containerColor = CinepvqSurface,
                                                        labelColor = CinepvqTextSecondary,
                                                        selectedContainerColor = CinepvqPrimary,
                                                        selectedLabelColor = Color.White
                                                    ),
                                                    border = FilterChipDefaults.filterChipBorder(
                                                        enabled = true,
                                                        selected = isSelected,
                                                        borderColor = if (isSelected) CinepvqPrimary else CinepvqBorderSubtle
                                                    ),
                                                    shape = RoundedCornerShape(8.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // ── Episode List with Chunk Tabs ──
                            if (allEpisodes.isNotEmpty()) {
                                item {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 16.dp, vertical = 8.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "Danh sách tập phim",
                                                color = CinepvqTextPrimary,
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Text(
                                                text = "${allEpisodes.size} tập",
                                                color = CinepvqTextMuted,
                                                fontSize = 12.sp
                                            )
                                        }

                                        // Chunk Tabs (if total episodes > 30)
                                        if (totalChunks > 1) {
                                            Spacer(modifier = Modifier.height(10.dp))
                                            LazyRow(
                                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                items(totalChunks) { chunkIdx ->
                                                    val start = chunkIdx * CHUNK_SIZE + 1
                                                    val end = ((chunkIdx + 1) * CHUNK_SIZE).coerceAtMost(allEpisodes.size)
                                                    val isSelected = chunkIdx == safeChunk

                                                    Box(
                                                        modifier = Modifier
                                                            .clip(RoundedCornerShape(6.dp))
                                                            .background(if (isSelected) CinepvqPrimary.copy(alpha = 0.2f) else CinepvqSurface)
                                                            .border(
                                                                1.dp,
                                                                if (isSelected) CinepvqPrimary else CinepvqBorderSubtle,
                                                                RoundedCornerShape(6.dp)
                                                            )
                                                            .clickable { activeChunkIndex = chunkIdx }
                                                            .padding(horizontal = 10.dp, vertical = 6.dp)
                                                    ) {
                                                        Text(
                                                            text = "$start - $end",
                                                            color = if (isSelected) CinepvqPrimaryLight else CinepvqTextSecondary,
                                                            fontSize = 11.sp,
                                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(12.dp))

                                        // Episode Pills Grid (5 columns)
                                        val chunkedRows = displayedEpisodes.chunked(5)
                                        chunkedRows.forEach { rowItems ->
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(vertical = 4.dp),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                rowItems.forEach { ep ->
                                                    val isCurrentPlay = currentEpisodeSlug == ep.slug
                                                    Box(
                                                        modifier = Modifier
                                                            .weight(1f)
                                                            .height(38.dp)
                                                            .clip(RoundedCornerShape(8.dp))
                                                            .background(
                                                                if (isCurrentPlay) CinepvqPrimary.copy(alpha = 0.2f) else CinepvqSurface
                                                            )
                                                            .border(
                                                                1.dp,
                                                                if (isCurrentPlay) CinepvqPrimary else CinepvqBorderSubtle,
                                                                RoundedCornerShape(8.dp)
                                                            )
                                                            .clickable {
                                                                currentServerName = currentServer?.serverName
                                                                currentEmbedUrl = ep.embed
                                                                currentEpisodeSlug = ep.slug
                                                            },
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Text(
                                                            text = ep.name,
                                                            color = if (isCurrentPlay) CinepvqPrimaryLight else CinepvqTextPrimary,
                                                            fontSize = 12.sp,
                                                            fontWeight = if (isCurrentPlay) FontWeight.Bold else FontWeight.Medium,
                                                            maxLines = 1,
                                                            overflow = TextOverflow.Ellipsis
                                                        )
                                                    }
                                                }
                                                repeat(5 - rowItems.size) {
                                                    Spacer(modifier = Modifier.weight(1f))
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
