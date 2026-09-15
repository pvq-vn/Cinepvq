package com.pvq.cinepvq.core.security

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.pvq.cinepvq.BuildConfig

class SecureStorageManager(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFS_FILENAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback to private preferences if Keystore is unavailable (e.g. some custom ROMs/emulators)
        context.getSharedPreferences(PREFS_FILENAME, Context.MODE_PRIVATE)
    }

    @Volatile
    private var inMemoryAccessToken: String? = null

    var accessToken: String?
        get() {
            val mem = inMemoryAccessToken
            if (!mem.isNullOrBlank()) return mem
            val disk = sanitizeToken(prefs.getString(KEY_ACCESS_TOKEN, null))
            inMemoryAccessToken = disk
            return disk
        }
        set(value) {
            val clean = sanitizeToken(value)
            inMemoryAccessToken = clean
            try {
                prefs.edit().putString(KEY_ACCESS_TOKEN, clean).commit()
            } catch (e: Exception) {
                prefs.edit().putString(KEY_ACCESS_TOKEN, clean).apply()
            }
        }

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    var userId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) = prefs.edit().putString(KEY_USER_ID, value).apply()

    var userEmail: String?
        get() = prefs.getString(KEY_USER_EMAIL, null)
        set(value) = prefs.edit().putString(KEY_USER_EMAIL, value).apply()

    var userName: String?
        get() = prefs.getString(KEY_USER_NAME, null)
        set(value) = prefs.edit().putString(KEY_USER_NAME, value).apply()

    var userAvatar: String?
        get() = prefs.getString(KEY_USER_AVATAR, null)
        set(value) = prefs.edit().putString(KEY_USER_AVATAR, value).apply()

    fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
                || "google_sdk" == Build.PRODUCT
                || Build.HARDWARE.contains("goldfish")
                || Build.HARDWARE.contains("ranchu"))
    }

    fun getDefaultBackendUrl(): String {
        return BuildConfig.DEFAULT_PROD_URL
    }

    var backendBaseUrl: String
        get() {
            val saved = prefs.getString(KEY_BACKEND_URL, null)
            // Auto-heal legacy broken or unreachable URLs:
            // 1. empty or blank
            // 2. Contains 127.0.0.1 or localhost (unreachable on real devices)
            // 3. Contains 10.0.2.2 on real devices
            // 4. Contains 192.168.1.80 (old hardcoded LAN IP)
            // 5. Contains cinepvq-web.vercel.app (old 404 domain)
            if (saved.isNullOrBlank() ||
                saved.contains("cinepvq-web.vercel.app") ||
                saved.contains("192.168.1.80") ||
                (!isEmulator() && (saved.contains("127.0.0.1") || saved.contains("localhost") || saved.contains("10.0.2.2")))
            ) {
                return getDefaultBackendUrl()
            }
            return if (saved.endsWith("/")) saved else "$saved/"
        }
        set(value) {
            val trimmed = value.trim()
            val formatted = if (trimmed.endsWith("/")) trimmed else "$trimmed/"
            prefs.edit().putString(KEY_BACKEND_URL, formatted).apply()
        }

    fun resetBackendUrlToDefault() {
        prefs.edit().remove(KEY_BACKEND_URL).apply()
    }

    val isLoggedIn: Boolean
        get() = !accessToken.isNullOrBlank()

    val activeUserId: String
        get() = if (isLoggedIn && !userId.isNullOrBlank()) userId!! else GUEST_USER_ID

    fun clearAuth() {
        inMemoryAccessToken = null
        try {
            prefs.edit()
                .remove(KEY_ACCESS_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_USER_ID)
                .remove(KEY_USER_EMAIL)
                .remove(KEY_USER_NAME)
                .remove(KEY_USER_AVATAR)
                .commit()
        } catch (e: Exception) {
            prefs.edit()
                .remove(KEY_ACCESS_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_USER_ID)
                .remove(KEY_USER_EMAIL)
                .remove(KEY_USER_NAME)
                .remove(KEY_USER_AVATAR)
                .apply()
        }
    }

    // ── Episode Playback Progress (Prevents cross-episode overwrites) ───────

    fun saveEpisodeProgress(userId: String, movieSlug: String, episodeSlug: String, currentTime: Long, duration: Long) {
        if (movieSlug.isBlank() || episodeSlug.isBlank()) return
        val keyPos = "ep_pos_${userId}_${movieSlug}_${episodeSlug}"
        val keyDur = "ep_dur_${userId}_${movieSlug}_${episodeSlug}"
        prefs.edit()
            .putLong(keyPos, currentTime)
            .putLong(keyDur, duration)
            .apply()
    }

    fun getEpisodeProgress(userId: String, movieSlug: String, episodeSlug: String): Long {
        if (movieSlug.isBlank() || episodeSlug.isBlank()) return 0L
        val keyPos = "ep_pos_${userId}_${movieSlug}_${episodeSlug}"
        return prefs.getLong(keyPos, 0L)
    }

    fun getEpisodeDuration(userId: String, movieSlug: String, episodeSlug: String): Long {
        if (movieSlug.isBlank() || episodeSlug.isBlank()) return 0L
        val keyDur = "ep_dur_${userId}_${movieSlug}_${episodeSlug}"
        return prefs.getLong(keyDur, 0L)
    }

    fun migrateEpisodeProgress(fromUserId: String, toUserId: String) {
        if (fromUserId == toUserId) return
        val prefixPos = "ep_pos_${fromUserId}_"
        val prefixDur = "ep_dur_${fromUserId}_"
        val editor = prefs.edit()
        val all = prefs.all
        for ((k, v) in all) {
            if (k.startsWith(prefixPos) && v is Long) {
                val suffix = k.removePrefix(prefixPos)
                editor.putLong("ep_pos_${toUserId}_$suffix", v)
            } else if (k.startsWith(prefixDur) && v is Long) {
                val suffix = k.removePrefix(prefixDur)
                editor.putLong("ep_dur_${toUserId}_$suffix", v)
            }
        }
        editor.apply()
    }

    fun removeEpisodeProgressForMovie(userId: String, movieSlug: String) {
        val prefixPos = "ep_pos_${userId}_${movieSlug}_"
        val prefixDur = "ep_dur_${userId}_${movieSlug}_"
        val editor = prefs.edit()
        for (k in prefs.all.keys) {
            if (k.startsWith(prefixPos) || k.startsWith(prefixDur)) {
                editor.remove(k)
            }
        }
        editor.apply()
    }

    fun clearEpisodeProgress(userId: String) {
        val prefixPos = "ep_pos_${userId}_"
        val prefixDur = "ep_dur_${userId}_"
        val editor = prefs.edit()
        for (k in prefs.all.keys) {
            if (k.startsWith(prefixPos) || k.startsWith(prefixDur)) {
                editor.remove(k)
            }
        }
        editor.apply()
    }

    fun getDeletedFavoriteSlugs(userId: String): Set<String> {
        return prefs.getStringSet("deleted_favs_$userId", emptySet()) ?: emptySet()
    }

    fun addDeletedFavoriteSlug(userId: String, slug: String) {
        val current = getDeletedFavoriteSlugs(userId).toMutableSet()
        current.add(slug)
        prefs.edit().putStringSet("deleted_favs_$userId", current).apply()
    }

    fun removeDeletedFavoriteSlug(userId: String, slug: String) {
        val current = getDeletedFavoriteSlugs(userId).toMutableSet()
        if (current.remove(slug)) {
            prefs.edit().putStringSet("deleted_favs_$userId", current).apply()
        }
    }

    fun clearDeletedFavoriteSlugs(userId: String) {
        prefs.edit().remove("deleted_favs_$userId").apply()
    }

    fun getPendingAddFavoriteSlugs(userId: String): Set<String> {
        return prefs.getStringSet("pending_add_favs_$userId", emptySet()) ?: emptySet()
    }

    fun addPendingAddFavoriteSlug(userId: String, slug: String) {
        val current = getPendingAddFavoriteSlugs(userId).toMutableSet()
        current.add(slug)
        prefs.edit().putStringSet("pending_add_favs_$userId", current).apply()
    }

    fun removePendingAddFavoriteSlug(userId: String, slug: String) {
        val current = getPendingAddFavoriteSlugs(userId).toMutableSet()
        if (current.remove(slug)) {
            prefs.edit().putStringSet("pending_add_favs_$userId", current).apply()
        }
    }

    fun clearPendingAddFavoriteSlugs(userId: String) {
        prefs.edit().remove("pending_add_favs_$userId").apply()
    }


    companion object {
        const val GUEST_USER_ID = "guest"
        private const val PREFS_FILENAME = "cinepvq_secure_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_AVATAR = "user_avatar"
        private const val KEY_BACKEND_URL = "backend_base_url"

        fun sanitizeToken(raw: String?): String? {
            if (raw.isNullOrBlank()) return null
            var t = raw.trim()
            while (t.startsWith("\"") && t.endsWith("\"") && t.length >= 2) {
                t = t.substring(1, t.length - 1).trim()
            }
            if (t.equals("Bearer", ignoreCase = true)) {
                return null
            }
            if (t.startsWith("Bearer ", ignoreCase = true)) {
                t = t.substring(7).trim()
            }
            while (t.startsWith("\"") && t.endsWith("\"") && t.length >= 2) {
                t = t.substring(1, t.length - 1).trim()
            }
            return t.ifBlank { null }
        }
    }
}
