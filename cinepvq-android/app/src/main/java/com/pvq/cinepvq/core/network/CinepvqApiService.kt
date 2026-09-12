package com.pvq.cinepvq.core.network

import com.pvq.cinepvq.core.network.model.*
import retrofit2.Response
import retrofit2.http.*

interface CinepvqApiService {

    // ── Video Sources Resolver ────────────────────────────────────────────────
    @GET("api/video-sources/resolve")
    suspend fun resolveVideoSources(
        @Query("slug") slug: String?,
        @Query("episode") episode: Int = 1,
        @Query("season") season: Int = 1,
        @Query("type") type: String = "series",
        @Query("serverName") serverName: String? = null,
        @Query("episodeSlug") episodeSlug: String? = null,
        @Query("nguoncEmbedUrl") nguoncEmbedUrl: String? = null
    ): Response<VideoSourcesResponse>

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
}
