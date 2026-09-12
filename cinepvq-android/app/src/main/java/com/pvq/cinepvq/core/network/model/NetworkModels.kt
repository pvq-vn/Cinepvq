package com.pvq.cinepvq.core.network.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// ─── KKPhim Upstream Models ──────────────────────────────────────────────────

@Serializable
data class KKPhimLatestResponse(
    val status: JsonElement? = null,
    val msg: String? = null,
    val items: List<KKPhimMovieItem> = emptyList(),
    val pagination: KKPhimPagination? = null
)

@Serializable
data class KKPhimV1ListResponse(
    val status: JsonElement? = null,
    val msg: String? = null,
    val data: KKPhimV1Data? = null
)

@Serializable
data class KKPhimV1Data(
    val titlePage: String? = null,
    val items: List<KKPhimMovieItem> = emptyList(),
    val APP_DOMAIN_CDN_IMAGE: String? = null
)

@Serializable
data class KKPhimPagination(
    val totalItems: Int? = null,
    val totalItemsPerPage: Int? = null,
    val currentPage: Int? = null,
    val totalPages: Int? = null
)

@Serializable
data class KKPhimMovieItem(
    @SerialName("_id") val id: String? = null,
    val name: String = "",
    val slug: String = "",
    @SerialName("origin_name") val originName: String? = null,
    @SerialName("thumb_url") val thumbUrl: String? = null,
    @SerialName("poster_url") val posterUrl: String? = null,
    val year: JsonElement? = null,
    @SerialName("episode_current") val episodeCurrent: String? = null,
    val quality: String? = null,
    val lang: String? = null,
    val time: String? = null
)

@Serializable
data class KKPhimDetailResponse(
    val status: JsonElement? = null,
    val msg: String? = null,
    val movie: KKPhimMovieDetail? = null,
    val episodes: List<KKPhimEpisodeServer> = emptyList()
)

@Serializable
data class KKPhimMovieDetail(
    @SerialName("_id") val id: String? = null,
    val name: String = "",
    val slug: String = "",
    @SerialName("origin_name") val originName: String? = null,
    val content: String? = null,
    @SerialName("thumb_url") val thumbUrl: String? = null,
    @SerialName("poster_url") val posterUrl: String? = null,
    val year: JsonElement? = null,
    @SerialName("episode_current") val episodeCurrent: String? = null,
    @SerialName("episode_total") val episodeTotal: JsonElement? = null,
    val quality: String? = null,
    val lang: String? = null,
    val time: String? = null,
    val director: JsonElement? = null,
    val actor: JsonElement? = null,
    val category: List<KKPhimTaxonomyItem> = emptyList(),
    val country: List<KKPhimTaxonomyItem> = emptyList()
)

@Serializable
data class KKPhimTaxonomyItem(
    val id: String? = null,
    val name: String = "",
    val slug: String = ""
)

@Serializable
data class KKPhimEpisodeServer(
    @SerialName("server_name") val serverName: String = "",
    @SerialName("server_data") val serverData: List<KKPhimEpisodeItem> = emptyList()
)

@Serializable
data class KKPhimEpisodeItem(
    val name: String = "",
    val slug: String = "",
    val filename: String? = null,
    @SerialName("link_embed") val linkEmbed: String? = null,
    @SerialName("link_m3u8") val linkM3u8: String? = null
)

// ─── Cinepvq Video Sources Resolver Models ──────────────────────────────────

@Serializable
data class VideoSourcesResponse(
    val status: String = "",
    val sources: List<ResolvedStreamSource> = emptyList(),
    val message: String? = null
)

@Serializable
data class ResolvedStreamSource(
    val sourceId: String = "",
    val name: String = "",
    val displayName: String = "",
    val type: String = "hls", // "hls" or "iframe"
    val url: String = "",
    val priority: Int = 1,
    val quality: String? = null,
    val serverName: String? = null,
    val isAvailable: Boolean = true
)

// ─── Cinepvq User & Sync Models ─────────────────────────────────────────────

@Serializable
data class UserSyncResponse(
    val status: String = "",
    val user: UserProfileDto? = null,
    val fallback: Boolean = false,
    val message: String? = null
)

@Serializable
data class UserProfileDto(
    val id: String = "",
    val email: String = "",
    val username: String = "",
    val avatarUrl: String? = null,
    val createdAt: String? = null
)

@Serializable
data class ProfileUpdateRequest(
    val username: String? = null,
    val avatarUrl: String? = null
)

// ─── Favorites Models ────────────────────────────────────────────────────────

@Serializable
data class FavoritesResponse(
    val status: String = "",
    val favorites: List<FavoriteMovieDto> = emptyList(),
    val message: String? = null,
    val favorited: Boolean? = null
)

@Serializable
data class FavoriteMovieDto(
    val slug: String = "",
    val name: String = "",
    val original_name: String? = null,
    val thumb_url: String = "",
    val quality: String? = null,
    val current_episode: String? = null,
    val addedAt: String? = null
)

@Serializable
data class FavoriteActionRequest(
    val action: String? = null, // "sync", "remove", "clear", or null for toggle
    val movieSlug: String? = null,
    val slug: String? = null,
    val movie: FavoriteMovieDto? = null,
    val favorites: List<FavoriteMovieDto>? = null
)

// ─── Watch History Models ───────────────────────────────────────────────────

@Serializable
data class HistoryResponse(
    val status: String = "",
    val history: List<WatchHistoryDto> = emptyList(),
    val message: String? = null,
    val recorded: Boolean? = null
)

@Serializable
data class WatchHistoryDto(
    val slug: String = "",
    val name: String = "",
    val original_name: String? = null,
    val thumb_url: String = "",
    val episodeSlug: String? = null,
    val episodeName: String? = null,
    val currentTime: Long = 0,
    val duration: Long = 0,
    val updatedAt: String? = null
)

@Serializable
data class HistoryActionRequest(
    val action: String? = null, // "upsert", "sync", "remove", "clear"
    val movieSlug: String? = null,
    val episodeSlug: String? = null,
    val position: Long? = null,
    val duration: Long? = null,
    val updatedAt: String? = null,
    val movie: WatchHistoryDto? = null,
    val history: List<WatchHistoryDto>? = null
)

// ─── Watchlist (Xem Sau) Models ─────────────────────────────────────────────

@Serializable
data class WatchlistResponse(
    val status: String = "",
    val watchlist: List<WatchlistDto> = emptyList(),
    val message: String? = null
)

@Serializable
data class WatchlistDto(
    val slug: String = "",
    val name: String = "",
    val original_name: String? = null,
    val thumb_url: String = "",
    val poster_url: String? = null,
    val year: String? = null,
    val quality: String? = null,
    val current_episode: String? = null,
    val type: String? = null,
    val addedAt: String? = null
)

@Serializable
data class WatchlistActionRequest(
    val action: String? = null, // "sync", "add", "remove", "clear"
    val slug: String? = null,
    val movie: WatchlistDto? = null,
    val watchlist: List<WatchlistDto>? = null
)

// ─── User Settings Models ───────────────────────────────────────────────────

@Serializable
data class SettingsResponse(
    val status: String = "",
    val settings: UserSettingsDto? = null,
    val message: String? = null
)

@Serializable
data class UserSettingsDto(
    val theme: String = "system",
    val autoPlay: Boolean = true,
    val soundEnabled: Boolean = true,
    val preferredQuality: String = "auto"
)

// ─── Supabase Auth Models ───────────────────────────────────────────────────

@Serializable
data class SupabaseSignInRequest(
    val email: String,
    val password: String
)

@Serializable
data class SupabaseSignUpRequest(
    val email: String,
    val password: String,
    val data: Map<String, String> = emptyMap()
)

@Serializable
data class SupabaseRefreshTokenRequest(
    @SerialName("refresh_token") val refreshToken: String
)

@Serializable
data class SupabaseAuthResponse(
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("token_type") val tokenType: String? = null,
    @SerialName("expires_in") val expiresIn: Long? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    val user: SupabaseUserDto? = null,
    @SerialName("error_description") val errorDescription: String? = null,
    val msg: String? = null,
    val message: String? = null
)

@Serializable
data class SupabaseUserDto(
    val id: String = "",
    val email: String? = null,
    @SerialName("user_metadata") val userMetadata: Map<String, JsonElement> = emptyMap(),
    @SerialName("created_at") val createdAt: String? = null
)
