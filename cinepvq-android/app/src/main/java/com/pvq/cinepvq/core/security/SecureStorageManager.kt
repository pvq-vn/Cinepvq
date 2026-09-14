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

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()

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
        return if (BuildConfig.DEBUG) {
            if (isEmulator()) {
                BuildConfig.DEFAULT_EMULATOR_URL
            } else {
                BuildConfig.DEFAULT_DEV_LAN_URL
            }
        } else {
            BuildConfig.DEFAULT_PROD_URL
        }
    }

    var backendBaseUrl: String
        get() {
            val saved = prefs.getString(KEY_BACKEND_URL, null)
            // Auto-heal legacy broken 127.0.0.1 on real devices
            if (saved.isNullOrBlank() || (!isEmulator() && saved.contains("127.0.0.1"))) {
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
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_AVATAR)
            .apply()
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
    }
}
