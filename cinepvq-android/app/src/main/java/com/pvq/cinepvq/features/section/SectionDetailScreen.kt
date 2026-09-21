package com.pvq.cinepvq.features.section

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pvq.cinepvq.core.designsystem.components.*
import com.pvq.cinepvq.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SectionDetailScreen(
    type: String,
    title: String? = null,
    onBackClick: () -> Unit,
    onMovieClick: (String) -> Unit,
    onBarsVisibilityChanged: ((Boolean) -> Unit)? = null,
    viewModel: SectionDetailViewModel = viewModel()
) {
    LaunchedEffect(type) {
        viewModel.initSection(type)
    }

    val movies by viewModel.movies.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val isLoadingMore by viewModel.isLoadingMore.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    val displayTitle = remember(type, title) {
        if (!title.isNullOrBlank()) title
        else when (type) {
            "phim-bo" -> "Phim Bộ Đặc Sắc"
            "phim-le" -> "Phim Điện Ảnh Chọn Lọc"
            "hoat-hinh" -> "Hoạt Hình & Anime"
            "tv-shows" -> "Chương Trình TV Show"
            "phim-moi", "latest" -> "Phim Mới Cập Nhật"
            "dang-chieu" -> "Phim Đang Chiếu Rạp"
            "thinh-hanh", "trending" -> "Bảng Xếp Hạng Thịnh Hành"
            else -> if (type.startsWith("the-loai/")) "Thể loại: " + type.removePrefix("the-loai/").replace("-", " ").replaceFirstChar { it.uppercase() }
            else if (type.startsWith("quoc-gia/")) "Quốc gia: " + type.removePrefix("quoc-gia/").replace("-", " ").replaceFirstChar { it.uppercase() }
            else type.replace("-", " ").replaceFirstChar { it.uppercase() }
        }
    }

    val gridState = rememberLazyGridState()

    TrackLazyGridScroll(
        gridState = gridState,
        threshold = 32,
        onVisibilityChanged = onBarsVisibilityChanged
    )

    // Detect when user scrolls near the end to trigger loadMore
    LaunchedEffect(gridState, movies, hasMore, isLoadingMore) {
        snapshotFlow {
            val layoutInfo = gridState.layoutInfo
            val totalItems = layoutInfo.totalItemsCount
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisibleIndex >= totalItems - 4
        }.collect { isNearBottom ->
            if (isNearBottom && hasMore && !isLoadingMore && movies.isNotEmpty()) {
                viewModel.loadMore()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
    ) {
        // Top App Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Quay lại",
                    tint = CinepvqTextPrimary
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = displayTitle,
                color = CinepvqTextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
        }

        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                isLoading && movies.isEmpty() -> {
                    LoadingView()
                }
                errorMessage != null && movies.isEmpty() -> {
                    ErrorView(
                        message = errorMessage ?: "Không thể tải danh sách phim",
                        onRetry = { viewModel.refresh() }
                    )
                }
                movies.isEmpty() -> {
                    EmptyView(message = "Không có phim nào trong mục này")
                }
                else -> {
                    LazyVerticalGrid(
                        state = gridState,
                        columns = GridCells.Adaptive(minSize = 105.dp),
                        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 88.dp, top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(movies, key = { it.slug }) { movie ->
                            MovieCard(
                                movie = movie,
                                width = 110.dp,
                                onClick = { onMovieClick(movie.slug) }
                            )
                        }

                        if (isLoadingMore) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        strokeWidth = 2.dp,
                                        color = CinepvqPrimary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
