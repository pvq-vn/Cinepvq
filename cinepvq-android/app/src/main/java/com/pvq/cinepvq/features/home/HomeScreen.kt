package com.pvq.cinepvq.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
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

@Composable
fun HomeScreen(
    onMovieClick: (String) -> Unit,
    onContinueWatchingClick: (String, String?) -> Unit,
    onCategoryClick: ((String) -> Unit)? = null,
    onSearchClick: (() -> Unit)? = null,
    onProfileClick: (() -> Unit)? = null,
    viewModel: HomeViewModel = viewModel()
) {
    val latestMovies by viewModel.latestMovies.collectAsStateWithLifecycle()
    val seriesMovies by viewModel.seriesMovies.collectAsStateWithLifecycle()
    val singleMovies by viewModel.singleMovies.collectAsStateWithLifecycle()
    val animeMovies by viewModel.animeMovies.collectAsStateWithLifecycle()
    val continueWatching by viewModel.continueWatching.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val isLoggedIn by viewModel.isLoggedIn.collectAsStateWithLifecycle()

    val heroMovies = remember(latestMovies) { latestMovies.take(6) }
    val trendingMovies = remember(latestMovies) { latestMovies.take(10) }

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
                Box(modifier = Modifier.fillMaxSize()) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 16.dp)
                    ) {
                        // 1. Hero Cinematic Carousel (Top 6 movies from latest)
                        item(contentType = "HeroCarousel") {
                            HeroCarousel(
                                movies = heroMovies,
                                onMovieClick = { m -> onMovieClick(m.slug) }
                            )
                        }

                    // 2. Continue Watching Shelf (Auto-hides if empty or not logged in)
                    if (isLoggedIn && continueWatching.isNotEmpty()) {
                        item(contentType = "ContinueWatching") {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 10.dp)
                            ) {
                                CinepvqSectionHeader(
                                    title = "Tiếp tục xem ⏳",
                                    subtitle = "Tiếp tục thưởng thức các tập phim đang dang dở"
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
                    item(contentType = "TrendingMovies") {
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
                    item(contentType = "QuickGenres") {
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
                    item(contentType = "LatestMovies") {
                        MovieRow(
                            title = "Phim Mới Cập Nhật",
                            subtitle = "Những tác phẩm vừa được cập nhật tập mới",
                            movies = latestMovies,
                            onMovieClick = { m -> onMovieClick(m.slug) },
                            onSeeAllClick = { onCategoryClick?.invoke("phim-moi") }
                        )
                    }

                    // 6. Phim Bộ Đặc Sắc
                    item(contentType = "SeriesMovies") {
                        MovieRow(
                            title = "Phim Bộ Đặc Sắc",
                            subtitle = "Series dài tập lôi cuốn, trọn bộ vietsub chất lượng cao",
                            movies = seriesMovies,
                            onMovieClick = { m -> onMovieClick(m.slug) },
                            onSeeAllClick = { onCategoryClick?.invoke("phim-bo") }
                        )
                    }

                    // 7. Phim Lẻ Chọn Lọc
                    item(contentType = "SingleMovies") {
                        MovieRow(
                            title = "Phim Điện Ảnh Chọn Lọc",
                            subtitle = "Bom tấn chiếu rạp và phim lẻ đỉnh cao",
                            movies = singleMovies,
                            onMovieClick = { m -> onMovieClick(m.slug) },
                            onSeeAllClick = { onCategoryClick?.invoke("phim-le") }
                        )
                    }

                    // 8. Hoạt Hình & Anime
                    item(contentType = "AnimeMovies") {
                        MovieRow(
                            title = "Hoạt Hình & Anime",
                            subtitle = "Thế giới anime phong phú vietsub mới nhất",
                            movies = animeMovies,
                            onMovieClick = { m -> onMovieClick(m.slug) },
                            onSeeAllClick = { onCategoryClick?.invoke("hoat-hinh") }
                        )
                    }
                    }

                    // Floating Top App Bar
                    CinepvqTopBar(
                        onSearchClick = { onSearchClick?.invoke() },
                        onProfileClick = { onProfileClick?.invoke() },
                        modifier = Modifier.align(Alignment.TopCenter)
                    )
                }
            }
        }
    }
}
