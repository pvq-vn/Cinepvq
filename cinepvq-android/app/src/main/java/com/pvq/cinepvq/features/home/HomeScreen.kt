package com.pvq.cinepvq.features.home

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.distinctUntilChanged
import com.pvq.cinepvq.core.designsystem.components.*
import com.pvq.cinepvq.domain.model.Movie
import com.pvq.cinepvq.ui.theme.*

private val QUICK_GENRES = listOf(
    "Hành Động" to "hanh-dong",
    "Tình Cảm" to "tinh-cam",
    "Hài Hước" to "phim-hai",
    "Cổ Trang" to "co-trang",
    "Kinh Dị" to "kinh-di",
    "Viễn Tưởng" to "khoa-hoc-vien-tuong",
    "Tâm Lý" to "tam-ly",
    "Hình Sự" to "hinh-su"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onMovieClick: (String) -> Unit,
    onContinueWatchingClick: (String, String?) -> Unit,
    onCategoryClick: ((String) -> Unit)? = null,
    onSearchClick: (() -> Unit)? = null,
    onProfileClick: (() -> Unit)? = null,
    onHistoryClick: (() -> Unit)? = null,
    isTopBarVisible: Boolean = true,
    onBarsVisibilityChanged: ((Boolean) -> Unit)? = null,
    viewModel: HomeViewModel = viewModel()
) {
    // ─── Batch 1 States ──────────────────────────────────────────────
    val latestMovies by viewModel.latestMovies.collectAsStateWithLifecycle()
    val seriesMovies by viewModel.seriesMovies.collectAsStateWithLifecycle()
    val continueWatching by viewModel.continueWatching.collectAsStateWithLifecycle()

    // ─── Batch 2 States ──────────────────────────────────────────────
    val singleMovies by viewModel.singleMovies.collectAsStateWithLifecycle()
    val animeMovies by viewModel.animeMovies.collectAsStateWithLifecycle()
    val tvShowsMovies by viewModel.tvShowsMovies.collectAsStateWithLifecycle()
    val isBatch2Loaded by viewModel.isBatch2Loaded.collectAsStateWithLifecycle()
    val isBatch2Loading by viewModel.isBatch2Loading.collectAsStateWithLifecycle()

    // ─── Batch 3 States ──────────────────────────────────────────────
    val actionMovies by viewModel.actionMovies.collectAsStateWithLifecycle()
    val westernMovies by viewModel.westernMovies.collectAsStateWithLifecycle()
    val koreanMovies by viewModel.koreanMovies.collectAsStateWithLifecycle()
    val isBatch3Loaded by viewModel.isBatch3Loaded.collectAsStateWithLifecycle()
    val isBatch3Loading by viewModel.isBatch3Loading.collectAsStateWithLifecycle()

    // ─── Screen States ───────────────────────────────────────────────
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val isLoggedIn by viewModel.isLoggedIn.collectAsStateWithLifecycle()

    val heroMovies = remember(latestMovies) { latestMovies.take(6) }
    val trendingMovies = remember(latestMovies) { latestMovies.take(10) }

    val listState = rememberLazyListState()
    val density = LocalDensity.current

    // Viewport Sentinel: Trigger Batch 2 & Batch 3 progressively when user actually scrolls near the bottom of loaded batches
    LaunchedEffect(listState) {
        snapshotFlow {
            val total = listState.layoutInfo.totalItemsCount
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible to total
        }
        .distinctUntilChanged()
        .collect { (lastVisible, total) ->
            if (total > 0) {
                val b2Loaded = viewModel.isBatch2Loaded.value
                val b2Loading = viewModel.isBatch2Loading.value
                val b3Loaded = viewModel.isBatch3Loaded.value
                val b3Loading = viewModel.isBatch3Loading.value

                if (!b2Loaded && !b2Loading && lastVisible >= total - 1) {
                    viewModel.loadBatch2()
                } else if (b2Loaded && !b3Loaded && !b3Loading && lastVisible >= total - 2) {
                    viewModel.loadBatch3()
                }
            }
        }
    }

    // Active scroll tracking via snapshotFlow with stabilized jitter-free threshold
    TrackLazyListScroll(
        listState = listState,
        threshold = 96,
        onVisibilityChanged = onBarsVisibilityChanged
    )

    val isAtTop by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset <= 10
        }
    }
    val effectiveTopBarVisible = isTopBarVisible || isAtTop

    val animatedTopBarOffsetY by animateDpAsState(
        targetValue = if (effectiveTopBarVisible) 0.dp else (-100).dp,
        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing),
        label = "topBarOffsetY"
    )
    val animatedTopBarAlpha by animateFloatAsState(
        targetValue = if (effectiveTopBarVisible) 1f else 0f,
        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing),
        label = "topBarAlpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
    ) {
        when {
            isLoading && latestMovies.isEmpty() -> {
                Box(modifier = Modifier.fillMaxSize()) {
                    Column(modifier = Modifier.fillMaxSize().padding(top = 90.dp)) {
                        MovieRowSkeleton(itemCount = 3)
                        MovieRowSkeleton(itemCount = 3)
                    }
                    CinepvqTopBar(
                        onSearchClick = { onSearchClick?.invoke() },
                        onProfileClick = { onProfileClick?.invoke() },
                        modifier = Modifier.align(Alignment.TopCenter)
                    )
                }
            }
            errorMessage != null && latestMovies.isEmpty() -> {
                ErrorView(
                    message = errorMessage ?: "Không thể kết nối đến máy chủ phim",
                    onRetry = { viewModel.loadHomeData() }
                )
            }
            else -> {
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = { viewModel.loadHomeData(isRefresh = true) },
                    modifier = Modifier.fillMaxSize()
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 88.dp)
                        ) {
                            // ─── BATCH 1: MOUNTED IMMEDIATELY ─────────────────────────
                            // 1. Hero Cinematic Carousel (Top 6 movies from latest)
                            item(key = "HeroCarousel", contentType = "HeroCarousel") {
                                HeroCarousel(
                                    movies = heroMovies,
                                    onMovieClick = { m -> onMovieClick(m.slug) }
                                )
                            }

                            // 2. Continue Watching Shelf (Auto-hides if empty or not logged in)
                            if (isLoggedIn && continueWatching.isNotEmpty()) {
                                item(key = "ContinueWatching", contentType = "ContinueWatching") {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 10.dp)
                                    ) {
                                        CinepvqSectionHeader(
                                            title = "Tiếp tục xem ⏳",
                                            subtitle = null,
                                            onSeeAllClick = { onHistoryClick?.invoke() }
                                        )

                                        Spacer(modifier = Modifier.height(8.dp))

                                        LazyRow(
                                            contentPadding = PaddingValues(horizontal = 16.dp),
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            items(continueWatching, key = { it.slug }) { item ->
                                                ContinueWatchingCard(
                                                    item = item,
                                                    onClick = { onContinueWatchingClick(item.slug, item.episodeSlug) }
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // 3. Trending Shelf: 🔥 Top Phim Hôm Nay (Ranking Variant with rank badge 1..10)
                            item(key = "TrendingMovies", contentType = "TrendingMovies") {
                                MovieRow(
                                    title = "🔥 Top Phim Hôm Nay",
                                    subtitle = "Các bộ phim nổi bật được khán giả theo dõi nhiều nhất",
                                    movies = trendingMovies,
                                    variant = MovieCardVariant.RANKING,
                                    onMovieClick = { m -> onMovieClick(m.slug) },
                                    onSeeAllClick = { onCategoryClick?.invoke("thinh-hanh") }
                                )
                            }

                            // 4. Quick Genre Tags Banner (Matching Web)
                            item(key = "QuickGenres", contentType = "QuickGenres") {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 6.dp)
                                ) {
                                    LazyRow(
                                        contentPadding = PaddingValues(horizontal = 16.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        item {
                                            Text(
                                                text = "✨ Thể loại:",
                                                color = CinepvqTextMuted,
                                                fontSize = 12.sp,
                                                modifier = Modifier.padding(end = 4.dp)
                                            )
                                        }
                                        items(QUICK_GENRES, key = { it.second }) { (label, slug) ->
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(20.dp))
                                                    .background(CinepvqSurfaceVariant)
                                                    .border(width = 1.dp, color = CinepvqBorderSubtle, shape = RoundedCornerShape(20.dp))
                                                    .clickable { onCategoryClick?.invoke("the-loai/$slug") }
                                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = label,
                                                    color = CinepvqTextSecondary,
                                                    fontSize = 12.sp
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // 5. Phim Mới Cập Nhật
                            item(key = "LatestMovies", contentType = "LatestMovies") {
                                MovieRow(
                                    title = "Phim Mới Cập Nhật",
                                    subtitle = "Những tác phẩm vừa được cập nhật tập mới",
                                    movies = latestMovies,
                                    onMovieClick = { m -> onMovieClick(m.slug) },
                                    onSeeAllClick = { onCategoryClick?.invoke("phim-moi") }
                                )
                            }

                            // 6. Phim Bộ Đặc Sắc
                            item(key = "SeriesMovies", contentType = "SeriesMovies") {
                                MovieRow(
                                    title = "Phim Bộ Đặc Sắc",
                                    subtitle = "Series dài tập lôi cuốn, trọn bộ vietsub chất lượng cao",
                                    movies = seriesMovies,
                                    onMovieClick = { m -> onMovieClick(m.slug) },
                                    onSeeAllClick = { onCategoryClick?.invoke("phim-bo") }
                                )
                            }

                            // ─── BATCH 2: LAZY LOADED WHEN SCROLLING NEAR BOTTOM ─────
                            if (isBatch2Loaded) {
                                // 7. Phim Lẻ Chiếu Rạp
                                item(key = "SingleMovies", contentType = "SingleMovies") {
                                    MovieRow(
                                        title = "Phim Lẻ Chiếu Rạp",
                                        subtitle = "Bom tấn điện ảnh màn ảnh rộng không thể bỏ lỡ",
                                        movies = singleMovies,
                                        onMovieClick = { m -> onMovieClick(m.slug) },
                                        onSeeAllClick = { onCategoryClick?.invoke("phim-le") }
                                    )
                                }

                                // 8. Thế Giới Hoạt Hình & Anime
                                item(key = "AnimeMovies", contentType = "AnimeMovies") {
                                    MovieRow(
                                        title = "Thế Giới Hoạt Hình & Anime",
                                        subtitle = "Các bộ phim hoạt hình kinh điển và anime hot nhất",
                                        movies = animeMovies,
                                        onMovieClick = { m -> onMovieClick(m.slug) },
                                        onSeeAllClick = { onCategoryClick?.invoke("hoat-hinh") }
                                    )
                                }

                                // 9. Chương Trình TV Show
                                item(key = "TvShowsMovies", contentType = "TvShowsMovies") {
                                    MovieRow(
                                        title = "Chương Trình TV Show",
                                        subtitle = "Gameshow truyền hình và các chương trình thực tế thú vị",
                                        movies = tvShowsMovies,
                                        onMovieClick = { m -> onMovieClick(m.slug) },
                                        onSeeAllClick = { onCategoryClick?.invoke("tv-shows") }
                                    )
                                }
                            } else if (isBatch2Loading) {
                                item(key = "Batch2Skeleton", contentType = "Batch2Skeleton") {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        MovieRowSkeleton(itemCount = 3)
                                    }
                                }
                            }

                            // ─── BATCH 3: LAZY LOADED WHEN SCROLLING TO BATCH 2 ───────
                            if (isBatch3Loaded) {
                                // 10. Phim Hành Động Kịch Tính
                                item(key = "ActionMovies", contentType = "ActionMovies") {
                                    MovieRow(
                                        title = "Hành Động Kịch Tính",
                                        subtitle = "Nghẹt thở với những pha rượt đuổi và cận chiến mãn nhãn",
                                        movies = actionMovies,
                                        onMovieClick = { m -> onMovieClick(m.slug) },
                                        onSeeAllClick = { onCategoryClick?.invoke("the-loai/hanh-dong") }
                                    )
                                }

                                // 11. Điện Ảnh Âu Mỹ
                                item(key = "WesternMovies", contentType = "WesternMovies") {
                                    MovieRow(
                                        title = "Điện Ảnh Âu Mỹ",
                                        subtitle = "Hollywood đỉnh cao với kỹ xảo và âm thanh sống động",
                                        movies = westernMovies,
                                        onMovieClick = { m -> onMovieClick(m.slug) },
                                        onSeeAllClick = { onCategoryClick?.invoke("quoc-gia/au-my") }
                                    )
                                }

                                // 12. K-Drama Hàn Quốc
                                item(key = "KoreanMovies", contentType = "KoreanMovies") {
                                    MovieRow(
                                        title = "K-Drama Hàn Quốc",
                                        subtitle = "Những câu chuyện tình cảm lãng mạn và gia đình sâu sắc",
                                        movies = koreanMovies,
                                        onMovieClick = { m -> onMovieClick(m.slug) },
                                        onSeeAllClick = { onCategoryClick?.invoke("quoc-gia/han-quoc") }
                                    )
                                }
                            } else if (isBatch3Loading) {
                                item(key = "Batch3Skeleton", contentType = "Batch3Skeleton") {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        MovieRowSkeleton(itemCount = 3)
                                    }
                                }
                            }
                        }

                        // Floating Top App Bar with auto-hide animation
                        CinepvqTopBar(
                            onSearchClick = { onSearchClick?.invoke() },
                            onProfileClick = { onProfileClick?.invoke() },
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .graphicsLayer {
                                    translationY = with(density) { animatedTopBarOffsetY.toPx() }
                                    alpha = animatedTopBarAlpha
                                }
                        )
                    }
                }
            }
        }
    }
}
