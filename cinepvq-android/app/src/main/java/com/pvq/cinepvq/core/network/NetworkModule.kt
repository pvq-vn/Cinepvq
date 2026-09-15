package com.pvq.cinepvq.core.network

import com.pvq.cinepvq.core.network.model.SupabaseAuthResponse
import com.pvq.cinepvq.core.network.model.SupabaseRefreshTokenRequest
import com.pvq.cinepvq.core.security.SecureStorageManager
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class NetworkModule(private val secureStorageManager: SecureStorageManager) {

    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        encodeDefaults = true
    }

    private val contentType = "application/json".toMediaType()

    // ── Supabase Config (Identical to cinepvq-web NEXT_PUBLIC_SUPABASE_*) ────
    val supabaseUrl = "https://icmqptgkvuokquhldlqg.supabase.co/"
    val supabaseAnonKey = "sb_publishable_ZzuHXuuQsTsROVHC-_cagw_N53HhMBX"

    // ── Cinepvq Base URL (Dynamically configured from preferences) ───────────
    var cinepvqBaseUrl: String
        get() = secureStorageManager.backendBaseUrl
        set(value) {
            secureStorageManager.backendBaseUrl = value
            _cinepvqApi = null
        }

    // ── KKPhim Base URL ──────────────────────────────────────────────────────
    val kkphimBaseUrl = "https://phimapi.com/"

    // ── OkHttpClient for Cinepvq Backend (Injects Bearer Token) ──────────────
    private val cinepvqAuthInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()

        val rawToken = secureStorageManager.accessToken
        val cleanToken = SecureStorageManager.sanitizeToken(rawToken)
        if (!cleanToken.isNullOrBlank()) {
            builder.header("Authorization", "Bearer $cleanToken")
            Log.d("NetworkModule", "AuthInterceptor: attached Bearer token (prefix=${cleanToken.take(8)}..., len=${cleanToken.length}) to ${original.method} ${original.url.encodedPath}")
        } else {
            Log.w("NetworkModule", "AuthInterceptor: NO token available for ${original.method} ${original.url.encodedPath}")
        }

        chain.proceed(builder.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val tokenAuthenticator = okhttp3.Authenticator { _, response ->
        // Avoid infinite loop if token is continuously rejected
        var retryCount = 0
        var prior = response.priorResponse
        while (prior != null) {
            retryCount++
            prior = prior.priorResponse
        }
        if (retryCount >= 2) return@Authenticator null

        val currentRefresh = secureStorageManager.refreshToken ?: return@Authenticator null

        try {
            val refreshPayload = json.encodeToString(SupabaseRefreshTokenRequest(refreshToken = currentRefresh))
            val refreshReq = okhttp3.Request.Builder()
                .url("${supabaseUrl}auth/v1/token?grant_type=refresh_token")
                .header("apikey", supabaseAnonKey)
                .header("Content-Type", "application/json")
                .post(refreshPayload.toRequestBody("application/json".toMediaType()))
                .build()

            val refreshRes = supabaseOkHttpClient.newCall(refreshReq).execute()
            if (refreshRes.isSuccessful) {
                val bodyStr = refreshRes.body?.string() ?: return@Authenticator null
                val authRes = json.decodeFromString<SupabaseAuthResponse>(bodyStr)
                val newAccess = SecureStorageManager.sanitizeToken(authRes.accessToken)
                if (!newAccess.isNullOrBlank()) {
                    secureStorageManager.accessToken = newAccess
                    if (!authRes.refreshToken.isNullOrBlank()) {
                        secureStorageManager.refreshToken = authRes.refreshToken
                    }
                    return@Authenticator response.request.newBuilder()
                        .header("Authorization", "Bearer $newAccess")
                        .build()
                }
            } else {
                secureStorageManager.clearAuth()
            }
        } catch (_: Exception) {}

        null
    }

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .writeTimeout(8, TimeUnit.SECONDS)
        .addInterceptor(cinepvqAuthInterceptor)
        .authenticator(tokenAuthenticator)
        .addInterceptor(loggingInterceptor)
        .build()

    // ── OkHttpClient for Supabase (Injects apikey header) ────────────────────
    private val supabaseInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()
            .header("apikey", supabaseAnonKey)
            .header("Content-Type", "application/json")

        val rawToken = secureStorageManager.accessToken
        val token = SecureStorageManager.sanitizeToken(rawToken)
        if (!token.isNullOrBlank()) {
            builder.header("Authorization", "Bearer $token")
        } else {
            builder.header("Authorization", "Bearer $supabaseAnonKey")
        }

        chain.proceed(builder.build())
    }

    private val supabaseOkHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .addInterceptor(supabaseInterceptor)
        .addInterceptor(loggingInterceptor)
        .build()

    // ── OkHttpClient for KKPhim (Public upstream CDN) ────────────────────────
    private val kkphimOkHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .addInterceptor(loggingInterceptor)
        .build()

    // ── Retrofit Services ───────────────────────────────────────────────────

    private var _cinepvqApi: CinepvqApiService? = null
    val cinepvqApi: CinepvqApiService
        get() {
            var api = _cinepvqApi
            if (api == null) {
                api = Retrofit.Builder()
                    .baseUrl(cinepvqBaseUrl)
                    .client(okHttpClient)
                    .addConverterFactory(json.asConverterFactory(contentType))
                    .build()
                    .create(CinepvqApiService::class.java)
                _cinepvqApi = api
            }
            return api
        }

    val kkphimApi: KKPhimApiService by lazy {
        Retrofit.Builder()
            .baseUrl(kkphimBaseUrl)
            .client(kkphimOkHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(KKPhimApiService::class.java)
    }

    val supabaseAuthApi: SupabaseAuthApiService by lazy {
        Retrofit.Builder()
            .baseUrl(supabaseUrl)
            .client(supabaseOkHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(SupabaseAuthApiService::class.java)
    }

    suspend fun testConnection(): Result<Long> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        try {
            val response = cinepvqApi.getProfile()
            val duration = System.currentTimeMillis() - startTime
            // 200 OK or 401 Unauthorized (401 proves the Next.js server is up and rejecting unauthenticated requests via Supabase Auth guard)
            if (response.isSuccessful || response.code() == 401) {
                Result.success(duration)
            } else {
                val msg = "HTTP ${response.code()}: ${response.message().ifBlank { "Lỗi phản hồi" }}"
                Log.w("CinepvqNetwork", "Connection test returned: $msg")
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Log.e("CinepvqNetwork", "Connection test failed to $cinepvqBaseUrl: ${e.message}", e)
            Result.failure(e)
        }
    }
}
