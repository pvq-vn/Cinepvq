package com.pvq.cinepvq.core.designsystem.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pvq.cinepvq.domain.model.Movie

@Composable
fun MovieRow(
    title: String,
    movies: List<Movie>,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    variant: MovieCardVariant = MovieCardVariant.DEFAULT,
    isFavorite: ((String) -> Boolean)? = null,
    onFavoriteToggle: ((Movie) -> Unit)? = null,
    onMovieClick: (Movie) -> Unit,
    onSeeAllClick: (() -> Unit)? = null
) {
    if (movies.isEmpty()) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        // Reusable Section Header
        CinepvqSectionHeader(
            title = title,
            subtitle = subtitle,
            onSeeAllClick = onSeeAllClick
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Horizontal Carousel
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            itemsIndexed(movies, key = { _, it -> it.slug }) { index, movie ->
                MovieCard(
                    movie = movie,
                    variant = variant,
                    rank = if (variant == MovieCardVariant.RANKING) index + 1 else null,
                    isFavorite = isFavorite?.invoke(movie.slug) ?: false,
                    onFavoriteToggle = onFavoriteToggle?.let { { it(movie) } },
                    onClick = { onMovieClick(movie) }
                )
            }
        }
    }
}
