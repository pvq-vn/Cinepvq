package com.pvq.cinepvq.core.network

import com.pvq.cinepvq.core.network.model.*
import retrofit2.Response
import retrofit2.http.*

interface CinepvqApiService {

    // ── Video Sources Resolver ────────────────────────────────────────────────
    @GET("api/video-sources/resolve")
    suspend fun resolveVideoSources(
        @Query("slug") slug: String?,
        @Query("title") title: String? = null,
        @Query("episode") episode: Int = 1,
        @Query("season") season: Int = 1,
        @Query("type") type: String = "series",
        @Query("serverName") serverName: String? = null,
        @Query("episodeSlug") episodeSlug: String? = null,
        @Query("knownHlsUrl") knownHlsUrl: String? = null,
        @Query("nguoncEmbedUrl") nguoncEmbedUrl: String? = null
    ): Response<VideoSourcesResponse>

    // ── Unified 6-Dataset Catalog Endpoints ───────────────────────────────────
    @GET("api/catalog/search")
    suspend fun searchUnifiedCatalog(
        @Query("q") keyword: String,
        @Query("page") page: Int = 1
    ): Response<UnifiedCatalogListResponseDto>

    @GET("api/catalog/latest")
    suspend fun getUnifiedLatestMovies(
        @Query("page") page: Int = 1
    ): Response<UnifiedCatalogListResponseDto>

    @GET("api/movies/{slug}")
    suspend fun getUnifiedMovieDetail(
        @Path("slug") slug: String
    ): Response<UnifiedMovieDetailResponseDto>

    // ── Trending BXH Multi-Platform Rankings ──────────────────────────────────
    @GET("api/trending")
    suspend fun getTrendingRankings(
        @Query("platform") platform: String = "all",
        @Query("country") country: String = "vn",
        @Query("netflixType") netflixType: String = "tv",
        @Query("doubanCategory") doubanCategory: String = "all",
        @Query("doubanOffset") doubanOffset: Int? = null,
        @Query("refresh") refresh: Boolean? = null
    ): Response<TrendingRankingsResponseDto>

    // ── User Identity & Profile ───────────────────────────────────────────────
    @POST("api/user/sync")
    suspend fun syncUser(): Response<UserSyncResponse>

    @GET("api/user/profile")
    suspend fun getProfile(): Response<UserSyncResponse>

    @PATCH("api/user/profile")
    suspend fun updateProfile(
        @Body request: ProfileUpdateRequest
    ): Response<UserSyncResponse>

    // ── Favorites ─────────────────────────────────────────────────────────────
    @GET("api/favorites")
    suspend fun getFavorites(): Response<FavoritesResponse>

    @POST("api/favorites")
    suspend fun updateFavorites(
        @Body request: FavoriteActionRequest
    ): Response<FavoritesResponse>

    // ── Watch History & Progress ──────────────────────────────────────────────
    @GET("api/history")
    suspend fun getHistory(): Response<HistoryResponse>

    @POST("api/history")
    suspend fun updateHistory(
        @Body request: HistoryActionRequest
    ): Response<HistoryResponse>

    // ── Settings ──────────────────────────────────────────────────────────────
    @GET("api/settings")
    suspend fun getSettings(): Response<SettingsResponse>

    @POST("api/settings")
    suspend fun updateSettings(
        @Body settings: UserSettingsDto
    ): Response<SettingsResponse>

    // ── Watchlist ─────────────────────────────────────────────────────────────
    @GET("api/watchlist")
    suspend fun getWatchlist(): Response<WatchlistResponse>

    @POST("api/watchlist")
    suspend fun updateWatchlist(
        @Body request: WatchlistActionRequest
    ): Response<WatchlistResponse>

    @DELETE("api/watchlist")
    suspend fun deleteWatchlist(
        @Query("slug") slug: String?,
        @Query("clear") clear: Boolean? = null
    ): Response<WatchlistResponse>

    // ── Comments ──────────────────────────────────────────────────────────────
    @GET("api/comments")
    suspend fun getComments(
        @Query("slug") slug: String
    ): Response<CommentsResponse>

    @POST("api/comments")
    suspend fun postComment(
        @Body request: PostCommentRequest
    ): Response<CommentsResponse>

    // ── App Version & Updates ─────────────────────────────────────────────────
    @GET("api/app/version")
    suspend fun getAppVersion(): Response<AppVersionDto>

    // ── Admin Portal Endpoints (Sole Admin Only) ──────────────────────────────
    @GET("api/admin/stats")
    suspend fun getAdminStats(): Response<AdminStatsResponseDto>

    @GET("api/admin/movies")
    suspend fun getAdminMovies(
        @Query("q") query: String = "",
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 15
    ): Response<AdminMoviesListResponseDto>

    @POST("api/admin/movies")
    suspend fun postAdminMovieAction(
        @Body request: AdminMovieActionRequest
    ): Response<AdminActionResponseDto>

    @GET("api/admin/crawler")
    suspend fun getAdminCrawlerStatus(): Response<AdminCrawlerStatusResponseDto>

    @POST("api/admin/crawler")
    suspend fun postAdminCrawlerAction(
        @Body request: AdminCrawlerActionRequest
    ): Response<AdminActionResponseDto>

    @GET("api/admin/users")
    suspend fun getAdminUsers(
        @Query("q") query: String = ""
    ): Response<AdminUsersResponseDto>

    @PATCH("api/admin/users")
    suspend fun patchAdminUser(
        @Body request: AdminUserPatchRequest
    ): Response<AdminActionResponseDto>

    @GET("api/admin/comments")
    suspend fun getAdminComments(): Response<AdminCommentsResponseDto>

    @DELETE("api/admin/comments")
    suspend fun deleteAdminComment(
        @Query("id") id: String
    ): Response<AdminActionResponseDto>

    @POST("api/admin/notifications")
    suspend fun sendAdminNotification(
        @Body request: AdminNotificationRequest
    ): Response<AdminActionResponseDto>
}
