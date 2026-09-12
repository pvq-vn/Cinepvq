package com.pvq.cinepvq.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites ORDER BY addedAt DESC")
    fun getAllFavorites(): Flow<List<FavoriteMovieEntity>>

    @Query("SELECT * FROM favorites ORDER BY addedAt DESC")
    suspend fun getAllFavoritesDirect(): List<FavoriteMovieEntity>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE slug = :slug)")
    fun isFavorite(slug: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE slug = :slug)")
    suspend fun isFavoriteDirect(slug: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: FavoriteMovieEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<FavoriteMovieEntity>)

    @Query("DELETE FROM favorites WHERE slug = :slug")
    suspend fun deleteBySlug(slug: String): Int

    @Query("DELETE FROM favorites")
    suspend fun clearAll(): Int
}

@Dao
interface WatchHistoryDao {
    @Query("SELECT * FROM watch_history ORDER BY updatedAt DESC")
    fun getAllHistory(): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM watch_history ORDER BY updatedAt DESC")
    suspend fun getAllHistoryDirect(): List<WatchHistoryEntity>

    @Query("SELECT * FROM watch_history WHERE slug = :slug LIMIT 1")
    suspend fun getHistoryBySlug(slug: String): WatchHistoryEntity?

    @Query("SELECT * FROM watch_history WHERE slug = :slug LIMIT 1")
    fun observeHistoryBySlug(slug: String): Flow<WatchHistoryEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: WatchHistoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<WatchHistoryEntity>)

    @Query("DELETE FROM watch_history WHERE slug = :slug")
    suspend fun deleteBySlug(slug: String): Int

    @Query("DELETE FROM watch_history")
    suspend fun clearAll(): Int
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
    @Query("SELECT * FROM watch_later ORDER BY addedAt DESC")
    fun getAllWatchLater(): Flow<List<WatchLaterEntity>>

    @Query("SELECT * FROM watch_later ORDER BY addedAt DESC")
    suspend fun getAllWatchLaterDirect(): List<WatchLaterEntity>

    @Query("SELECT EXISTS(SELECT 1 FROM watch_later WHERE slug = :slug)")
    fun isInWatchLater(slug: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM watch_later WHERE slug = :slug)")
    suspend fun isInWatchLaterDirect(slug: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: WatchLaterEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<WatchLaterEntity>)

    @Query("DELETE FROM watch_later WHERE slug = :slug")
    suspend fun deleteBySlug(slug: String): Int

    @Query("DELETE FROM watch_later")
    suspend fun clearAll(): Int
}

@Dao
interface SearchHistoryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(history: SearchHistoryEntity)

    @Query("SELECT * FROM search_history ORDER BY timestamp DESC LIMIT 20")
    fun getRecentSearches(): Flow<List<SearchHistoryEntity>>

    @Query("DELETE FROM search_history WHERE `query` = :query")
    suspend fun delete(query: String)

    @Query("DELETE FROM search_history")
    suspend fun clearAll()
}
