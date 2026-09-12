package com.pvq.cinepvq.domain.model

data class Movie(
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String = "",
    val posterUrl: String = "",
    val year: String = "",
    val episodeCurrent: String = "",
    val quality: String = "FHD",
    val time: String = ""
)

data class MovieDetail(
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String = "",
    val posterUrl: String = "",
    val description: String = "",
    val year: String = "",
    val episodeCurrent: String = "",
    val episodeTotal: String = "",
    val quality: String = "FHD",
    val lang: String = "Vietsub",
    val time: String = "",
    val director: String = "",
    val actor: String = "",
    val categories: List<String> = emptyList(),
    val countries: List<String> = emptyList(),
    val episodes: List<EpisodeServer> = emptyList()
)

data class EpisodeServer(
    val serverName: String,
    val items: List<EpisodeItem>
)

data class EpisodeItem(
    val name: String,
    val slug: String,
    val embed: String = "",
    val m3u8Url: String? = null
)

enum class StreamType {
    HLS_DIRECT,
    EMBED,
    UNAVAILABLE
}

data class StreamSource(
    val sourceId: String,
    val name: String,
    val displayName: String,
    val type: StreamType,
    val url: String,
    val priority: Int,
    val quality: String? = null,
    val serverName: String? = null,
    val isAvailable: Boolean = true
)

data class User(
    val id: String,
    val email: String,
    val username: String,
    val avatarUrl: String? = null,
    val createdAt: String? = null
)

data class FavoriteMovie(
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String,
    val quality: String? = null,
    val currentEpisode: String? = null,
    val addedAt: String = ""
)

data class WatchHistoryItem(
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String,
    val episodeSlug: String? = null,
    val episodeName: String? = null,
    val currentTime: Long = 0,
    val duration: Long = 0,
    val updatedAt: String = ""
) {
    val progressPercent: Float
        get() = if (duration > 0) (currentTime.toFloat() / duration.toFloat()).coerceIn(0f, 1f) else 0f
}

data class WatchLaterItem(
    val slug: String,
    val name: String,
    val originalName: String? = null,
    val thumbUrl: String,
    val addedAt: String = ""
)
