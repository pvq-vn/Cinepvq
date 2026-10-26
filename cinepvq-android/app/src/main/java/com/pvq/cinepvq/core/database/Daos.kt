package com.pvq.cinepvq.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites WHERE userId = :userId ORDER BY addedAt DESC")
    fun getAllFavorites(userId: String): Flow<List<FavoriteMovieEntity>>

    @Query("SELECT * FROM favorites WHERE userId = :userId ORDER BY addedAt DESC")
    suspend fun getAllFavoritesDirect(userId: String): List<FavoriteMovieEntity>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE userId = :userId AND slug = :slug)")
    fun isFavorite(userId: String, slug: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE userId = :userId AND slug = :slug)")
    suspend fun isFavoriteDirect(userId: String, slug: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: FavoriteMovieEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<FavoriteMovieEntity>)

    @Query("DELETE FROM favorites WHERE userId = :userId AND slug = :slug")
    suspend fun deleteBySlug(userId: String, slug: String): Int

    @Query("DELETE FROM favorites WHERE userId = :userId")
    suspend fun clearByUser(userId: String): Int
}

@Dao
interface WatchHistoryDao {
    @Query("SELECT * FROM watch_history WHERE userId = :userId ORDER BY updatedAt DESC")
    fun getAllHistory(userId: String): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM watch_history WHERE userId = :userId ORDER BY updatedAt DESC")
    suspend fun getAllHistoryDirect(userId: String): List<WatchHistoryEntity>

    @Query("SELECT * FROM watch_history WHERE userId = :userId AND slug = :slug LIMIT 1")
    suspend fun getHistoryBySlug(userId: String, slug: String): WatchHistoryEntity?

    @Query("SELECT * FROM watch_history WHERE userId = :userId AND slug = :slug LIMIT 1")
    fun observeHistoryBySlug(userId: String, slug: String): Flow<WatchHistoryEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: WatchHistoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<WatchHistoryEntity>)

    @Query("DELETE FROM watch_history WHERE userId = :userId AND slug = :slug")
    suspend fun deleteBySlug(userId: String, slug: String): Int

    @Query("DELETE FROM watch_history WHERE userId = :userId")
    suspend fun clearByUser(userId: String): Int
}

@Dao
interface MovieCacheDao {
    @Query("SELECT * FROM movie_cache WHERE slug = :slug LIMIT 1")
    suspend fun getMovieBySlug(slug: String): MovieCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: MovieCacheEntity)

    @Query("DELETE FROM movie_cache WHERE cachedAt < :cutoffTime")
    suspend fun deleteOlderThan(cutoffTime: Long): Int
}

@Dao
interface WatchLaterDao {
    @Query("SELECT * FROM watch_later WHERE userId = :userId ORDER BY addedAt DESC")
    fun getAllWatchLater(userId: String): Flow<List<WatchLaterEntity>>

    @Query("SELECT * FROM watch_later WHERE userId = :userId ORDER BY addedAt DESC")
    suspend fun getAllWatchLaterDirect(userId: String): List<WatchLaterEntity>

    @Query("SELECT EXISTS(SELECT 1 FROM watch_later WHERE userId = :userId AND slug = :slug)")
    fun isInWatchLater(userId: String, slug: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM watch_later WHERE userId = :userId AND slug = :slug)")
    suspend fun isInWatchLaterDirect(userId: String, slug: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: WatchLaterEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<WatchLaterEntity>)

    @Query("DELETE FROM watch_later WHERE userId = :userId AND slug = :slug")
    suspend fun deleteBySlug(userId: String, slug: String): Int

    @Query("DELETE FROM watch_later WHERE userId = :userId")
    suspend fun clearByUser(userId: String): Int
}

@Dao
interface SearchHistoryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(history: SearchHistoryEntity)

    @Query("SELECT * FROM search_history WHERE userId = :userId ORDER BY timestamp DESC LIMIT 20")
    fun getRecentSearches(userId: String): Flow<List<SearchHistoryEntity>>

    @Query("DELETE FROM search_history WHERE userId = :userId AND `query` = :query")
    suspend fun delete(userId: String, query: String): Int

    @Query("DELETE FROM search_history WHERE userId = :userId")
    suspend fun clearByUser(userId: String): Int
}
