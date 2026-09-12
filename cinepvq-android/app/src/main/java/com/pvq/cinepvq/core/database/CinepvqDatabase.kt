package com.pvq.cinepvq.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        FavoriteMovieEntity::class,
        WatchHistoryEntity::class,
        MovieCacheEntity::class,
        WatchLaterEntity::class,
        SearchHistoryEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class CinepvqDatabase : RoomDatabase() {

    abstract fun favoriteDao(): FavoriteDao
    abstract fun watchHistoryDao(): WatchHistoryDao
    abstract fun movieCacheDao(): MovieCacheDao
    abstract fun watchLaterDao(): WatchLaterDao
    abstract fun searchHistoryDao(): SearchHistoryDao

    companion object {
        @Volatile
        private var INSTANCE: CinepvqDatabase? = null

        fun getInstance(context: Context): CinepvqDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CinepvqDatabase::class.java,
                    "cinepvq_database"
                )
                    .fallbackToDestructiveMigration(true)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
