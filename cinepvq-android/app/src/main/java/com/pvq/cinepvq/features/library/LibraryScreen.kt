package com.pvq.cinepvq.features.library

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.pvq.cinepvq.core.designsystem.components.EmptyView
import com.pvq.cinepvq.core.designsystem.utils.EpisodeDisplayFormatter
import com.pvq.cinepvq.domain.model.FavoriteMovie
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import com.pvq.cinepvq.domain.model.WatchLaterItem
import com.pvq.cinepvq.ui.theme.*

fun LibraryTab.icon(): ImageVector = when (this) {
    LibraryTab.FAVORITES -> Icons.Default.Favorite
    LibraryTab.HISTORY -> Icons.Default.History
    LibraryTab.WATCH_LATER -> Icons.Default.Bookmark
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    initialTab: Int? = null,
    onMovieClick: (String) -> Unit,
    onResumeMovie: (String, String?) -> Unit,
    onExploreClick: () -> Unit,
    onBarsVisibilityChanged: ((Boolean) -> Unit)? = null,
    viewModel: LibraryViewModel = viewModel()
) {
    var hasAppliedInitialTab by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(initialTab) {
        if (initialTab != null && !hasAppliedInitialTab) {
            val target = when (initialTab) {
                1 -> LibraryTab.HISTORY
                2 -> LibraryTab.WATCH_LATER
                else -> LibraryTab.FAVORITES
            }
            viewModel.selectTab(target)
            hasAppliedInitialTab = true
        }
    }

    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    val watchLater by viewModel.watchLater.collectAsStateWithLifecycle()

    val displayedFavorites by viewModel.displayedFavorites.collectAsStateWithLifecycle()
    val hasMoreFavorites by viewModel.hasMoreFavorites.collectAsStateWithLifecycle()

    val displayedHistory by viewModel.displayedHistory.collectAsStateWithLifecycle()
    val hasMoreHistory by viewModel.hasMoreHistory.collectAsStateWithLifecycle()

    val displayedWatchLater by viewModel.displayedWatchLater.collectAsStateWithLifecycle()
    val hasMoreWatchLater by viewModel.hasMoreWatchLater.collectAsStateWithLifecycle()

    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()

    var showClearHistoryDialog by remember { mutableStateOf(false) }
    var showClearFavoritesDialog by remember { mutableStateOf(false) }
    var showClearWatchLaterDialog by remember { mutableStateOf(false) }

    val favGridState = rememberLazyGridState()
    val histListState = rememberLazyListState()
    val watchLaterGridState = rememberLazyGridState()

    // Sentinel for Favorites viewport loading
    LaunchedEffect(favGridState, hasMoreFavorites) {
        snapshotFlow {
            val total = favGridState.layoutInfo.totalItemsCount
            val lastVisible = favGridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible to total
        }.collect { (lastVisible, total) ->
            if (total > 0 && lastVisible >= total - 4 && hasMoreFavorites) {
                viewModel.loadMoreFavorites()
            }
        }
    }

    // Sentinel for History viewport loading
    LaunchedEffect(histListState, hasMoreHistory) {
        snapshotFlow {
            val total = histListState.layoutInfo.totalItemsCount
            val lastVisible = histListState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible to total
        }.collect { (lastVisible, total) ->
            if (total > 0 && lastVisible >= total - 4 && hasMoreHistory) {
                viewModel.loadMoreHistory()
            }
        }
    }

    // Sentinel for Watch Later viewport loading
    LaunchedEffect(watchLaterGridState, hasMoreWatchLater) {
        snapshotFlow {
            val total = watchLaterGridState.layoutInfo.totalItemsCount
            val lastVisible = watchLaterGridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible to total
        }.collect { (lastVisible, total) ->
            if (total > 0 && lastVisible >= total - 4 && hasMoreWatchLater) {
                viewModel.loadMoreWatchLater()
            }
        }
    }

    var isHeaderCollapsed by remember { mutableStateOf(false) }
    var lastScrollIndex by remember { mutableIntStateOf(0) }
    var lastScrollOffset by remember { mutableIntStateOf(0) }

    // Scroll tracking & collapsing header controller
    val currentScrollPair by remember(selectedTab) {
        derivedStateOf {
            when (selectedTab) {
                LibraryTab.FAVORITES -> favGridState.firstVisibleItemIndex to favGridState.firstVisibleItemScrollOffset
                LibraryTab.HISTORY -> histListState.firstVisibleItemIndex to histListState.firstVisibleItemScrollOffset
                LibraryTab.WATCH_LATER -> watchLaterGridState.firstVisibleItemIndex to watchLaterGridState.firstVisibleItemScrollOffset
            }
        }
    }

    LaunchedEffect(currentScrollPair) {
        val (index, offset) = currentScrollPair
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

    val currentHasItems = when (selectedTab) {
        LibraryTab.FAVORITES -> favorites.isNotEmpty()
        LibraryTab.HISTORY -> history.isNotEmpty()
        LibraryTab.WATCH_LATER -> watchLater.isNotEmpty()
    }

    val onDeleteClick = {
        when (selectedTab) {
            LibraryTab.FAVORITES -> showClearFavoritesDialog = true
            LibraryTab.HISTORY -> showClearHistoryDialog = true
            LibraryTab.WATCH_LATER -> showClearWatchLaterDialog = true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
    ) {
        // ── Full Header ───────────────────────────────────────────────────────
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Thư Viện Của Bạn",
                            color = CinepvqTextPrimary,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${favorites.size} yêu thích • ${history.size} đã xem • ${watchLater.size} xem sau",
                            color = CinepvqTextMuted,
                            fontSize = 11.5.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }

                    // Trash icon button for ALL 3 tabs (Uniform styling)
                    if (currentHasItems) {
                        IconButton(
                            onClick = onDeleteClick,
                            modifier = Modifier
                                .size(36.dp)
                                .background(CinepvqSurfaceVariant, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.DeleteOutline,
                                contentDescription = "Xóa toàn bộ",
                                tint = CinepvqRed,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Redesigned Tabs: 3 Tabs on single row, Pill active, Minimal inactive, NO counts
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CinepvqSurface, RoundedCornerShape(12.dp))
                        .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    LibraryTab.entries.forEach { tab ->
                        val isSelected = selectedTab == tab
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) CinepvqPrimary else Color.Transparent)
                                .clickable { viewModel.selectTab(tab) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = tab.icon(),
                                    contentDescription = null,
                                    tint = if (isSelected) Color.White else CinepvqTextSecondary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = tab.title,
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
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Compact Title: Only "Thư viện của bạn"
                    Text(
                        text = "Thư viện của bạn",
                        color = CinepvqTextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Cohesive compact navigation control with 3 icons
                        Row(
                            modifier = Modifier
                                .background(CinepvqSurfaceVariant, RoundedCornerShape(20.dp))
                                .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(20.dp))
                                .padding(3.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            LibraryTab.entries.forEach { tab ->
                                val isSelected = selectedTab == tab
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clip(CircleShape)
                                        .background(if (isSelected) CinepvqPrimary else Color.Transparent)
                                        .clickable { viewModel.selectTab(tab) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = tab.icon(),
                                        contentDescription = tab.title,
                                        tint = if (isSelected) Color.White else CinepvqTextSecondary,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }

                        if (currentHasItems) {
                            IconButton(
                                onClick = onDeleteClick,
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.DeleteOutline,
                                    contentDescription = "Xóa",
                                    tint = CinepvqRed,
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ── Main Content Area ─────────────────────────────────────────────────
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize()
        ) {
            when (selectedTab) {
                LibraryTab.FAVORITES -> {
                    if (favorites.isEmpty()) {
                        EmptyView(
                            message = "Chưa có phim trong danh sách yêu thích",
                            actionLabel = "Khám phá ngay",
                            onAction = onExploreClick
                        )
                    } else {
                        LazyVerticalGrid(
                            state = favGridState,
                            columns = GridCells.Adaptive(minSize = 105.dp),
                            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 88.dp, top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(displayedFavorites, key = { it.slug }) { fav ->
                                LibraryFavoriteCard(
                                    item = fav,
                                    onClick = { onMovieClick(fav.slug) },
                                    onRemove = { viewModel.removeFavorite(fav.slug) }
                                )
                            }
                            if (hasMoreFavorites) {
                                item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            color = CinepvqPrimary,
                                            strokeWidth = 2.dp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                LibraryTab.HISTORY -> {
                    if (history.isEmpty()) {
                        EmptyView(
                            message = "Chưa có lịch sử xem phim nào",
                            actionLabel = "Xem phim ngay",
                            onAction = onExploreClick
                        )
                    } else {
                        LazyColumn(
                            state = histListState,
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 88.dp, top = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(displayedHistory, key = { it.slug }) { item ->
                                LibraryHistoryCard(
                                    item = item,
                                    onResume = { onResumeMovie(item.slug, item.episodeSlug) },
                                    onRemove = { viewModel.removeHistory(item.slug) }
                                )
                            }
                            if (hasMoreHistory) {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            color = CinepvqPrimary,
                                            strokeWidth = 2.dp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                LibraryTab.WATCH_LATER -> {
                    if (watchLater.isEmpty()) {
                        EmptyView(
                            message = "Danh sách xem sau đang trống",
                            actionLabel = "Khám phá phim",
                            onAction = onExploreClick
                        )
                    } else {
                        LazyVerticalGrid(
                            state = watchLaterGridState,
                            columns = GridCells.Adaptive(minSize = 105.dp),
                            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 88.dp, top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(displayedWatchLater, key = { it.slug }) { item ->
                                LibraryWatchLaterCard(
                                    item = item,
                                    onClick = { onMovieClick(item.slug) },
                                    onRemove = { viewModel.removeWatchLater(item.slug) }
                                )
                            }
                            if (hasMoreWatchLater) {
                                item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            color = CinepvqPrimary,
                                            strokeWidth = 2.dp
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

    // ── Delete Confirmation Dialogs ───────────────────────────────────────────
    if (showClearHistoryDialog) {
        AlertDialog(
            onDismissRequest = { showClearHistoryDialog = false },
            title = { Text("Xóa toàn bộ lịch sử?", color = CinepvqTextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Toàn bộ tiến độ và phim đã xem sẽ bị xóa khỏi tài khoản của bạn.", color = CinepvqTextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    showClearHistoryDialog = false
                    viewModel.clearHistory()
                }) {
                    Text("Xác nhận xóa", color = CinepvqRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearHistoryDialog = false }) {
                    Text("Hủy", color = CinepvqTextSecondary)
                }
            },
            containerColor = CinepvqSurface
        )
    }

    if (showClearFavoritesDialog) {
        AlertDialog(
            onDismissRequest = { showClearFavoritesDialog = false },
            title = { Text("Xóa toàn bộ yêu thích?", color = CinepvqTextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Tất cả phim yêu thích sẽ được gỡ khỏi danh sách của bạn.", color = CinepvqTextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    showClearFavoritesDialog = false
                    viewModel.clearFavorites()
                }) {
                    Text("Xác nhận xóa", color = CinepvqRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearFavoritesDialog = false }) {
                    Text("Hủy", color = CinepvqTextSecondary)
                }
            },
            containerColor = CinepvqSurface
        )
    }

    if (showClearWatchLaterDialog) {
        AlertDialog(
            onDismissRequest = { showClearWatchLaterDialog = false },
            title = { Text("Xóa danh sách xem sau?", color = CinepvqTextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Tất cả các phim lưu xem sau sẽ bị xóa hoàn toàn.", color = CinepvqTextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    showClearWatchLaterDialog = false
                    viewModel.clearWatchLater()
                }) {
                    Text("Xác nhận xóa", color = CinepvqRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearWatchLaterDialog = false }) {
                    Text("Hủy", color = CinepvqTextSecondary)
                }
            },
            containerColor = CinepvqSurface
        )
    }
}

// ── Standardized Movie Card with strictly uniform height & 2:3 aspect ratio ──

@Composable
private fun LibraryFavoriteCard(
    item: FavoriteMovie,
    onClick: () -> Unit,
    onRemove: () -> Unit
) {
    val context = LocalContext.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CinepvqSurface)
            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(2f / 3f)
                    .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(item.thumbUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Remove button
                IconButton(
                    onClick = onRemove,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(28.dp)
                        .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Xóa",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }

                if (!item.quality.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(6.dp)
                            .background(CinepvqPrimary, RoundedCornerShape(4.dp))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    ) {
                        Text(
                            text = item.quality,
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Fixed height text container guarantees uniform grid alignment across all items
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = item.name,
                    color = CinepvqTextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = if (!item.currentEpisode.isNullOrBlank()) EpisodeDisplayFormatter.format(item.currentEpisode) else " ",
                    color = CinepvqTextMuted,
                    fontSize = 10.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun LibraryWatchLaterCard(
    item: WatchLaterItem,
    onClick: () -> Unit,
    onRemove: () -> Unit
) {
    val context = LocalContext.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CinepvqSurface)
            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(2f / 3f)
                    .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(item.thumbUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Bookmark Icon Badge
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .background(CinepvqPrimary.copy(alpha = 0.85f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Bookmark,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(12.dp)
                    )
                }

                // Remove button
                IconButton(
                    onClick = onRemove,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(28.dp)
                        .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Xóa khỏi xem sau",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Fixed height text container guarantees uniform grid alignment across all items
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = item.name,
                    color = CinepvqTextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = if (!item.originalName.isNullOrBlank()) item.originalName else " ",
                    color = CinepvqTextMuted,
                    fontSize = 10.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun LibraryHistoryCard(
    item: WatchHistoryItem,
    onResume: () -> Unit,
    onRemove: () -> Unit
) {
    val context = LocalContext.current
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = CinepvqSurface,
        border = androidx.compose.foundation.BorderStroke(1.dp, CinepvqBorderSubtle),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onResume)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail with Progress bar
            Box(
                modifier = Modifier
                    .width(100.dp)
                    .aspectRatio(16f / 9f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(CinepvqSurfaceVariant)
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(item.thumbUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Play Icon Overlay
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(CinepvqPrimary.copy(alpha = 0.9f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Xem tiếp",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Bottom Progress Bar
                if (item.duration > 0) {
                    val progressFraction = (item.currentTime.toFloat() / item.duration.toFloat()).coerceIn(0f, 1f)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .align(Alignment.BottomCenter)
                            .background(Color.White.copy(alpha = 0.2f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(progressFraction)
                                .background(CinepvqPrimary)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    color = CinepvqTextPrimary,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (!item.episodeName.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Đang xem: ${EpisodeDisplayFormatter.format(item.episodeName)}",
                        color = CinepvqPrimaryLight,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                val timeStr = if (item.duration > 0) {
                    val currentMin = item.currentTime / 60
                    val totalMin = item.duration / 60
                    "$currentMin / $totalMin phút"
                } else {
                    "Chưa cập nhật thời lượng"
                }

                Text(
                    text = timeStr,
                    color = CinepvqTextMuted,
                    fontSize = 10.5.sp
                )
            }

            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Xóa khỏi lịch sử",
                    tint = CinepvqTextMuted,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}
