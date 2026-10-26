package com.pvq.cinepvq.features.trending

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
fun TrendingScreen(
    onMovieClick: (String) -> Unit,
    onBarsVisibilityChanged: ((Boolean) -> Unit)? = null,
    viewModel: TrendingViewModel = viewModel()
) {
    val activeTab by viewModel.activeTab.collectAsStateWithLifecycle()
    val movies by viewModel.movies.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    val top15 = remember(movies) { movies.take(15) }
    val listState = rememberLazyListState()
    val compactRowState = rememberLazyListState()

    var isHeaderCollapsed by remember { mutableStateOf(false) }
    var lastScrollIndex by remember { mutableIntStateOf(0) }
    var lastScrollOffset by remember { mutableIntStateOf(0) }

    LaunchedEffect(activeTab, isHeaderCollapsed) {
        if (isHeaderCollapsed) {
            val targetIndex = TrendingTab.entries.indexOf(activeTab)
            if (targetIndex >= 0) {
                compactRowState.animateScrollToItem(targetIndex)
            }
        }
    }

    LaunchedEffect(listState) {
        snapshotFlow {
            listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset
        }.collect { (index, offset) ->
            val isAtTop = index == 0 && offset < 20
            if (isAtTop) {
                if (isHeaderCollapsed) isHeaderCollapsed = false
                onBarsVisibilityChanged?.invoke(true)
            } else {
                val isScrollingDown = index > lastScrollIndex || (index == lastScrollIndex && offset > lastScrollOffset + 15)
                val isScrollingUp = index < lastScrollIndex || (index == lastScrollIndex && offset < lastScrollOffset - 15)

                if (isScrollingDown) {
                    if (!isHeaderCollapsed) isHeaderCollapsed = true
                    onBarsVisibilityChanged?.invoke(false)
                } else if (isScrollingUp) {
                    onBarsVisibilityChanged?.invoke(true)
                }
            }
            lastScrollIndex = index
            lastScrollOffset = offset
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
    ) {
        // ── Header Area: Full vs Compact Sticky Header ────────────────────────
        AnimatedVisibility(
            visible = !isHeaderCollapsed,
            enter = expandVertically(animationSpec = tween(250)) + fadeIn(),
            exit = shrinkVertically(animationSpec = tween(200)) + fadeOut()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                // Section Tag
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(CinepvqAmber.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Whatshot,
                            contentDescription = null,
                            tint = CinepvqAmber,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Bảng xếp hạng xu hướng",
                            color = CinepvqAmber,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Thịnh Hành & Bảng Xếp Hạng",
                    color = CinepvqTextPrimary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )

                Text(
                    text = "Các tác phẩm điện ảnh và truyền hình đang thu hút khán giả nhất",
                    color = CinepvqTextMuted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 2.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Full Category Tabs Strip
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(horizontal = 2.dp)
                ) {
                    items(TrendingTab.entries.toTypedArray(), key = { it.name }) { tab ->
                        val isSelected = activeTab == tab
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isSelected) {
                                        Brush.horizontalGradient(listOf(CinepvqAmber, Color(0xFFEF4444)))
                                    } else {
                                        Brush.linearGradient(listOf(CinepvqSurface, CinepvqSurface))
                                    }
                                )
                                .border(
                                    width = 1.dp,
                                    color = if (isSelected) Color.Transparent else CinepvqBorderSubtle,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable { viewModel.selectTab(tab) }
                                .padding(horizontal = 14.dp, vertical = 7.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(text = tab.icon, fontSize = 13.sp)
                                Text(
                                    text = tab.label,
                                    color = if (isSelected) Color.White else CinepvqTextSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }

        // ── Compact Sticky Header on Scroll ──────────────────────────────────
        AnimatedVisibility(
            visible = isHeaderCollapsed,
            enter = expandVertically(animationSpec = tween(200)) + fadeIn(),
            exit = shrinkVertically(animationSpec = tween(180)) + fadeOut()
        ) {
            Surface(
                color = CinepvqSurface,
                shadowElevation = 4.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Tag "Bảng xếp hạng xu hướng"
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(CinepvqAmber.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Whatshot,
                                contentDescription = null,
                                tint = CinepvqAmber,
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = "Bảng xếp hạng xu hướng",
                                color = CinepvqAmber,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // Compact Category Tabs
                    LazyRow(
                        state = compactRowState,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        contentPadding = PaddingValues(start = 8.dp)
                    ) {
                        items(TrendingTab.entries.toTypedArray(), key = { it.name }) { tab ->
                            val isSelected = activeTab == tab
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(
                                        if (isSelected) {
                                            Brush.horizontalGradient(listOf(CinepvqAmber, Color(0xFFEF4444)))
                                        } else {
                                            Brush.linearGradient(listOf(CinepvqSurfaceVariant, CinepvqSurfaceVariant))
                                        }
                                    )
                                    .clickable { viewModel.selectTab(tab) }
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(text = tab.icon, fontSize = 11.sp)
                                    Text(
                                        text = tab.label,
                                        color = if (isSelected) Color.White else CinepvqTextSecondary,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Main Content: Unified Top 15 Ranking ─────────────────────────────
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
                        message = errorMessage ?: "Không thể tải bảng xếp hạng",
                        onRetry = { viewModel.refresh() }
                    )
                }
                movies.isEmpty() -> {
                    EmptyView(message = "Chưa có dữ liệu bảng xếp hạng")
                }
                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        // Header title above continuous list
                        item {
                            Text(
                                text = "Bảng Xếp Hạng Top 15 — ${activeTab.label}",
                                color = CinepvqTextPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 12.dp)
                            )
                        }

                        // Unified Top 15 Grid (3 items per row, continuous rank 1..15)
                        val chunked = top15.chunked(3)
                        items(chunked) { rowItems ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                rowItems.forEach { movie ->
                                    val rank = top15.indexOf(movie) + 1
                                    Box(modifier = Modifier.weight(1f)) {
                                        MovieCard(
                                            movie = movie,
                                            variant = MovieCardVariant.RANKING,
                                            rank = rank,
                                            width = 120.dp,
                                            onClick = { onMovieClick(movie.slug) }
                                        )
                                    }
                                }
                                repeat(3 - rowItems.size) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }

                        // Bottom Spacer for navigation bar clearance
                        item {
                            Spacer(modifier = Modifier.height(72.dp))
                        }
                    }
                }
            }
        }
    }
}
