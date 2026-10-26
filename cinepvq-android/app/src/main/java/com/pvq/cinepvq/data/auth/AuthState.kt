package com.pvq.cinepvq.data.auth

import com.pvq.cinepvq.domain.model.User

sealed class AuthState {
    data object Unauthenticated : AuthState()
    data class Authenticated(val user: User) : AuthState()
}
