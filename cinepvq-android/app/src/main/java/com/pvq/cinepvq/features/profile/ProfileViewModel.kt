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

    private val _syncIsError = MutableStateFlow(false)
    val syncIsError: StateFlow<Boolean> = _syncIsError.asStateFlow()

    private val _isTestingConnection = MutableStateFlow(false)
    val isTestingConnection: StateFlow<Boolean> = _isTestingConnection.asStateFlow()

    private val _testConnectionMessage = MutableStateFlow<String?>(null)
    val testConnectionMessage: StateFlow<String?> = _testConnectionMessage.asStateFlow()

    private val _testConnectionIsError = MutableStateFlow(false)
    val testConnectionIsError: StateFlow<Boolean> = _testConnectionIsError.asStateFlow()

    private val _backendUrl = MutableStateFlow(secureStorageManager.backendBaseUrl)
    val backendUrl: StateFlow<String> = _backendUrl.asStateFlow()

    fun syncNow() {
        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = null
            _syncIsError.value = false
            val result = userSyncRepository.syncWithServer()
            if (result.isSuccess) {
                val summary = result.getOrNull()
                _syncMessage.value = "Đồng bộ thành công! (${summary?.favoritesCount ?: 0} yêu thích, ${summary?.historyCount ?: 0} lịch sử, ${summary?.watchlistCount ?: 0} xem sau)"
                _syncIsError.value = false
            } else {
                val err = result.exceptionOrNull()?.message ?: "Lỗi kết nối tới server"
                _syncMessage.value = "Đồng bộ thất bại: $err"
                _syncIsError.value = true
            }
            _isSyncing.value = false
        }
    }

    fun testConnection() {
        viewModelScope.launch {
            _isTestingConnection.value = true
            _testConnectionMessage.value = null
            _testConnectionIsError.value = false

            val res = userSyncRepository.testConnection()
            if (res.isSuccess) {
                val latency = res.getOrDefault(0L)
                _testConnectionMessage.value = "Kết nối thành công! Độ trễ: ${latency}ms"
                _testConnectionIsError.value = false
            } else {
                val err = res.exceptionOrNull()?.message ?: "Không thể kết nối"
                _testConnectionMessage.value = "Kết nối thất bại: $err"
                _testConnectionIsError.value = true
            }
            _isTestingConnection.value = false
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
        CinepvqApp.instance.networkModule.cinepvqBaseUrl = cleanUrl
        _backendUrl.value = cleanUrl
    }

    fun resetToDefaultUrl() {
        secureStorageManager.resetBackendUrlToDefault()
        CinepvqApp.instance.networkModule.cinepvqBaseUrl = secureStorageManager.backendBaseUrl
        _backendUrl.value = secureStorageManager.backendBaseUrl
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }
}
