package com.pvq.cinepvq.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(
    tableName = "favorites",
    primaryKeys = ["userId", "slug"]
)
data class FavoriteMovieEntity(
    val userId: String = "guest",
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String = "",
    val quality: String? = null,
    val currentEpisode: String? = null,
    val addedAt: String = ""
)

@Entity(
    tableName = "watch_history",
    primaryKeys = ["userId", "slug"]
)
data class WatchHistoryEntity(
    val userId: String = "guest",
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String = "",
    val episodeSlug: String? = null,
    val episodeName: String? = null,
    val currentTime: Long = 0,
    val duration: Long = 0,
    val updatedAt: String = ""
)

@Entity(tableName = "movie_cache")
data class MovieCacheEntity(
    @PrimaryKey val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String,
    val posterUrl: String? = null,
    val description: String? = null,
    val year: String? = null,
    val quality: String? = null,
    val time: String? = null,
    val episodesJson: String = "",
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "watch_later",
    primaryKeys = ["userId", "slug"]
)
data class WatchLaterEntity(
    val userId: String = "guest",
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String = "",
    val addedAt: String = ""
)

@Entity(
    tableName = "search_history",
    primaryKeys = ["userId", "query"]
)
data class SearchHistoryEntity(
    val userId: String = "guest",
    val query: String,
    val timestamp: Long = System.currentTimeMillis()
)

