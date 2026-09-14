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
) {
    val parsedTitleAndPart: Pair<String, String?>
        get() {
            val partRegex = Regex("(?i)[(]?\\s*(Phần|Season)\\s*(\\d+|[IVXLCDM]+)\\s*[)]?")
            val match = partRegex.find(name)
            return if (match != null) {
                val partText = match.value.trim('(', ')', ' ')
                val cleanTitle = name.replace(match.value, "").trim(' ', '-', ':')
                Pair(cleanTitle, partText)
            } else {
                Pair(name, null)
            }
        }
}

data class EpisodeServer(
    val serverName: String,
    val items: List<EpisodeItem>
)

data class EpisodeItem(
    val name: String,
    val slug: String,
    val embed: String = "",
    val m3u8Url: String? = null
) {
    val displayName: String
        get() {
            val clean = name.trim()
            return if (clean.startsWith("Tập", ignoreCase = true)) clean else "Tập $clean"
        }

    val episodeNumberOnly: String
        get() {
            val digits = name.replace(Regex("[^0-9]"), "").trim()
            return if (digits.isNotEmpty()) {
                if (digits.length == 1) "0$digits" else digits
            } else {
                name.replace(Regex("(?i)tập\\s*"), "").trim().ifBlank { name }
            }
        }
}

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
