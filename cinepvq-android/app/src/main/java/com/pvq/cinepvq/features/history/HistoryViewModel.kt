package com.pvq.cinepvq.features.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class HistoryViewModel(
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    val history: StateFlow<List<WatchHistoryItem>> = userSyncRepository.getAllHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun removeHistory(slug: String) {
        viewModelScope.launch {
            userSyncRepository.removeHistory(slug)
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            userSyncRepository.clearHistory()
        }
    }

    fun sync() {
        viewModelScope.launch {
            userSyncRepository.syncWithServer()
        }
    }
}
