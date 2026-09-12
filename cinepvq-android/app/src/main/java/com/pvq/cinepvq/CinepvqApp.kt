package com.pvq.cinepvq

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.disk.directory
import coil3.memory.MemoryCache
import coil3.request.crossfade
import com.pvq.cinepvq.core.database.CinepvqDatabase
import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.core.security.SecureStorageManager
import com.pvq.cinepvq.data.auth.AuthRepository
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.player.VideoSourceRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CinepvqApp : Application(), SingletonImageLoader.Factory {

    val appScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    val secureStorageManager: SecureStorageManager by lazy {
        SecureStorageManager(this)
    }

    val database: CinepvqDatabase by lazy {
        CinepvqDatabase.getInstance(this)
    }

    val networkModule: NetworkModule by lazy {
        NetworkModule(secureStorageManager)
    }

    val authRepository: AuthRepository by lazy {
        AuthRepository(networkModule, secureStorageManager)
    }

    val movieRepository: MovieRepository by lazy {
        MovieRepository(networkModule, database)
    }

    val videoSourceRepository: VideoSourceRepository by lazy {
        VideoSourceRepository(networkModule)
    }

    val userSyncRepository: UserSyncRepository by lazy {
        UserSyncRepository(networkModule, database, secureStorageManager)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Trigger initial background sync if user is logged in
        if (secureStorageManager.isLoggedIn) {
            appScope.launch(Dispatchers.IO) {
                try {
                    userSyncRepository.syncWithServer()
                } catch (_: Exception) {}
            }
        }
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader {
        return ImageLoader.Builder(context)
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(context, 0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.05)
                    .build()
            }
            .crossfade(true)
            .build()
    }

    companion object {
        lateinit var instance: CinepvqApp
            private set
    }
}
