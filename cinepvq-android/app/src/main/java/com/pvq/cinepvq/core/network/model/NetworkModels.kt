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
data class SubtitleTrackDto(
    val label: String = "Tiếng Việt",
    val lang: String = "vi",
    val url: String = "",
    val rawUrl: String? = null
)

@Serializable
data class ResolvedStreamSource(
    val sourceId: String = "",
    val name: String = "",
    val displayName: String = "",
    val type: String = "hls", // "hls" or "iframe"
    val url: String = "",
    val rawUrl: String? = null,
    val priority: Int = 1,
    val quality: String? = null,
    val serverName: String? = null,
    val isAvailable: Boolean = true,
    val headers: Map<String, String>? = null,
    val subtitles: List<SubtitleTrackDto>? = null,
    val stripPng: Boolean? = null,
    val adFree: Boolean? = null
)

// ─── Cinepvq Trending BXH Models ────────────────────────────────────────────

@Serializable
data class NetflixCountryDto(
    val code: String = "vn",
    val label: String = "Việt Nam",
    val shortLabel: String = "VN",
    val flag: String = "🇻🇳"
)

@Serializable
data class DoubanCategoryDto(
    val key: String = "all",
    val label: String = "Tổng hợp"
)

@Serializable
data class TrendingRankItemDto(
    val slug: String = "",
    val name: String = "",
    @SerialName("original_name") val originalName: String? = null,
    @SerialName("thumb_url") val thumbUrl: String = "",
    @SerialName("poster_url") val posterUrl: String = "",
    val year: JsonElement? = null,
    @SerialName("current_episode") val currentEpisode: String = "",
    val quality: String = "HD",
    val rank: Int = 1,
    val platformId: String = "",
    val platformName: String = "",
    val score: Double = 0.0,
    val scoreSource: String = "",
    val views: Long = 0L,
    val formattedViews: String = "",
    val heatLabel: String = "",
    val trendDelta: Int = 0,
    val playable: Boolean? = null,
    val searchQuery: String? = null,
    val weeksInTop10: Int? = null,
    val marketShare: Double? = null,
    val broadcastPlatform: String? = null
)

@Serializable
data class TrendingPlatformSectionDto(
    val id: String = "",
    val name: String = "",
    val subtitle: String = "",
    val badgeText: String = "",
    val updatedAt: String = "",
    val countryCode: String? = null,
    val countryLabel: String? = null,
    val categoryKey: String? = null,
    val metricLabel: String? = null,
    val hasMore: Boolean? = null,
    val nextCursor: Int? = null,
    val totalScanned: Int? = null,
    val totalAvailable: Int? = null,
    val items: List<TrendingRankItemDto> = emptyList()
)

@Serializable
data class TrendingRankingsResponseDto(
    val status: Boolean = false,
    val updatedAt: String = "",
    val activeNetflixCountry: String = "vn",
    val activeNetflixType: String = "tv",
    val activeDoubanCategory: String = "all",
    val netflixCountries: List<NetflixCountryDto> = emptyList(),
    val doubanCategories: List<DoubanCategoryDto> = emptyList(),
    val platforms: List<TrendingPlatformSectionDto> = emptyList(),
    val message: String? = null
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
data class HistoryEpisodeDto(
    val slug: String,
    val name: String
)

@Serializable
data class HistoryActionRequest(
    val action: String? = null, // "upsert", "sync", "remove", "clear"
    val movieSlug: String? = null,
    val episodeSlug: String? = null,
    val episodeName: String? = null,
    val episode: HistoryEpisodeDto? = null,
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

// ─── Unified 6-Dataset Catalog Models ────────────────────────────────────────

@Serializable
data class UnifiedCatalogListResponseDto(
    val status: String = "",
    val items: List<UnifiedMovieItemDto> = emptyList()
)

@Serializable
data class UnifiedMovieItemDto(
    val slug: String = "",
    val name: String = "",
    @SerialName("original_name") val originalName: String? = null,
    @SerialName("thumb_url") val thumbUrl: String = "",
    @SerialName("poster_url") val posterUrl: String = "",
    val year: JsonElement? = null,
    @SerialName("current_episode") val currentEpisode: String = "",
    val quality: String = "HD",
    val time: String = ""
)

@Serializable
data class UnifiedMovieDetailResponseDto(
    val status: String = "",
    val movie: UnifiedMovieDetailDto? = null
)

@Serializable
data class UnifiedEpisodeItemDto(
    val name: String = "",
    val slug: String = "",
    val embed: String = "",
    val m3u8: String? = null
)

@Serializable
data class UnifiedEpisodeServerDto(
    @SerialName("server_name") val serverName: String = "Vietsub",
    val items: List<UnifiedEpisodeItemDto> = emptyList()
)

@Serializable
data class UnifiedMovieDetailDto(
    val slug: String = "",
    val name: String = "",
    @SerialName("original_name") val originalName: String? = null,
    @SerialName("thumb_url") val thumbUrl: String = "",
    @SerialName("poster_url") val posterUrl: String = "",
    val description: String = "",
    val year: JsonElement? = null,
    @SerialName("current_episode") val currentEpisode: String = "",
    @SerialName("total_episodes") val totalEpisodes: JsonElement? = null,
    val quality: String = "FHD",
    val language: String = "Vietsub",
    val time: String = "",
    val director: String = "",
    val casts: String = "",
    val episodes: List<UnifiedEpisodeServerDto> = emptyList()
)

// ─── Admin Portal Models (/api/admin/*) ──────────────────────────────────────

@Serializable
data class AdminActionResponseDto(
    val status: Boolean = false,
    val message: String? = null
)

@Serializable
data class AdminCountsDto(
    val users: Int = 0,
    val movies: Int = 0,
    val episodes: Int = 0,
    val watchHistory: Int = 0,
    val favorites: Int = 0,
    val watchlist: Int = 0,
    val comments: Int = 0,
    val notifications: Int = 0,
    val cachedPlatforms: Int = 0
)

@Serializable
data class AdminHealthItemDto(
    val name: String = "",
    val status: String = "offline",
    val latencyMs: Long = 0L,
    val detail: String = ""
)

@Serializable
data class AdminRecentActivityDto(
    val id: String = "",
    @SerialName("movie_slug") val movieSlug: String = "",
    @SerialName("episode_slug") val episodeSlug: String = "",
    @SerialName("episode_name") val episodeName: String? = null,
    @SerialName("watched_at") val watchedAt: String = "",
    val email: String = "",
    val username: String? = null,
    @SerialName("movie_name") val movieName: String? = null
)

@Serializable
data class AdminStatsResponseDto(
    val status: Boolean = false,
    val adminEmail: String? = null,
    val counts: AdminCountsDto = AdminCountsDto(),
    val health: List<AdminHealthItemDto> = emptyList(),
    val recentActivity: List<AdminRecentActivityDto> = emptyList(),
    val message: String? = null
)

@Serializable
data class AdminMovieRowDto(
    val id: String = "",
    val slug: String = "",
    val name: String = "",
    @SerialName("original_name") val originalName: String? = null,
    @SerialName("thumb_url") val thumbUrl: String? = null,
    val year: Int? = null,
    val quality: String? = null,
    @SerialName("current_episode") val currentEpisode: String? = null,
    @SerialName("is_featured") val isFeatured: Boolean = false,
    @SerialName("is_hidden") val isHidden: Boolean = false,
    @SerialName("internal_views") val internalViews: Int = 0,
    @SerialName("episode_count") val episodeCount: Int = 0
)

@Serializable
data class AdminPaginateDto(
    @SerialName("current_page") val currentPage: Int = 1,
    @SerialName("total_page") val totalPage: Int = 1,
    @SerialName("total_items") val totalItems: Int = 0
)

@Serializable
data class AdminMoviesListResponseDto(
    val status: Boolean = false,
    val items: List<AdminMovieRowDto> = emptyList(),
    val paginate: AdminPaginateDto = AdminPaginateDto(),
    val message: String? = null
)

@Serializable
data class AdminMovieActionRequest(
    val action: String,
    val slug: String? = null,
    @SerialName("is_featured") val isFeatured: Boolean? = null,
    @SerialName("is_hidden") val isHidden: Boolean? = null
)

@Serializable
data class AdminCrawlerCacheDto(
    val platformId: String = "",
    val platformName: String = "",
    val categoryLabel: String = "",
    val itemCount: Int = 0,
    val updatedAt: String = ""
)

@Serializable
data class AdminCrawlerStatusResponseDto(
    val status: Boolean = false,
    val caches: List<AdminCrawlerCacheDto> = emptyList(),
    val message: String? = null
)

@Serializable
data class AdminCrawlerActionRequest(
    val action: String,
    val limit: Int? = null
)

@Serializable
data class AdminUserRowDto(
    val id: String = "",
    val email: String = "",
    val username: String? = null,
    val role: String = "user",
    val status: String = "active",
    @SerialName("created_at") val createdAt: String = "",
    val historyCount: Int = 0,
    val favoritesCount: Int = 0,
    val watchlistCount: Int = 0,
    val commentsCount: Int = 0
)

@Serializable
data class AdminUsersResponseDto(
    val status: Boolean = false,
    val users: List<AdminUserRowDto> = emptyList(),
    val message: String? = null
)

@Serializable
data class AdminUserPatchRequest(
    val userId: String,
    val status: String? = null
)

@Serializable
data class AdminCommentRowDto(
    val id: String = "",
    @SerialName("movie_slug") val movieSlug: String = "",
    val content: String = "",
    val rating: Int? = null,
    @SerialName("created_at") val createdAt: String = "",
    val email: String = "",
    val username: String? = null,
    @SerialName("movie_name") val movieName: String? = null
)

@Serializable
data class AdminCommentsResponseDto(
    val status: Boolean = false,
    val comments: List<AdminCommentRowDto> = emptyList(),
    val message: String? = null
)

@Serializable
data class AdminNotificationRequest(
    val title: String,
    val message: String,
    val type: String = "system",
    val movieSlug: String? = null,
    val targetUserId: String = "all"
)
