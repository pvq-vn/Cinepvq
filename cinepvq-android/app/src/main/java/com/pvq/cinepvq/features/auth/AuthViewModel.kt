package com.pvq.cinepvq.features.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.auth.AuthRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val authRepository: AuthRepository = CinepvqApp.instance.authRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    val isSignUpTab = MutableStateFlow(false)
    val email = MutableStateFlow("")
    val password = MutableStateFlow("")
    val username = MutableStateFlow("")

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage = _errorMessage.asStateFlow()

    fun submitAuth(onSuccess: () -> Unit) {
        val em = email.value.trim()
        val pw = password.value.trim()

        if (em.isBlank() || !em.contains("@")) {
            _errorMessage.value = "Vui lòng nhập địa chỉ email hợp lệ"
            return
        }

        if (pw.length < 6) {
            _errorMessage.value = "Mật khẩu phải có ít nhất 6 ký tự"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val res = if (isSignUpTab.value) {
                authRepository.signUp(em, pw, username.value.trim())
            } else {
                authRepository.signIn(em, pw)
            }

            if (res.isSuccess) {
                // Sync data with server immediately upon successful authentication
                userSyncRepository.syncWithServer()
                onSuccess()
            } else {
                _errorMessage.value = res.exceptionOrNull()?.message ?: "Xác thực thất bại"
            }

            _isLoading.value = false
        }
    }
}
