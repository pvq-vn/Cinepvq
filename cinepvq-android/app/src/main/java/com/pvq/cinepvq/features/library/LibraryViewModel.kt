package com.pvq.cinepvq.features.library

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.FavoriteMovie
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import com.pvq.cinepvq.domain.model.WatchLaterItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class LibraryTab(val title: String) {
    FAVORITES("Yêu thích"),
    HISTORY("Lịch sử"),
    WATCH_LATER("Xem sau")
}

class LibraryViewModel(
    private val savedStateHandle: SavedStateHandle? = null,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    companion object {
        private const val KEY_SELECTED_TAB = "selected_library_tab"
    }

    private val _selectedTab = MutableStateFlow(
        savedStateHandle?.get<String>(KEY_SELECTED_TAB)?.let { name ->
            try { LibraryTab.valueOf(name) } catch (_: Exception) { LibraryTab.FAVORITES }
        } ?: LibraryTab.FAVORITES
    )
    val selectedTab: StateFlow<LibraryTab> = _selectedTab.asStateFlow()

    val favorites: StateFlow<List<FavoriteMovie>> = userSyncRepository.getAllFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val history: StateFlow<List<WatchHistoryItem>> = userSyncRepository.getAllHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val watchLater: StateFlow<List<WatchLaterItem>> = userSyncRepository.getAllWatchLater()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Viewport Pagination: Windowed loading by batches of 20 items
    private val _favDisplayLimit = MutableStateFlow(20)
    private val _histDisplayLimit = MutableStateFlow(20)
    private val _watchDisplayLimit = MutableStateFlow(20)

    val displayedFavorites: StateFlow<List<FavoriteMovie>> = kotlinx.coroutines.flow.combine(
        favorites, _favDisplayLimit
    ) { list, limit -> list.take(limit) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val hasMoreFavorites: StateFlow<Boolean> = kotlinx.coroutines.flow.combine(
        favorites, _favDisplayLimit
    ) { list, limit -> list.size > limit }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val displayedHistory: StateFlow<List<WatchHistoryItem>> = kotlinx.coroutines.flow.combine(
        history, _histDisplayLimit
    ) { list, limit -> list.take(limit) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val hasMoreHistory: StateFlow<Boolean> = kotlinx.coroutines.flow.combine(
        history, _histDisplayLimit
    ) { list, limit -> list.size > limit }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val displayedWatchLater: StateFlow<List<WatchLaterItem>> = kotlinx.coroutines.flow.combine(
        watchLater, _watchDisplayLimit
    ) { list, limit -> list.take(limit) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val hasMoreWatchLater: StateFlow<Boolean> = kotlinx.coroutines.flow.combine(
        watchLater, _watchDisplayLimit
    ) { list, limit -> list.size > limit }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun loadMoreFavorites() {
        if (_favDisplayLimit.value < favorites.value.size) {
            _favDisplayLimit.value += 20
        }
    }

    fun loadMoreHistory() {
        if (_histDisplayLimit.value < history.value.size) {
            _histDisplayLimit.value += 20
        }
    }

    fun loadMoreWatchLater() {
        if (_watchDisplayLimit.value < watchLater.value.size) {
            _watchDisplayLimit.value += 20
        }
    }

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    fun selectTab(tab: LibraryTab) {
        _selectedTab.value = tab
        savedStateHandle?.set(KEY_SELECTED_TAB, tab.name)
    }

    fun removeFavorite(slug: String) {
        viewModelScope.launch {
            userSyncRepository.removeFavorite(slug)
        }
    }

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

    fun clearFavorites() {
        viewModelScope.launch {
            userSyncRepository.clearFavorites()
        }
    }

    fun removeWatchLater(slug: String) {
        viewModelScope.launch {
            userSyncRepository.removeWatchLater(slug)
        }
    }

    fun clearWatchLater() {
        viewModelScope.launch {
            userSyncRepository.clearWatchLater()
        }
    }

    fun refresh() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                userSyncRepository.syncWithServer()
            } catch (_: Exception) {}
            _isRefreshing.value = false
        }
    }
}
