package com.pvq.cinepvq.data.auth

import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.core.network.model.ProfileUpdateRequest
import com.pvq.cinepvq.core.network.model.SupabaseSignInRequest
import com.pvq.cinepvq.core.network.model.SupabaseSignUpRequest
import com.pvq.cinepvq.core.security.SecureStorageManager
import com.pvq.cinepvq.domain.model.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

class AuthRepository(
    private val networkModule: NetworkModule,
    private val secureStorageManager: SecureStorageManager
) {
    private val _currentUser = MutableStateFlow<User?>(loadCachedUser())
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _isLoggedIn = MutableStateFlow(secureStorageManager.isLoggedIn)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private fun loadCachedUser(): User? {
        val uid = secureStorageManager.userId ?: return null
        val email = secureStorageManager.userEmail ?: return null
        val username = secureStorageManager.userName ?: email.substringBefore("@")
        return User(
            id = uid,
            email = email,
            username = username,
            avatarUrl = secureStorageManager.userAvatar
        )
    }

    suspend fun signIn(email: String, password: String): Result<User> = runCatching {
        val res = networkModule.supabaseAuthApi.signIn(
            request = SupabaseSignInRequest(email = email.trim(), password = password.trim())
        )
        if (!res.isSuccessful || res.body() == null) {
            val err = res.errorBody()?.string() ?: "Đăng nhập thất bại"
            throw Exception(parseErrorMessage(err, res.body()?.errorDescription))
        }

        val auth = res.body()!!
        val token = auth.accessToken ?: throw Exception("Không nhận được token xác thực")
        val userDto = auth.user ?: throw Exception("Không có thông tin người dùng")

        val rawUsername = userDto.userMetadata["username"]?.jsonPrimitive?.contentOrNull
            ?: userDto.userMetadata["full_name"]?.jsonPrimitive?.contentOrNull
            ?: email.substringBefore("@")

        val avatar = userDto.userMetadata["avatar_url"]?.jsonPrimitive?.contentOrNull

        secureStorageManager.accessToken = token
        secureStorageManager.refreshToken = auth.refreshToken
        secureStorageManager.userId = userDto.id
        secureStorageManager.userEmail = userDto.email ?: email
        secureStorageManager.userName = rawUsername
        secureStorageManager.userAvatar = avatar

        val user = User(
            id = userDto.id,
            email = userDto.email ?: email,
            username = rawUsername,
            avatarUrl = avatar,
            createdAt = userDto.createdAt
        )

        _currentUser.value = user
        _isLoggedIn.value = true

        // Asynchronously sync identity with Cinepvq backend
        try {
            networkModule.cinepvqApi.syncUser()
        } catch (_: Exception) {}

        user
    }

    suspend fun signUp(email: String, password: String, username: String): Result<User> = runCatching {
        val trimmedEmail = email.trim()
        val trimmedUsername = username.trim().ifBlank { trimmedEmail.substringBefore("@") }

        val res = networkModule.supabaseAuthApi.signUp(
            request = SupabaseSignUpRequest(
                email = trimmedEmail,
                password = password.trim(),
                data = mapOf("username" to trimmedUsername)
            )
        )

        if (!res.isSuccessful || res.body() == null) {
            val err = res.errorBody()?.string() ?: "Đăng ký thất bại"
            throw Exception(parseErrorMessage(err, res.body()?.errorDescription))
        }

        val auth = res.body()!!
        val userDto = auth.user ?: throw Exception("Không có thông tin người dùng")

        if (!auth.accessToken.isNullOrBlank()) {
            secureStorageManager.accessToken = auth.accessToken
            secureStorageManager.refreshToken = auth.refreshToken
            secureStorageManager.userId = userDto.id
            secureStorageManager.userEmail = userDto.email ?: trimmedEmail
            secureStorageManager.userName = trimmedUsername

            val user = User(
                id = userDto.id,
                email = userDto.email ?: trimmedEmail,
                username = trimmedUsername,
                createdAt = userDto.createdAt
            )
            _currentUser.value = user
            _isLoggedIn.value = true

            try {
                networkModule.cinepvqApi.syncUser()
            } catch (_: Exception) {}

            user
        } else {
            // Email confirmation required or auto-sign-in fallback
            User(
                id = userDto.id,
                email = userDto.email ?: trimmedEmail,
                username = trimmedUsername,
                createdAt = userDto.createdAt
            )
        }
    }

    suspend fun logout() {
        try {
            networkModule.supabaseAuthApi.logout()
        } catch (_: Exception) {}

        secureStorageManager.clearAuth()
        _currentUser.value = null
        _isLoggedIn.value = false
    }

    suspend fun updateProfile(username: String?, avatarUrl: String?): Result<User> = runCatching {
        val res = networkModule.cinepvqApi.updateProfile(
            ProfileUpdateRequest(username = username, avatarUrl = avatarUrl)
        )
        if (res.isSuccessful && res.body()?.user != null) {
            val u = res.body()!!.user!!
            secureStorageManager.userName = u.username
            secureStorageManager.userAvatar = u.avatarUrl
            val updated = User(
                id = u.id,
                email = u.email,
                username = u.username,
                avatarUrl = u.avatarUrl,
                createdAt = u.createdAt
            )
            _currentUser.value = updated
            updated
        } else {
            val current = _currentUser.value ?: throw Exception("Chưa đăng nhập")
            val updated = current.copy(
                username = username ?: current.username,
                avatarUrl = avatarUrl ?: current.avatarUrl
            )
            secureStorageManager.userName = updated.username
            secureStorageManager.userAvatar = updated.avatarUrl
            _currentUser.value = updated
            updated
        }
    }

    private fun parseErrorMessage(rawError: String, description: String?): String {
        if (!description.isNullOrBlank()) return description
        return when {
            rawError.contains("Invalid login credentials", ignoreCase = true) -> "Sai tài khoản hoặc mật khẩu"
            rawError.contains("User already registered", ignoreCase = true) -> "Email này đã được đăng ký"
            rawError.contains("Password should be at least", ignoreCase = true) -> "Mật khẩu phải có ít nhất 6 ký tự"
            else -> "Đã xảy ra lỗi, vui lòng thử lại"
        }
    }
}
