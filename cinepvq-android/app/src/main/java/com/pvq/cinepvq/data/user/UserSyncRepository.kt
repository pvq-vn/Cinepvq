package com.pvq.cinepvq.data.user

import android.util.Log
import com.pvq.cinepvq.core.database.CinepvqDatabase
import com.pvq.cinepvq.core.database.FavoriteMovieEntity
import com.pvq.cinepvq.core.database.WatchHistoryEntity
import com.pvq.cinepvq.core.database.WatchLaterEntity
import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.core.network.model.FavoriteActionRequest
import com.pvq.cinepvq.core.network.model.FavoriteMovieDto
import com.pvq.cinepvq.core.network.model.HistoryActionRequest
import com.pvq.cinepvq.core.network.model.WatchHistoryDto
import com.pvq.cinepvq.core.network.model.WatchlistActionRequest
import com.pvq.cinepvq.core.network.model.WatchlistDto
import com.pvq.cinepvq.core.security.SecureStorageManager
import com.pvq.cinepvq.domain.model.FavoriteMovie
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import com.pvq.cinepvq.domain.model.WatchLaterItem
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import java.util.*

data class SyncResultSummary(
    val isSuccess: Boolean,
    val favoritesCount: Int = 0,
    val historyCount: Int = 0,
    val watchlistCount: Int = 0,
    val errors: List<String> = emptyList()
)

class UserSyncRepository(
    private val networkModule: NetworkModule,
    private val database: CinepvqDatabase,
    private val secureStorageManager: SecureStorageManager,
    private val repositoryScope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
) {
    private val favoriteDao = database.favoriteDao()
    private val historyDao = database.watchHistoryDao()
    private val watchLaterDao = database.watchLaterDao()

    val activeUserIdFlow = MutableStateFlow(secureStorageManager.activeUserId)

    private val progressJobs = java.util.concurrent.ConcurrentHashMap<String, Job>()
    private val pendingProgressMap = java.util.concurrent.ConcurrentHashMap<String, HistoryActionRequest>()

    fun updateActiveUser(userId: String) {
        activeUserIdFlow.value = userId
    }

    fun onUserLoggedOut() {
        activeUserIdFlow.value = SecureStorageManager.GUEST_USER_ID
    }

    // ── Favorites ─────────────────────────────────────────────────────────────

    @OptIn(ExperimentalCoroutinesApi::class)
    fun getAllFavorites(): Flow<List<FavoriteMovie>> {
        return activeUserIdFlow.flatMapLatest { uid ->
            favoriteDao.getAllFavorites(uid).map { list ->
                list.map { it.toDomain() }
            }
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    fun isFavorite(slug: String): Flow<Boolean> {
        return activeUserIdFlow.flatMapLatest { uid ->
            favoriteDao.isFavorite(uid, slug)
        }
    }

    suspend fun toggleFavorite(movie: MovieDetail): Boolean {
        val slug = movie.slug
        val currentUid = secureStorageManager.activeUserId
        val exists = favoriteDao.isFavoriteDirect(currentUid, slug)
        val nowIso = IsoTimestampHelper.nowIso()

        if (exists) {
            favoriteDao.deleteBySlug(currentUid, slug)
            secureStorageManager.addDeletedFavoriteSlug(currentUid, slug)
            secureStorageManager.removePendingAddFavoriteSlug(currentUid, slug)
            if (secureStorageManager.isLoggedIn) {
                repositoryScope.launch {
                    try {
                        val res = networkModule.cinepvqApi.updateFavorites(
                            FavoriteActionRequest(action = "remove", movieSlug = slug)
                        )
                        if (res.isSuccessful) {
                            secureStorageManager.removeDeletedFavoriteSlug(currentUid, slug)
                        } else {
                            Log.w("UserSyncRepo", "removeFavorite server error HTTP ${res.code()}: ${res.message()}")
                        }
                    } catch (e: Exception) {
                        Log.e("UserSyncRepo", "removeFavorite network failed: ${e.message}", e)
                    }
                }
            }
            return false
        } else {
            val entity = FavoriteMovieEntity(
                userId = currentUid,
                slug = slug,
                name = movie.name,
                originalName = movie.originalName,
                thumbUrl = movie.thumbUrl,
                quality = movie.quality,
                currentEpisode = movie.episodeCurrent,
                addedAt = nowIso
            )
            favoriteDao.insert(entity)
            secureStorageManager.removeDeletedFavoriteSlug(currentUid, slug)
            secureStorageManager.addPendingAddFavoriteSlug(currentUid, slug)

            if (secureStorageManager.isLoggedIn) {
                repositoryScope.launch {
                    try {
                        val res = networkModule.cinepvqApi.updateFavorites(
                            FavoriteActionRequest(
                                action = "add",
                                movieSlug = slug,
                                movie = FavoriteMovieDto(
                                    slug = slug,
                                    name = movie.name,
                                    original_name = movie.originalName,
                                    thumb_url = movie.thumbUrl,
                                    quality = movie.quality,
                                    current_episode = movie.episodeCurrent,
                                    addedAt = nowIso
                                )
                            )
                        )
                        if (res.isSuccessful) {
                            secureStorageManager.removePendingAddFavoriteSlug(currentUid, slug)
                        } else {
                            Log.w("UserSyncRepo", "addFavorite server error HTTP ${res.code()}: ${res.message()}")
                        }
                    } catch (e: Exception) {
                        Log.e("UserSyncRepo", "addFavorite network failed: ${e.message}", e)
                    }
                }
            }
            return true
        }
    }

    suspend fun removeFavorite(slug: String) {
        val currentUid = secureStorageManager.activeUserId
        favoriteDao.deleteBySlug(currentUid, slug)
        secureStorageManager.addDeletedFavoriteSlug(currentUid, slug)
        secureStorageManager.removePendingAddFavoriteSlug(currentUid, slug)
        if (secureStorageManager.isLoggedIn) {
            repositoryScope.launch {
                try {
                    val res = networkModule.cinepvqApi.updateFavorites(
                        FavoriteActionRequest(action = "remove", movieSlug = slug)
                    )
                    if (res.isSuccessful) {
                        secureStorageManager.removeDeletedFavoriteSlug(currentUid, slug)
                    } else {
                        Log.w("UserSyncRepo", "removeFavorite server error HTTP ${res.code()}: ${res.message()}")
                    }
                } catch (e: Exception) {
                    Log.e("UserSyncRepo", "removeFavorite network failed: ${e.message}", e)
                }
            }
        }
    }

    suspend fun clearFavorites() {
        val currentUid = secureStorageManager.activeUserId
        favoriteDao.clearByUser(currentUid)
        if (secureStorageManager.isLoggedIn) {
            repositoryScope.launch {
                try {
                    val res = networkModule.cinepvqApi.updateFavorites(
                        FavoriteActionRequest(action = "clear")
                    )
                    if (!res.isSuccessful) {
                        Log.w("UserSyncRepo", "clearFavorites server error HTTP ${res.code()}: ${res.message()}")
                    }
                } catch (e: Exception) {
                    Log.e("UserSyncRepo", "clearFavorites network failed: ${e.message}", e)
                }
            }
        }
    }

    // ── Watch History & Playback Progress ──────────────────────────────────────

    @OptIn(ExperimentalCoroutinesApi::class)
    fun getAllHistory(): Flow<List<WatchHistoryItem>> {
        return activeUserIdFlow.flatMapLatest { uid ->
            historyDao.getAllHistory(uid).map { list ->
                list.map { it.toDomain() }
            }
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    fun getHistory(slug: String): Flow<WatchHistoryItem?> {
        return activeUserIdFlow.flatMapLatest { uid ->
            historyDao.observeHistoryBySlug(uid, slug).map { it?.toDomain() }
        }
    }

    suspend fun getHistoryDirect(slug: String): WatchHistoryEntity? {
        return historyDao.getHistoryBySlug(secureStorageManager.activeUserId, slug)
    }

    // ── Episode Playback Progress Cache (Per-Episode Resume) ──────────────────

    fun saveEpisodeProgress(movieSlug: String, episodeSlug: String?, currentTime: Long, duration: Long) {
        if (episodeSlug.isNullOrBlank()) return
        val uid = secureStorageManager.activeUserId
        secureStorageManager.saveEpisodeProgress(uid, movieSlug, episodeSlug, currentTime, duration)
    }

    fun getEpisodeProgress(movieSlug: String, episodeSlug: String?): Long {
        if (episodeSlug.isNullOrBlank()) return 0L
        val uid = secureStorageManager.activeUserId
        return secureStorageManager.getEpisodeProgress(uid, movieSlug, episodeSlug)
    }

    fun getEpisodeDuration(movieSlug: String, episodeSlug: String?): Long {
        if (episodeSlug.isNullOrBlank()) return 0L
        val uid = secureStorageManager.activeUserId
        return secureStorageManager.getEpisodeDuration(uid, movieSlug, episodeSlug)
    }

    suspend fun recordWatchProgress(
        movieSlug: String,
        movieName: String,
        originalName: String? = null,
        thumbUrl: String,
        episodeSlug: String? = null,
        episodeName: String? = null,
        currentTime: Long,
        duration: Long
    ) {
        val currentUid = secureStorageManager.activeUserId
        val nowIso = IsoTimestampHelper.nowIso()

        // 0. Update per-episode progress cache
        if (!episodeSlug.isNullOrBlank()) {
            saveEpisodeProgress(movieSlug, episodeSlug, currentTime, duration)
        }

        // 1. Update local Room SQLite immediately with user namespace
        val entity = WatchHistoryEntity(
            userId = currentUid,
            slug = movieSlug,
            name = movieName,
            originalName = originalName,
            thumbUrl = thumbUrl,
            episodeSlug = episodeSlug,
            episodeName = episodeName,
            currentTime = currentTime,
            duration = duration,
            updatedAt = nowIso
        )
        historyDao.upsert(entity)

        // 2. Debounce remote sync to Cinepvq API (1.5s) to avoid flooding
        if (secureStorageManager.isLoggedIn) {
            secureStorageManager.addPendingSyncHistorySlug(currentUid, movieSlug)
            secureStorageManager.removeDeletedHistorySlug(currentUid, movieSlug)

            val req = HistoryActionRequest(
                action = "upsert",
                movieSlug = movieSlug,
                episodeSlug = episodeSlug,
                episodeName = episodeName,
                episode = if (!episodeSlug.isNullOrBlank()) {
                    com.pvq.cinepvq.core.network.model.HistoryEpisodeDto(
                        slug = episodeSlug,
                        name = episodeName ?: episodeSlug
                    )
                } else null,
                position = currentTime,
                duration = duration,
                updatedAt = nowIso,
                movie = WatchHistoryDto(
                    slug = movieSlug,
                    name = movieName,
                    original_name = originalName,
                    thumb_url = thumbUrl,
                    episodeSlug = episodeSlug,
                    episodeName = episodeName,
                    currentTime = currentTime,
                    duration = duration,
                    updatedAt = nowIso
                )
            )

            // If switching episode for the same movie, flush the previous episode's pending request immediately
            val existing = pendingProgressMap[movieSlug]
            if (existing != null && existing.episodeSlug != episodeSlug) {
                progressJobs.remove(movieSlug)?.cancel()
                val prevTarget = pendingProgressMap.remove(movieSlug)
                if (prevTarget != null) {
                    repositoryScope.launch {
                        try {
                            val res = networkModule.cinepvqApi.updateHistory(prevTarget)
                            if (res.isSuccessful) {
                                secureStorageManager.removePendingSyncHistorySlug(currentUid, movieSlug)
                            }
                        } catch (e: Exception) {
                            Log.e("UserSyncRepo", "Immediate flush previous episode failed: ${e.message}", e)
                        }
                    }
                }
            }

            pendingProgressMap[movieSlug] = req
            progressJobs[movieSlug]?.cancel()
            val job = repositoryScope.launch {
                delay(1500)
                val target = pendingProgressMap.remove(movieSlug) ?: return@launch
                progressJobs.remove(movieSlug)
                try {
                    val res = networkModule.cinepvqApi.updateHistory(target)
                    if (res.isSuccessful) {
                        secureStorageManager.removePendingSyncHistorySlug(currentUid, movieSlug)
                    } else {
                        Log.w("UserSyncRepo", "recordWatchProgress server error HTTP ${res.code()}: ${res.message()}")
                    }
                } catch (e: Exception) {
                    Log.e("UserSyncRepo", "recordWatchProgress network failed for $movieSlug: ${e.message}", e)
                }
            }
            progressJobs[movieSlug] = job
        }
    }

    suspend fun flushWatchProgress(movieSlug: String? = null) {
        if (!secureStorageManager.isLoggedIn) return
        val currentUid = secureStorageManager.activeUserId
        val keys = if (movieSlug != null) listOf(movieSlug) else pendingProgressMap.keys().toList()
        for (k in keys) {
            progressJobs.remove(k)?.cancel()
            val target = pendingProgressMap.remove(k) ?: continue
            try {
                val res = networkModule.cinepvqApi.updateHistory(target)
                if (res.isSuccessful) {
                    secureStorageManager.removePendingSyncHistorySlug(currentUid, k)
                } else {
                    Log.w("UserSyncRepo", "flushWatchProgress server error HTTP ${res.code()}: ${res.message()}")
                }
            } catch (e: Exception) {
                Log.e("UserSyncRepo", "flushWatchProgress network failed for $k: ${e.message}", e)
            }
        }
    }

    suspend fun removeHistory(slug: String) {
        val currentUid = secureStorageManager.activeUserId
        historyDao.deleteBySlug(currentUid, slug)
        secureStorageManager.removeEpisodeProgressForMovie(currentUid, slug)
        if (secureStorageManager.isLoggedIn) {
            secureStorageManager.addDeletedHistorySlug(currentUid, slug)
            secureStorageManager.removePendingSyncHistorySlug(currentUid, slug)
            repositoryScope.launch {
                try {
                    val res = networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "remove", movieSlug = slug)
                    )
                    if (res.isSuccessful) {
                        secureStorageManager.removeDeletedHistorySlug(currentUid, slug)
                    } else {
                        Log.w("UserSyncRepo", "removeHistory server error HTTP ${res.code()}: ${res.message()}")
                    }
                } catch (e: Exception) {
                    Log.e("UserSyncRepo", "removeHistory network failed: ${e.message}", e)
                }
            }
        }
    }

    suspend fun clearHistory() {
        val currentUid = secureStorageManager.activeUserId
        historyDao.clearByUser(currentUid)
        secureStorageManager.clearEpisodeProgress(currentUid)
        if (secureStorageManager.isLoggedIn) {
            secureStorageManager.clearPendingSyncHistorySlugs(currentUid)
            repositoryScope.launch {
                try {
                    val res = networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "clear")
                    )
                    if (!res.isSuccessful) {
                        Log.w("UserSyncRepo", "clearHistory server error HTTP ${res.code()}: ${res.message()}")
                    }
                } catch (e: Exception) {
                    Log.e("UserSyncRepo", "clearHistory network failed: ${e.message}", e)
                }
            }
        }
    }

    // ── Watchlist (Xem Sau) ───────────────────────────────────────────────────

    @OptIn(ExperimentalCoroutinesApi::class)
    fun getAllWatchLater(): Flow<List<WatchLaterItem>> {
        return activeUserIdFlow.flatMapLatest { uid ->
            watchLaterDao.getAllWatchLater(uid).map { list ->
                list.map { it.toWatchLaterDomain() }
            }
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    fun isInWatchLater(slug: String): Flow<Boolean> {
        return activeUserIdFlow.flatMapLatest { uid ->
            watchLaterDao.isInWatchLater(uid, slug)
        }
    }

    suspend fun toggleWatchLater(movie: MovieDetail): Boolean {
        val slug = movie.slug
        val currentUid = secureStorageManager.activeUserId
        val exists = watchLaterDao.isInWatchLaterDirect(currentUid, slug)
        val nowIso = IsoTimestampHelper.nowIso()

        if (exists) {
            watchLaterDao.deleteBySlug(currentUid, slug)
            if (secureStorageManager.isLoggedIn) {
                secureStorageManager.addDeletedWatchLaterSlug(currentUid, slug)
                secureStorageManager.removePendingAddWatchLaterSlug(currentUid, slug)
                repositoryScope.launch {
                    try {
                        val res = networkModule.cinepvqApi.deleteWatchlist(slug = slug)
                        if (res.isSuccessful) {
                            secureStorageManager.removeDeletedWatchLaterSlug(currentUid, slug)
                        }
                    } catch (_: Exception) {}
                }
            }
            return false
        } else {
            val entity = WatchLaterEntity(
                userId = currentUid,
                slug = slug,
                name = movie.name,
                originalName = movie.originalName,
                thumbUrl = movie.thumbUrl,
                addedAt = nowIso
            )
            watchLaterDao.insert(entity)

            if (secureStorageManager.isLoggedIn) {
                secureStorageManager.addPendingAddWatchLaterSlug(currentUid, slug)
                secureStorageManager.removeDeletedWatchLaterSlug(currentUid, slug)
                repositoryScope.launch {
                    try {
                        val res = networkModule.cinepvqApi.updateWatchlist(
                            WatchlistActionRequest(
                                action = "add",
                                movie = WatchlistDto(
                                    slug = slug,
                                    name = movie.name,
                                    original_name = movie.originalName,
                                    thumb_url = movie.thumbUrl,
                                    poster_url = movie.posterUrl,
                                    year = movie.year,
                                    quality = movie.quality,
                                    addedAt = nowIso
                                )
                            )
                        )
                        if (res.isSuccessful) {
                            secureStorageManager.removePendingAddWatchLaterSlug(currentUid, slug)
                        }
                    } catch (_: Exception) {}
                }
            }
            return true
        }
    }

    suspend fun removeWatchLater(slug: String) {
        val currentUid = secureStorageManager.activeUserId
        watchLaterDao.deleteBySlug(currentUid, slug)
        if (secureStorageManager.isLoggedIn) {
            secureStorageManager.addDeletedWatchLaterSlug(currentUid, slug)
            secureStorageManager.removePendingAddWatchLaterSlug(currentUid, slug)
            repositoryScope.launch {
                try {
                    val res = networkModule.cinepvqApi.deleteWatchlist(slug = slug)
                    if (res.isSuccessful) {
                        secureStorageManager.removeDeletedWatchLaterSlug(currentUid, slug)
                    }
                } catch (_: Exception) {}
            }
        }
    }

    suspend fun clearWatchLater() {
        val currentUid = secureStorageManager.activeUserId
        watchLaterDao.clearByUser(currentUid)
        if (secureStorageManager.isLoggedIn) {
            secureStorageManager.clearPendingAddWatchLaterSlugs(currentUid)
            repositoryScope.launch {
                try {
                    val res = networkModule.cinepvqApi.deleteWatchlist(slug = null, clear = true)
                    if (!res.isSuccessful) {
                        networkModule.cinepvqApi.updateWatchlist(WatchlistActionRequest(action = "clear"))
                    }
                } catch (_: Exception) {
                    try {
                        networkModule.cinepvqApi.updateWatchlist(WatchlistActionRequest(action = "clear"))
                    } catch (_: Exception) {}
                }
            }
        }
    }

    // ── Guest Data Migration ──────────────────────────────────────────────────

    suspend fun migrateGuestDataToUser(newUserId: String) = withContext(Dispatchers.IO) {
        if (newUserId.isBlank() || newUserId == SecureStorageManager.GUEST_USER_ID) return@withContext

        // 1. Migrate guest favorites
        val guestFavs = favoriteDao.getAllFavoritesDirect(SecureStorageManager.GUEST_USER_ID)
        if (guestFavs.isNotEmpty()) {
            val userFavSlugs = favoriteDao.getAllFavoritesDirect(newUserId).map { it.slug }.toSet()
            val toInsert = guestFavs.filter { it.slug !in userFavSlugs }.map { it.copy(userId = newUserId) }
            if (toInsert.isNotEmpty()) {
                favoriteDao.insertAll(toInsert)
            }
            favoriteDao.clearByUser(SecureStorageManager.GUEST_USER_ID)
        }

        // 2. Migrate guest history
        val guestHistory = historyDao.getAllHistoryDirect(SecureStorageManager.GUEST_USER_ID)
        if (guestHistory.isNotEmpty()) {
            guestHistory.forEach { gh ->
                val userH = historyDao.getHistoryBySlug(newUserId, gh.slug)
                if (userH == null || gh.currentTime > userH.currentTime) {
                    historyDao.upsert(gh.copy(userId = newUserId))
                }
            }
            historyDao.clearByUser(SecureStorageManager.GUEST_USER_ID)
            secureStorageManager.migrateEpisodeProgress(SecureStorageManager.GUEST_USER_ID, newUserId)
        }

        // 3. Migrate guest watch later
        val guestWL = watchLaterDao.getAllWatchLaterDirect(SecureStorageManager.GUEST_USER_ID)
        if (guestWL.isNotEmpty()) {
            val userWLSlugs = watchLaterDao.getAllWatchLaterDirect(newUserId).map { it.slug }.toSet()
            val toInsert = guestWL.filter { it.slug !in userWLSlugs }.map { it.copy(userId = newUserId) }
            if (toInsert.isNotEmpty()) {
                watchLaterDao.insertAll(toInsert)
            }
            watchLaterDao.clearByUser(SecureStorageManager.GUEST_USER_ID)
        }

        // 4. Update active user flow to new user
        activeUserIdFlow.value = newUserId
    }

    suspend fun testConnection(): Result<Long> = networkModule.testConnection()

    /**
     * Complete synchronization of user identity (/api/user/sync) and two-way sync
     * for Favorites, Watch History, and Watchlist into Room SQLite database.
     */
    suspend fun syncAll(): Result<SyncResultSummary> = syncWithServer()

    suspend fun syncWithServer(): Result<SyncResultSummary> = withContext(Dispatchers.IO) {
        if (!secureStorageManager.isLoggedIn) {
            return@withContext Result.failure(Exception("Chưa đăng nhập"))
        }

        val currentUid = secureStorageManager.userId
            ?: return@withContext Result.failure(Exception("Không có User ID xác thực"))

        activeUserIdFlow.value = currentUid

        // 0. Sync User Profile Identity with backend (/api/user/sync)
        try {
            val userSyncRes = networkModule.cinepvqApi.syncUser()
            if (userSyncRes.isSuccessful && userSyncRes.body()?.user != null) {
                val profile = userSyncRes.body()!!.user!!
                secureStorageManager.userName = profile.username
                if (!profile.avatarUrl.isNullOrBlank()) {
                    secureStorageManager.userAvatar = profile.avatarUrl
                }
                Log.d("UserSyncRepo", "syncUser (/api/user/sync) succeeded for: ${profile.username}")
            } else {
                val code = userSyncRes.code()
                val msg = userSyncRes.message().ifBlank { "Lỗi phản hồi" }
                Log.w("UserSyncRepo", "syncUser (/api/user/sync) returned HTTP $code: $msg")
            }
        } catch (e: Exception) {
            Log.e("UserSyncRepo", "syncUser (/api/user/sync) network failure: ${e.message}", e)
        }

        val errors = mutableListOf<String>()
        var favCount = 0
        var histCount = 0
        var watchCount = 0

        // 1. Sync Favorites
        try {
            // First, process any pending deletions (tombstones) on the server
            val deletedSlugs = secureStorageManager.getDeletedFavoriteSlugs(currentUid)
            for (delSlug in deletedSlugs) {
                try {
                    val delRes = networkModule.cinepvqApi.updateFavorites(
                        FavoriteActionRequest(action = "remove", movieSlug = delSlug)
                    )
                    if (delRes.isSuccessful) {
                        secureStorageManager.removeDeletedFavoriteSlug(currentUid, delSlug)
                    }
                } catch (e: Exception) {
                    Log.w("UserSyncRepo", "Retry remove favorite for $delSlug failed: ${e.message}")
                }
            }

            val favRes = networkModule.cinepvqApi.getFavorites()
            if (favRes.isSuccessful && favRes.body()?.favorites != null) {
                val remoteFavs = favRes.body()!!.favorites
                val activeDeletedSlugs = secureStorageManager.getDeletedFavoriteSlugs(currentUid)
                // Filter out any favorites that were deleted locally
                val validRemoteFavs = remoteFavs.filter { it.slug !in activeDeletedSlugs }
                favCount = validRemoteFavs.size
                val validRemoteSlugs = validRemoteFavs.map { it.slug }.toSet()

                // Insert valid remote favorites into local Room DB for current user
                val entities = validRemoteFavs.map { r ->
                    FavoriteMovieEntity(
                        userId = currentUid,
                        slug = r.slug,
                        name = r.name,
                        originalName = r.original_name,
                        thumbUrl = r.thumb_url,
                        quality = r.quality,
                        currentEpisode = r.current_episode,
                        addedAt = if (!r.addedAt.isNullOrBlank()) r.addedAt else IsoTimestampHelper.nowIso()
                    )
                }
                favoriteDao.insertAll(entities)

                // Delete any local favorites that were marked as deleted locally
                for (delSlug in activeDeletedSlugs) {
                    favoriteDao.deleteBySlug(currentUid, delSlug)
                }

                val allLocalFavs = favoriteDao.getAllFavoritesDirect(currentUid)
                val pendingAdds = secureStorageManager.getPendingAddFavoriteSlugs(currentUid)

                // If an item in local Room is NOT in validRemoteSlugs and NOT in pendingAdds,
                // it was deleted on Web! Remove it from Room to reflect Web deletion.
                val deletedOnWeb = allLocalFavs.filter { it.slug !in validRemoteSlugs && it.slug !in pendingAdds }
                for (delItem in deletedOnWeb) {
                    favoriteDao.deleteBySlug(currentUid, delItem.slug)
                }

                // Push ONLY items that are truly pending local additions
                val localOnlyToPush = allLocalFavs.filter { it.slug in pendingAdds }
                if (localOnlyToPush.isNotEmpty()) {
                    val pushRes = networkModule.cinepvqApi.updateFavorites(
                        FavoriteActionRequest(
                            action = "sync",
                            favorites = localOnlyToPush.map { f ->
                                FavoriteMovieDto(
                                    slug = f.slug,
                                    name = f.name,
                                    original_name = f.originalName,
                                    thumb_url = f.thumbUrl,
                                    quality = f.quality,
                                    current_episode = f.currentEpisode,
                                    addedAt = f.addedAt.ifBlank { IsoTimestampHelper.nowIso() }
                                )
                            }
                        )
                    )
                    if (pushRes.isSuccessful) {
                        for (p in localOnlyToPush) {
                            secureStorageManager.removePendingAddFavoriteSlug(currentUid, p.slug)
                        }
                    } else {
                        Log.w("UserSyncRepo", "Push local favorites returned HTTP ${pushRes.code()}: ${pushRes.message()}")
                    }
                }
            } else {
                val err = "Lỗi tải Favorites (HTTP ${favRes.code()}: ${favRes.message().ifBlank { "Lỗi phản hồi" }})"
                Log.e("UserSyncRepo", err)
                errors.add(err)
            }
        } catch (e: Exception) {
            Log.e("UserSyncRepo", "Sync Favorites network failure: ${e.message}", e)
            errors.add("Favorites: ${e.localizedMessage ?: e.message}")
        }

        // 2. Sync Watch History with Timestamp Resolution and Web Deletion Sync
        try {
            // First, process any pending deletions (tombstones) on the server
            val deletedHistSlugs = secureStorageManager.getDeletedHistorySlugs(currentUid)
            for (delSlug in deletedHistSlugs) {
                try {
                    val delRes = networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "remove", movieSlug = delSlug)
                    )
                    if (delRes.isSuccessful) {
                        secureStorageManager.removeDeletedHistorySlug(currentUid, delSlug)
                    }
                } catch (_: Exception) {}
            }

            val histRes = networkModule.cinepvqApi.getHistory()
            if (histRes.isSuccessful && histRes.body()?.history != null) {
                val remoteHist = histRes.body()!!.history
                val activeDeletedHistSlugs = secureStorageManager.getDeletedHistorySlugs(currentUid)
                val validRemoteHist = remoteHist.filter { it.slug !in activeDeletedHistSlugs }
                histCount = validRemoteHist.size
                val validRemoteSlugs = validRemoteHist.map { it.slug }.toSet()
                val itemsToPush = mutableListOf<WatchHistoryDto>()
                val pendingSyncHistSlugs = secureStorageManager.getPendingSyncHistorySlugs(currentUid)

                // Delete any local items marked as deleted locally
                for (delSlug in activeDeletedHistSlugs) {
                    historyDao.deleteBySlug(currentUid, delSlug)
                }

                // Compare remote items with local items of current user
                validRemoteHist.forEach { r ->
                    val local = historyDao.getHistoryBySlug(currentUid, r.slug)
                    val timeRemote = parseTime(r.updatedAt)
                    val timeLocal = parseTime(local?.updatedAt)

                    if (local == null || timeRemote >= timeLocal) {
                        historyDao.upsert(
                            WatchHistoryEntity(
                                userId = currentUid,
                                slug = r.slug,
                                name = r.name,
                                originalName = r.original_name,
                                thumbUrl = r.thumb_url,
                                episodeSlug = r.episodeSlug,
                                episodeName = r.episodeName,
                                currentTime = r.currentTime,
                                duration = r.duration,
                                updatedAt = if (!r.updatedAt.isNullOrBlank()) r.updatedAt else IsoTimestampHelper.nowIso()
                            )
                        )
                        if (!r.episodeSlug.isNullOrBlank()) {
                            saveEpisodeProgress(r.slug, r.episodeSlug, r.currentTime, r.duration)
                        }
                        secureStorageManager.removePendingSyncHistorySlug(currentUid, r.slug)
                    } else {
                        // Local has newer timestamp than remote: push local update to server
                        itemsToPush.add(
                            WatchHistoryDto(
                                slug = local.slug,
                                name = local.name,
                                original_name = local.originalName,
                                thumb_url = local.thumbUrl,
                                episodeSlug = local.episodeSlug,
                                episodeName = local.episodeName,
                                currentTime = local.currentTime,
                                duration = local.duration,
                                updatedAt = local.updatedAt.ifBlank { IsoTimestampHelper.nowIso() }
                            )
                        )
                    }
                }

                val allLocal = historyDao.getAllHistoryDirect(currentUid)
                // If an item in Room is NOT in validRemoteSlugs and NOT in pendingSyncHistSlugs:
                // It was deleted on Web! Remove it from local Room DB to reflect Web deletion.
                val deletedOnWeb = allLocal.filter { it.slug !in validRemoteSlugs && it.slug !in pendingSyncHistSlugs }
                for (delItem in deletedOnWeb) {
                    historyDao.deleteBySlug(currentUid, delItem.slug)
                    secureStorageManager.removeEpisodeProgressForMovie(currentUid, delItem.slug)
                }

                // Push ONLY items that are truly pending local additions/offline watches
                val localOnlyToPush = allLocal.filter { it.slug !in validRemoteSlugs && it.slug in pendingSyncHistSlugs }
                localOnlyToPush.forEach { local ->
                    itemsToPush.add(
                        WatchHistoryDto(
                            slug = local.slug,
                            name = local.name,
                            original_name = local.originalName,
                            thumb_url = local.thumbUrl,
                            episodeSlug = local.episodeSlug,
                            episodeName = local.episodeName,
                            currentTime = local.currentTime,
                            duration = local.duration,
                            updatedAt = local.updatedAt.ifBlank { IsoTimestampHelper.nowIso() }
                        )
                    )
                }

                // Push itemsToPush back to server
                if (itemsToPush.isNotEmpty()) {
                    val pushRes = networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "sync", history = itemsToPush)
                    )
                    if (pushRes.isSuccessful) {
                        for (p in itemsToPush) {
                            secureStorageManager.removePendingSyncHistorySlug(currentUid, p.slug)
                        }
                    } else {
                        Log.w("UserSyncRepo", "Push local history returned HTTP ${pushRes.code()}: ${pushRes.message()}")
                    }
                }
            } else {
                val err = "Lỗi tải History (HTTP ${histRes.code()}: ${histRes.message().ifBlank { "Lỗi phản hồi" }})"
                Log.e("UserSyncRepo", err)
                errors.add(err)
            }
        } catch (e: Exception) {
            Log.e("UserSyncRepo", "Sync History network failure: ${e.message}", e)
            errors.add("History: ${e.localizedMessage ?: e.message}")
        }

        // 3. Sync Watchlist (Xem Sau)
        try {
            // First, process any pending deletions (tombstones) on the server
            val deletedWlSlugs = secureStorageManager.getDeletedWatchLaterSlugs(currentUid)
            for (delSlug in deletedWlSlugs) {
                try {
                    val delRes = networkModule.cinepvqApi.deleteWatchlist(slug = delSlug)
                    if (delRes.isSuccessful) {
                        secureStorageManager.removeDeletedWatchLaterSlug(currentUid, delSlug)
                    }
                } catch (e: Exception) {
                    Log.w("UserSyncRepo", "Retry delete watchlist for $delSlug failed: ${e.message}")
                }
            }

            val watchRes = networkModule.cinepvqApi.getWatchlist()
            if (watchRes.isSuccessful && watchRes.body()?.watchlist != null) {
                val remoteWatch = watchRes.body()!!.watchlist
                val activeDeletedSlugs = secureStorageManager.getDeletedWatchLaterSlugs(currentUid)
                val validRemoteWatch = remoteWatch.filter { it.slug !in activeDeletedSlugs }
                watchCount = validRemoteWatch.size
                val validRemoteSlugs = validRemoteWatch.map { it.slug }.toSet()

                // Insert valid remote items into local Room DB
                val entities = validRemoteWatch.map { r ->
                    WatchLaterEntity(
                        userId = currentUid,
                        slug = r.slug,
                        name = r.name,
                        originalName = r.original_name,
                        thumbUrl = r.thumb_url,
                        addedAt = if (!r.addedAt.isNullOrBlank()) r.addedAt else IsoTimestampHelper.nowIso()
                    )
                }
                watchLaterDao.insertAll(entities)

                // Delete any local items marked as deleted locally
                for (delSlug in activeDeletedSlugs) {
                    watchLaterDao.deleteBySlug(currentUid, delSlug)
                }

                val allLocal = watchLaterDao.getAllWatchLaterDirect(currentUid)
                val pendingAdds = secureStorageManager.getPendingAddWatchLaterSlugs(currentUid)

                // If an item in Room is NOT in validRemoteSlugs and NOT in pendingAdds,
                // it was deleted on Web! Remove it from local Room DB to reflect Web deletion.
                val deletedOnWeb = allLocal.filter { it.slug !in validRemoteSlugs && it.slug !in pendingAdds }
                for (delItem in deletedOnWeb) {
                    watchLaterDao.deleteBySlug(currentUid, delItem.slug)
                }

                // Push ONLY items that are truly pending local additions
                val localOnlyToPush = allLocal.filter { it.slug in pendingAdds }
                if (localOnlyToPush.isNotEmpty()) {
                    val pushRes = networkModule.cinepvqApi.updateWatchlist(
                        WatchlistActionRequest(
                            action = "sync",
                            watchlist = localOnlyToPush.map { f ->
                                WatchlistDto(
                                    slug = f.slug,
                                    name = f.name,
                                    original_name = f.originalName,
                                    thumb_url = f.thumbUrl,
                                    addedAt = f.addedAt.ifBlank { IsoTimestampHelper.nowIso() }
                                )
                            }
                        )
                    )
                    if (pushRes.isSuccessful) {
                        for (p in localOnlyToPush) {
                            secureStorageManager.removePendingAddWatchLaterSlug(currentUid, p.slug)
                        }
                    } else {
                        Log.w("UserSyncRepo", "Push local watchlist returned HTTP ${pushRes.code()}: ${pushRes.message()}")
                    }
                }
            } else {
                val err = "Lỗi tải Watchlist (HTTP ${watchRes.code()}: ${watchRes.message().ifBlank { "Lỗi phản hồi" }})"
                Log.e("UserSyncRepo", err)
                errors.add(err)
            }
        } catch (e: Exception) {
            Log.e("UserSyncRepo", "Sync Watchlist network failure: ${e.message}", e)
            errors.add("Watchlist: ${e.localizedMessage ?: e.message}")
        }

        if (errors.isNotEmpty()) {
            val combined = errors.joinToString("; ")
            Result.failure(Exception(combined))
        } else {
            Result.success(
                SyncResultSummary(
                    isSuccess = true,
                    favoritesCount = favCount,
                    historyCount = histCount,
                    watchlistCount = watchCount
                )
            )
        }
    }

    private fun parseTime(iso: String?): Long = IsoTimestampHelper.parseIsoToEpochMillis(iso)

    private fun FavoriteMovieEntity.toDomain() = FavoriteMovie(
        slug = slug,
        name = name,
        originalName = originalName,
        thumbUrl = thumbUrl,
        quality = quality,
        currentEpisode = currentEpisode,
        addedAt = addedAt
    )

    private fun WatchHistoryEntity.toDomain() = WatchHistoryItem(
        slug = slug,
        name = name,
        originalName = originalName,
        thumbUrl = thumbUrl,
        episodeSlug = episodeSlug,
        episodeName = episodeName,
        currentTime = currentTime,
        duration = duration,
        updatedAt = updatedAt
    )

    private fun WatchLaterEntity.toWatchLaterDomain() = WatchLaterItem(
        slug = slug,
        name = name,
        originalName = originalName,
        thumbUrl = thumbUrl,
        addedAt = addedAt
    )
}
