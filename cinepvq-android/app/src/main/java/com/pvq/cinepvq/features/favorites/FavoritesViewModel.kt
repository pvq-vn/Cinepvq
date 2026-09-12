package com.pvq.cinepvq.features.favorites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.FavoriteMovie
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class FavoritesViewModel(
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    val favorites: StateFlow<List<FavoriteMovie>> = userSyncRepository.getAllFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun removeFavorite(slug: String) {
        viewModelScope.launch {
            userSyncRepository.removeFavorite(slug)
        }
    }

    fun sync() {
        viewModelScope.launch {
            userSyncRepository.syncWithServer()
        }
    }
}
