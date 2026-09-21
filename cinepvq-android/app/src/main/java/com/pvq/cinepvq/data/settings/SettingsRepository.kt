package com.pvq.cinepvq.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "cinepvq_settings")

data class PlayerSettings(
    val defaultPlaybackSpeed: Float = 1.0f,
    val defaultSource: String = "auto",
    val defaultResolution: String = "auto",
    val defaultSeekDuration: Int = 10
)

class SettingsRepository(private val context: Context) {

    private object PreferencesKeys {
        val KEY_PLAYBACK_SPEED = floatPreferencesKey("default_playback_speed")
        val KEY_SOURCE = stringPreferencesKey("default_source")
        val KEY_RESOLUTION = stringPreferencesKey("default_resolution")
        val KEY_SEEK_DURATION = intPreferencesKey("default_seek_duration")
    }

    val playerSettings: Flow<PlayerSettings> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            val speed = preferences[PreferencesKeys.KEY_PLAYBACK_SPEED] ?: 1.0f
            val source = preferences[PreferencesKeys.KEY_SOURCE] ?: "auto"
            val resolution = preferences[PreferencesKeys.KEY_RESOLUTION] ?: "auto"
            val seekDuration = preferences[PreferencesKeys.KEY_SEEK_DURATION] ?: 10
            PlayerSettings(
                defaultPlaybackSpeed = speed,
                defaultSource = source,
                defaultResolution = resolution,
                defaultSeekDuration = seekDuration
            )
        }

    suspend fun updatePlaybackSpeed(speed: Float) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.KEY_PLAYBACK_SPEED] = speed
        }
    }

    suspend fun updateSource(source: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.KEY_SOURCE] = source
        }
    }

    suspend fun updateResolution(resolution: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.KEY_RESOLUTION] = resolution
        }
    }

    suspend fun updateSeekDuration(duration: Int) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.KEY_SEEK_DURATION] = duration
        }
    }
}
