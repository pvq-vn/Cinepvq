package com.pvq.cinepvq.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.core.security.SecureStorageManager
import com.pvq.cinepvq.data.auth.AuthRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.User
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class ProfileViewModel(
    private val authRepository: AuthRepository = CinepvqApp.instance.authRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository,
    private val secureStorageManager: SecureStorageManager = CinepvqApp.instance.secureStorageManager
) : ViewModel() {

    val currentUser: StateFlow<User?> = authRepository.currentUser
    val isLoggedIn: StateFlow<Boolean> = authRepository.isLoggedIn

    val favoritesCount: StateFlow<Int> = userSyncRepository.getAllFavorites()
        .map { it.size }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val historyCount: StateFlow<Int> = userSyncRepository.getAllHistory()
        .map { it.size }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage: StateFlow<String?> = _syncMessage.asStateFlow()

    private val _backendUrl = MutableStateFlow(secureStorageManager.backendBaseUrl)
    val backendUrl: StateFlow<String> = _backendUrl.asStateFlow()

    fun syncNow() {
        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = null
            try {
                userSyncRepository.syncWithServer()
                _syncMessage.value = "Đồng bộ thành công với tài khoản Cinepvq Web!"
            } catch (e: Exception) {
                _syncMessage.value = "Đồng bộ thất bại: ${e.message}"
            }
            _isSyncing.value = false
        }
    }

    fun updateUsername(newUsername: String, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val res = authRepository.updateProfile(username = newUsername.trim(), avatarUrl = null)
                if (res.isSuccess) {
                    onComplete(true, "Cập nhật tên thành công!")
                } else {
                    onComplete(false, res.exceptionOrNull()?.message ?: "Lỗi cập nhật tên")
                }
            } catch (e: Exception) {
                onComplete(false, e.message)
            }
        }
    }

    fun updateBackendUrl(newUrl: String) {
        var cleanUrl = newUrl.trim()
        if (!cleanUrl.endsWith("/")) cleanUrl += "/"
        secureStorageManager.backendBaseUrl = cleanUrl
        _backendUrl.value = cleanUrl
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }
}
