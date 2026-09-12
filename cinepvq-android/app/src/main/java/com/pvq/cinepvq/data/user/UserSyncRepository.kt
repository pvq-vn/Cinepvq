package com.pvq.cinepvq.data.user

import com.pvq.cinepvq.core.database.CinepvqDatabase
import com.pvq.cinepvq.core.database.FavoriteMovieEntity
import com.pvq.cinepvq.core.database.WatchHistoryEntity
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
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.text.SimpleDateFormat
import java.util.*

class UserSyncRepository(
    private val networkModule: NetworkModule,
    private val database: CinepvqDatabase,
    private val secureStorageManager: SecureStorageManager,
    private val repositoryScope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
) {
    private val favoriteDao = database.favoriteDao()
    private val historyDao = database.watchHistoryDao()

    private var progressSyncJob: Job? = null
    private var pendingProgress: HistoryActionRequest? = null

    private val isoDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    // ── Favorites ─────────────────────────────────────────────────────────────

    fun getAllFavorites(): Flow<List<FavoriteMovie>> {
        return favoriteDao.getAllFavorites().map { list ->
            list.map { it.toDomain() }
        }
    }

    fun isFavorite(slug: String): Flow<Boolean> {
        return favoriteDao.isFavorite(slug)
    }

    suspend fun toggleFavorite(movie: MovieDetail): Boolean {
        val slug = movie.slug
        val exists = favoriteDao.isFavoriteDirect(slug)
        val nowIso = isoDateFormat.format(Date())

        if (exists) {
            favoriteDao.deleteBySlug(slug)
            if (secureStorageManager.isLoggedIn) {
                repositoryScope.launch {
                    try {
                        networkModule.cinepvqApi.updateFavorites(
                            FavoriteActionRequest(action = "remove", movieSlug = slug)
                        )
                    } catch (_: Exception) {}
                }
            }
            return false
        } else {
            val entity = FavoriteMovieEntity(
                slug = slug,
                name = movie.name,
                originalName = movie.originalName,
                thumbUrl = movie.thumbUrl,
                quality = movie.quality,
                currentEpisode = movie.episodeCurrent,
                addedAt = nowIso
            )
            favoriteDao.insert(entity)

            if (secureStorageManager.isLoggedIn) {
                repositoryScope.launch {
                    try {
                        networkModule.cinepvqApi.updateFavorites(
                            FavoriteActionRequest(
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
                    } catch (_: Exception) {}
                }
            }
            return true
        }
    }

    suspend fun removeFavorite(slug: String) {
        favoriteDao.deleteBySlug(slug)
        if (secureStorageManager.isLoggedIn) {
            repositoryScope.launch {
                try {
                    networkModule.cinepvqApi.updateFavorites(
                        FavoriteActionRequest(action = "remove", movieSlug = slug)
                    )
                } catch (_: Exception) {}
            }
        }
    }

    // ── Watch History & Playback Progress ──────────────────────────────────────

    fun getAllHistory(): Flow<List<WatchHistoryItem>> {
        return historyDao.getAllHistory().map { list ->
            list.map { it.toDomain() }
        }
    }

    fun getHistory(slug: String): Flow<WatchHistoryItem?> {
        return historyDao.observeHistoryBySlug(slug).map { it?.toDomain() }
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
        val nowIso = isoDateFormat.format(Date())

        // 1. Update local Room SQLite immediately
        val entity = WatchHistoryEntity(
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
            pendingProgress = HistoryActionRequest(
                action = "upsert",
                movieSlug = movieSlug,
                episodeSlug = episodeSlug,
                position = currentTime,
                duration = duration,
                updatedAt = nowIso
            )

            progressSyncJob?.cancel()
            progressSyncJob = repositoryScope.launch {
                delay(1500)
                val target = pendingProgress ?: return@launch
                pendingProgress = null
                try {
                    networkModule.cinepvqApi.updateHistory(target)
                } catch (_: Exception) {}
            }
        }
    }

    suspend fun removeHistory(slug: String) {
        historyDao.deleteBySlug(slug)
        if (secureStorageManager.isLoggedIn) {
            repositoryScope.launch {
                try {
                    networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "remove", movieSlug = slug)
                    )
                } catch (_: Exception) {}
            }
        }
    }

    suspend fun clearHistory() {
        historyDao.clearAll()
        if (secureStorageManager.isLoggedIn) {
            repositoryScope.launch {
                try {
                    networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "clear")
                    )
                } catch (_: Exception) {}
            }
        }
    }

    // ── Two-Way Synchronizer (Web <-> Android Conflict Handling) ──────────────

    suspend fun syncWithServer() = withContext(Dispatchers.IO) {
        if (!secureStorageManager.isLoggedIn) return@withContext

        // 1. Sync Favorites
        try {
            val favRes = networkModule.cinepvqApi.getFavorites()
            if (favRes.isSuccessful && favRes.body()?.favorites != null) {
                val remoteFavs = favRes.body()!!.favorites
                val remoteFavSlugs = remoteFavs.map { it.slug }.toSet()

                // Insert all remote favorites into local Room DB
                val entities = remoteFavs.map { r ->
                    FavoriteMovieEntity(
                        slug = r.slug,
                        name = r.name,
                        originalName = r.original_name,
                        thumbUrl = r.thumb_url,
                        quality = r.quality,
                        currentEpisode = r.current_episode,
                        addedAt = r.addedAt ?: ""
                    )
                }
                favoriteDao.insertAll(entities)

                // Push any local-only favorites (e.g. guest favorites created before login)
                val allLocalFavs = favoriteDao.getAllFavoritesDirect()
                val localOnlyFavs = allLocalFavs.filter { it.slug !in remoteFavSlugs }
                if (localOnlyFavs.isNotEmpty()) {
                    networkModule.cinepvqApi.updateFavorites(
                        FavoriteActionRequest(
                            action = "sync",
                            favorites = localOnlyFavs.map { f ->
                                FavoriteMovieDto(
                                    slug = f.slug,
                                    name = f.name,
                                    original_name = f.originalName,
                                    thumb_url = f.thumbUrl,
                                    quality = f.quality,
                                    current_episode = f.currentEpisode,
                                    addedAt = f.addedAt
                                )
                            }
                        )
                    )
                }
            }
        } catch (_: Exception) {}

        // 2. Sync Watch History with Timestamp Resolution (Cases A - F)
        try {
            val histRes = networkModule.cinepvqApi.getHistory()
            if (histRes.isSuccessful && histRes.body()?.history != null) {
                val remoteHist = histRes.body()!!.history
                val remoteSlugs = remoteHist.map { it.slug }.toSet()
                val itemsToPush = mutableListOf<WatchHistoryDto>()

                // Compare remote items with local items
                remoteHist.forEach { r ->
                    val local = historyDao.getHistoryBySlug(r.slug)
                    val timeRemote = parseTime(r.updatedAt)
                    val timeLocal = parseTime(local?.updatedAt)

                    if (local == null || timeRemote >= timeLocal) {
                        // Case A (remote newer), Case C (equal timestamps), Case E (remote-only): remote wins
                        historyDao.upsert(
                            WatchHistoryEntity(
                                slug = r.slug,
                                name = r.name,
                                originalName = r.original_name,
                                thumbUrl = r.thumb_url,
                                episodeSlug = r.episodeSlug,
                                episodeName = r.episodeName,
                                currentTime = r.currentTime,
                                duration = r.duration,
                                updatedAt = r.updatedAt ?: ""
                            )
                        )
                    } else {
                        // Case B (local newer), Case F (newer episode in local): push local to server
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
                                updatedAt = local.updatedAt
                            )
                        )
                    }
                }

                // Case D: Local-only items (not present on remote): push to server
                val allLocal = historyDao.getAllHistoryDirect()
                val localOnly = allLocal.filter { it.slug !in remoteSlugs }
                localOnly.forEach { local ->
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
                            updatedAt = local.updatedAt
                        )
                    )
                }

                // Push itemsToPush back to server
                if (itemsToPush.isNotEmpty()) {
                    networkModule.cinepvqApi.updateHistory(
                        HistoryActionRequest(action = "sync", history = itemsToPush)
                    )
                }
            }
        } catch (_: Exception) {}

        // 3. Sync Watchlist (Xem Sau)
        try {
            val watchRes = networkModule.cinepvqApi.getWatchlist()
            if (watchRes.isSuccessful && watchRes.body()?.watchlist != null) {
                val remoteWatch = watchRes.body()!!.watchlist
                val remoteSlugs = remoteWatch.map { it.slug }.toSet()
                
                // Compare remote items with local items
                remoteWatch.forEach { r ->
                    val local = watchLaterDao.isInWatchLaterDirect(r.slug)
                    if (!local) {
                        watchLaterDao.insert(
                            com.pvq.cinepvq.core.database.WatchLaterEntity(
                                slug = r.slug,
                                name = r.name,
                                originalName = r.original_name,
                                thumbUrl = r.thumb_url,
                                addedAt = r.addedAt ?: ""
                            )
                        )
                    }
                }
                
                val allLocal = watchLaterDao.getAllWatchLaterDirect()
                val localOnly = allLocal.filter { it.slug !in remoteSlugs }
                if (localOnly.isNotEmpty()) {
                    networkModule.cinepvqApi.updateWatchlist(
                        WatchlistActionRequest(
                            action = "sync",
                            watchlist = localOnly.map { f ->
                                WatchlistDto(
                                    slug = f.slug,
                                    name = f.name,
                                    original_name = f.originalName,
                                    thumb_url = f.thumbUrl,
                                    addedAt = f.addedAt
                                )
                            }
                        )
                    )
                }
            }
        } catch (_: Exception) {}
    }

    private fun parseTime(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        return try {
            isoDateFormat.parse(iso)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

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

    // ── Watchlist (Xem Sau) ───────────────────────────────────────────────────

    private val watchLaterDao = database.watchLaterDao()

    fun getAllWatchLater(): Flow<List<com.pvq.cinepvq.domain.model.WatchLaterItem>> {
        return watchLaterDao.getAllWatchLater().map { list ->
            list.map { it.toWatchLaterDomain() }
        }
    }

    fun isInWatchLater(slug: String): Flow<Boolean> {
        return watchLaterDao.isInWatchLater(slug)
    }

    suspend fun toggleWatchLater(movie: MovieDetail): Boolean {
        val slug = movie.slug
        val exists = watchLaterDao.isInWatchLaterDirect(slug)
        val nowIso = isoDateFormat.format(Date())

        if (exists) {
            watchLaterDao.deleteBySlug(slug)
            if (secureStorageManager.isLoggedIn) {
                repositoryScope.launch {
                    try {
                        networkModule.cinepvqApi.deleteWatchlist(slug = slug)
                    } catch (_: Exception) {}
                }
            }
            return false
        } else {
            val entity = com.pvq.cinepvq.core.database.WatchLaterEntity(
                slug = slug,
                name = movie.name,
                originalName = movie.originalName,
                thumbUrl = movie.thumbUrl,
                addedAt = nowIso
            )
            watchLaterDao.insert(entity)

            if (secureStorageManager.isLoggedIn) {
                repositoryScope.launch {
                    try {
                        networkModule.cinepvqApi.updateWatchlist(
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
                    } catch (_: Exception) {}
                }
            }
            return true
        }
    }

    suspend fun removeWatchLater(slug: String) {
        watchLaterDao.deleteBySlug(slug)
        if (secureStorageManager.isLoggedIn) {
            repositoryScope.launch {
                try {
                    networkModule.cinepvqApi.deleteWatchlist(slug = slug)
                } catch (_: Exception) {}
            }
        }
    }

    private fun com.pvq.cinepvq.core.database.WatchLaterEntity.toWatchLaterDomain() = com.pvq.cinepvq.domain.model.WatchLaterItem(
        slug = slug,
        name = name,
        originalName = originalName,
        thumbUrl = thumbUrl,
        addedAt = addedAt
    )
}
