package com.pvq.cinepvq.core.network

import com.pvq.cinepvq.core.network.model.SupabaseAuthResponse
import com.pvq.cinepvq.core.network.model.SupabaseSignInRequest
import com.pvq.cinepvq.core.network.model.SupabaseSignUpRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Query

interface SupabaseAuthApiService {

    @POST("auth/v1/token")
    suspend fun signIn(
        @Query("grant_type") grantType: String = "password",
        @Body request: SupabaseSignInRequest
    ): Response<SupabaseAuthResponse>

    @POST("auth/v1/signup")
    suspend fun signUp(
        @Body request: SupabaseSignUpRequest
    ): Response<SupabaseAuthResponse>

    @POST("auth/v1/token")
    suspend fun refreshToken(
        @Query("grant_type") grantType: String = "refresh_token",
        @Body request: com.pvq.cinepvq.core.network.model.SupabaseRefreshTokenRequest
    ): Response<SupabaseAuthResponse>

    @POST("auth/v1/logout")
    suspend fun logout(): Response<Unit>
}
