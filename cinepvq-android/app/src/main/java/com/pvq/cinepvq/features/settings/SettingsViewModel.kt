package com.pvq.cinepvq.features.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.settings.PlayerSettings
import com.pvq.cinepvq.data.settings.SettingsRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val settingsRepository: SettingsRepository = CinepvqApp.instance.settingsRepository
) : ViewModel() {

    val playerSettings: StateFlow<PlayerSettings> = settingsRepository.playerSettings
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = PlayerSettings()
        )

    fun setPlaybackSpeed(speed: Float) {
        viewModelScope.launch {
            settingsRepository.updatePlaybackSpeed(speed)
        }
    }

    fun setSource(source: String) {
        viewModelScope.launch {
            settingsRepository.updateSource(source)
        }
    }

    fun setResolution(resolution: String) {
        viewModelScope.launch {
            settingsRepository.updateResolution(resolution)
        }
    }

    fun setSeekDuration(seconds: Int) {
        viewModelScope.launch {
            settingsRepository.updateSeekDuration(seconds)
        }
    }
}
