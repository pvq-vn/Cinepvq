package com.pvq.cinepvq.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.pvq.cinepvq.domain.model.Movie
import com.pvq.cinepvq.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun HeroCarousel(
    movies: List<Movie>,
    modifier: Modifier = Modifier,
    onMovieClick: (Movie) -> Unit
) {
    val featured = remember(movies) { movies.take(6) }
    if (featured.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { featured.size })

    // Auto-scroll every 5 seconds if multiple slides
    LaunchedEffect(pagerState.pageCount) {
        if (pagerState.pageCount > 1) {
            while (true) {
                delay(5500)
                val nextPage = (pagerState.currentPage + 1) % pagerState.pageCount
                pagerState.animateScrollToPage(nextPage)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(420.dp)
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            val movie = featured[page]
            HeroSlide(movie = movie, onMovieClick = { onMovieClick(movie) })
        }

        // Pager Indicator Dots
        if (featured.size > 1) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(featured.size) { index ->
                    val isSelected = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .width(if (isSelected) 18.dp else 5.dp)
                            .height(5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(
                                if (isSelected) CinepvqPrimary else CinepvqTextMuted.copy(alpha = 0.5f)
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun HeroSlide(
    movie: Movie,
    onMovieClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable(onClick = onMovieClick)
    ) {
        // Background Backdrop
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(movie.posterUrl.ifBlank { movie.thumbUrl })
                .crossfade(true)
                .build(),
            contentDescription = movie.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // Multiple overlay gradients for cinematic atmosphere (Optimized into one Box)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color(0x60000000),
                            0.35f to Color.Transparent,
                            0.65f to CinepvqBackground.copy(alpha = 0.75f),
                            0.95f to CinepvqBackground,
                            1.0f to CinepvqBackground
                        )
                    )
                )
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            CinepvqBackground.copy(alpha = 0.8f),
                            Color(0x30000000),
                            Color.Transparent
                        )
                    )
                )
        )

        // Hero Info Overlay
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth(0.9f)
                .padding(start = 16.dp, end = 16.dp, bottom = 14.dp)
        ) {
            // Badges Bar
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (movie.quality.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .background(
                                color = CinepvqPrimaryDark,
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = movie.quality.uppercase(),
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (movie.episodeCurrent.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .background(
                                color = Color(0x66FFFFFF),
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = movie.episodeCurrent,
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                if (movie.year.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .background(
                                color = Color(0x44000000),
                                shape = RoundedCornerShape(4.dp)
                            )
                            .border(width = 1.dp, color = Color(0x33FFFFFF), shape = RoundedCornerShape(4.dp))
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = movie.year,
                            color = CinepvqTextSecondary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Title
            Text(
                text = movie.name,
                color = CinepvqTextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = (-0.5).sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            if (!movie.originalName.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = movie.originalName,
                    color = CinepvqTextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = onMovieClick,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CinepvqPrimary,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Xem Ngay",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                OutlinedButton(
                    onClick = onMovieClick,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                        brush = Brush.horizontalGradient(listOf(CinepvqBorderSubtle, CinepvqBorderSubtle))
                    ),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = CinepvqTextSecondary
                    )
                    Spacer(modifier = Modifier.width(5.dp))
                    Text(
                        text = "Chi Tiết",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = CinepvqTextSecondary
                    )
                }
            }
        }
    }
}

// Keep HeroBanner for backwards compatibility with single movie
@Composable
fun HeroBanner(
    movie: Movie?,
    modifier: Modifier = Modifier,
    onWatchClick: (Movie) -> Unit
) {
    if (movie == null) return
    HeroCarousel(
        movies = listOf(movie),
        modifier = modifier,
        onMovieClick = onWatchClick
    )
}
