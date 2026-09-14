package com.pvq.cinepvq.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        FavoriteMovieEntity::class,
        WatchHistoryEntity::class,
        MovieCacheEntity::class,
        WatchLaterEntity::class,
        SearchHistoryEntity::class
    ],
    version = 3,
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

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. Migrate favorites
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS favorites_new (
                        userId TEXT NOT NULL,
                        slug TEXT NOT NULL,
                        name TEXT NOT NULL,
                        originalName TEXT,
                        thumbUrl TEXT NOT NULL,
                        quality TEXT,
                        currentEpisode TEXT,
                        addedAt TEXT NOT NULL,
                        PRIMARY KEY(userId, slug)
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT OR IGNORE INTO favorites_new (userId, slug, name, originalName, thumbUrl, quality, currentEpisode, addedAt)
                    SELECT 'guest', slug, name, originalName, thumbUrl, quality, currentEpisode, addedAt FROM favorites
                """.trimIndent())
                db.execSQL("DROP TABLE favorites")
                db.execSQL("ALTER TABLE favorites_new RENAME TO favorites")

                // 2. Migrate watch_history
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS watch_history_new (
                        userId TEXT NOT NULL,
                        slug TEXT NOT NULL,
                        name TEXT NOT NULL,
                        originalName TEXT,
                        thumbUrl TEXT NOT NULL,
                        episodeSlug TEXT,
                        episodeName TEXT,
                        currentTime INTEGER NOT NULL,
                        duration INTEGER NOT NULL,
                        updatedAt TEXT NOT NULL,
                        PRIMARY KEY(userId, slug)
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT OR IGNORE INTO watch_history_new (userId, slug, name, originalName, thumbUrl, episodeSlug, episodeName, currentTime, duration, updatedAt)
                    SELECT 'guest', slug, name, originalName, thumbUrl, episodeSlug, episodeName, currentTime, duration, updatedAt FROM watch_history
                """.trimIndent())
                db.execSQL("DROP TABLE watch_history")
                db.execSQL("ALTER TABLE watch_history_new RENAME TO watch_history")

                // 3. Migrate watch_later
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS watch_later_new (
                        userId TEXT NOT NULL,
                        slug TEXT NOT NULL,
                        name TEXT NOT NULL,
                        originalName TEXT,
                        thumbUrl TEXT NOT NULL,
                        addedAt TEXT NOT NULL,
                        PRIMARY KEY(userId, slug)
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT OR IGNORE INTO watch_later_new (userId, slug, name, originalName, thumbUrl, addedAt)
                    SELECT 'guest', slug, name, originalName, thumbUrl, addedAt FROM watch_later
                """.trimIndent())
                db.execSQL("DROP TABLE watch_later")
                db.execSQL("ALTER TABLE watch_later_new RENAME TO watch_later")

                // 4. Migrate search_history
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS search_history_new (
                        userId TEXT NOT NULL,
                        `query` TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        PRIMARY KEY(userId, `query`)
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT OR IGNORE INTO search_history_new (userId, `query`, timestamp)
                    SELECT 'guest', `query`, timestamp FROM search_history
                """.trimIndent())
                db.execSQL("DROP TABLE search_history")
                db.execSQL("ALTER TABLE search_history_new RENAME TO search_history")
            }
        }

        fun getInstance(context: Context): CinepvqDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CinepvqDatabase::class.java,
                    "cinepvq_database"
                )
                    .addMigrations(MIGRATION_2_3)
                    .fallbackToDestructiveMigration(false)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
