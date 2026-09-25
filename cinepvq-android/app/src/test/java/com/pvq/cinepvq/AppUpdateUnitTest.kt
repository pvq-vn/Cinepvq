package com.pvq.cinepvq

import com.pvq.cinepvq.core.network.CinepvqApiService
import com.pvq.cinepvq.core.network.model.AppVersionDto
import com.pvq.cinepvq.core.update.CinepvqUpdateManager
import com.pvq.cinepvq.core.update.UpdateUiState
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import retrofit2.Response
import java.io.File
import java.security.MessageDigest

class AppUpdateUnitTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var mockApiService: FakeCinepvqApiService
    private lateinit var updateManager: CinepvqUpdateManager
    private lateinit var testCacheDir: File

    class FakeCinepvqApiService : CinepvqApiService {
        var nextResponse: Response<AppVersionDto>? = null
        var shouldThrowException: Boolean = false

        override suspend fun getAppVersion(): Response<AppVersionDto> {
            if (shouldThrowException) {
                throw java.io.IOException("Fake network connection timeout")
            }
            return nextResponse ?: Response.success(AppVersionDto(versionCode = 1, versionName = "1.0.0"))
        }

        // Stub out other endpoints
        override suspend fun resolveVideoSources(slug: String?, episode: Int, season: Int, type: String, serverName: String?, episodeSlug: String?, nguoncEmbedUrl: String?) = Response.error<com.pvq.cinepvq.core.network.model.VideoSourcesResponse>(501, "".toResponseBody())
        override suspend fun syncUser() = Response.error<com.pvq.cinepvq.core.network.model.UserSyncResponse>(501, "".toResponseBody())
        override suspend fun getProfile() = Response.error<com.pvq.cinepvq.core.network.model.UserSyncResponse>(501, "".toResponseBody())
        override suspend fun updateProfile(request: com.pvq.cinepvq.core.network.model.ProfileUpdateRequest) = Response.error<com.pvq.cinepvq.core.network.model.UserSyncResponse>(501, "".toResponseBody())
        override suspend fun getFavorites() = Response.error<com.pvq.cinepvq.core.network.model.FavoritesResponse>(501, "".toResponseBody())
        override suspend fun updateFavorites(request: com.pvq.cinepvq.core.network.model.FavoriteActionRequest) = Response.error<com.pvq.cinepvq.core.network.model.FavoritesResponse>(501, "".toResponseBody())
        override suspend fun getHistory() = Response.error<com.pvq.cinepvq.core.network.model.HistoryResponse>(501, "".toResponseBody())
        override suspend fun updateHistory(request: com.pvq.cinepvq.core.network.model.HistoryActionRequest) = Response.error<com.pvq.cinepvq.core.network.model.HistoryResponse>(501, "".toResponseBody())
        override suspend fun getSettings() = Response.error<com.pvq.cinepvq.core.network.model.SettingsResponse>(501, "".toResponseBody())
        override suspend fun updateSettings(settings: com.pvq.cinepvq.core.network.model.UserSettingsDto) = Response.error<com.pvq.cinepvq.core.network.model.SettingsResponse>(501, "".toResponseBody())
        override suspend fun getWatchlist() = Response.error<com.pvq.cinepvq.core.network.model.WatchlistResponse>(501, "".toResponseBody())
        override suspend fun updateWatchlist(request: com.pvq.cinepvq.core.network.model.WatchlistActionRequest) = Response.error<com.pvq.cinepvq.core.network.model.WatchlistResponse>(501, "".toResponseBody())
        override suspend fun deleteWatchlist(slug: String?, clear: Boolean?) = Response.error<com.pvq.cinepvq.core.network.model.WatchlistResponse>(501, "".toResponseBody())
        override suspend fun getComments(slug: String) = Response.error<com.pvq.cinepvq.core.network.model.CommentsResponse>(501, "".toResponseBody())
        override suspend fun postComment(request: com.pvq.cinepvq.core.network.model.PostCommentRequest) = Response.error<com.pvq.cinepvq.core.network.model.CommentsResponse>(501, "".toResponseBody())
    }

    @Before
    fun setup() {
        testCacheDir = tempFolder.newFolder("cache")
        mockApiService = FakeCinepvqApiService()

        // Create a mock Android context or test wrapper
        val mockContext = object : android.content.ContextWrapper(null) {
            override fun getCacheDir(): File = testCacheDir
            override fun getPackageName(): String = "com.pvq.cinepvq"
        }

        updateManager = CinepvqUpdateManager(
            context = mockContext,
            apiService = mockApiService,
            okHttpClient = OkHttpClient()
        )
    }

    @Test
    fun testCheckForUpdate_noUpdateWhenVersionMatches() = runBlocking {
        // Current version is BuildConfig.VERSION_CODE (1)
        mockApiService.nextResponse = Response.success(
            AppVersionDto(
                versionCode = updateManager.currentVersionCode,
                versionName = updateManager.currentVersionName,
                downloadUrl = "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk"
            )
        )

        val hasUpdate = updateManager.checkForUpdate(manualTrigger = false)
        assertFalse("Should report no update when version matches", hasUpdate)
        assertTrue("UI state should remain Idle", updateManager.uiState.value is UpdateUiState.Idle)
    }

    @Test
    fun testCheckForUpdate_updateAvailableWhenRemoteIsHigher() = runBlocking {
        val newVersionCode = updateManager.currentVersionCode + 1
        val changelog = listOf("Sửa lỗi player", "Cải thiện PiP")
        mockApiService.nextResponse = Response.success(
            AppVersionDto(
                versionCode = newVersionCode,
                versionName = "1.1.0",
                downloadUrl = "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk",
                changelog = changelog,
                forceUpdate = false
            )
        )

        val hasUpdate = updateManager.checkForUpdate(manualTrigger = false)
        assertTrue("Should report update available", hasUpdate)

        val state = updateManager.uiState.value
        assertTrue("State should be UpdateAvailable", state is UpdateUiState.UpdateAvailable)
        val availableState = state as UpdateUiState.UpdateAvailable
        assertEquals(newVersionCode, availableState.versionInfo.versionCode)
        assertEquals("1.1.0", availableState.versionInfo.versionName)
        assertEquals(changelog, availableState.versionInfo.changelog)
        assertFalse(availableState.isForced)
    }

    @Test
    fun testCheckForUpdate_forceUpdateFlagRespected() = runBlocking {
        mockApiService.nextResponse = Response.success(
            AppVersionDto(
                versionCode = updateManager.currentVersionCode + 2,
                versionName = "2.0.0",
                downloadUrl = "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk",
                forceUpdate = true
            )
        )

        val hasUpdate = updateManager.checkForUpdate(manualTrigger = true)
        assertTrue(hasUpdate)

        val state = updateManager.uiState.value as UpdateUiState.UpdateAvailable
        assertTrue("Update must be marked as forced", state.isForced)
    }

    @Test
    fun testDismissOptionalUpdate_resetsToIdleAndMutesBackgroundChecks() = runBlocking {
        val newVersionCode = updateManager.currentVersionCode + 1
        mockApiService.nextResponse = Response.success(
            AppVersionDto(
                versionCode = newVersionCode,
                versionName = "1.1.0",
                downloadUrl = "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk",
                forceUpdate = false
            )
        )

        updateManager.checkForUpdate(manualTrigger = false)
        assertTrue(updateManager.uiState.value is UpdateUiState.UpdateAvailable)

        // User clicks "Để sau"
        updateManager.dismissOptionalUpdate()
        assertTrue("State should return to Idle after dismissal", updateManager.uiState.value is UpdateUiState.Idle)

        // Subsequent background check should not reopen dialog for same version
        updateManager.checkForUpdate(manualTrigger = false)
        assertTrue("Background check must remain Idle after user dismissal", updateManager.uiState.value is UpdateUiState.Idle)

        // But manual check from Settings should still show it!
        updateManager.checkForUpdate(manualTrigger = true)
        assertTrue("Manual check should always surface update", updateManager.uiState.value is UpdateUiState.UpdateAvailable)
    }

    @Test
    fun testTrustedUrlValidation_acceptsOfficialDomainsAndRejectsInsecure() {
        assertTrue(updateManager.isDownloadUrlTrusted("https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk"))
        assertTrue(updateManager.isDownloadUrlTrusted("https://github-releases.githubusercontent.com/12345/Cinepvq.apk"))
        assertTrue(updateManager.isDownloadUrlTrusted("https://cinepvq.vercel.app/downloads/Cinepvq.apk"))

        // Untrusted / Insecure
        assertFalse(updateManager.isDownloadUrlTrusted("http://github.com/pvq-vn/Cinepvq/releases/download/Cinepvq.apk")) // Non-HTTPS
        assertFalse(updateManager.isDownloadUrlTrusted("https://malicious-site.com/Cinepvq.apk"))
        assertFalse(updateManager.isDownloadUrlTrusted("javascript:alert(1)"))
        assertFalse(updateManager.isDownloadUrlTrusted(""))
    }

    @Test
    fun testSha256Verification_computesAccurateHash() {
        val sampleFile = File(testCacheDir, "sample.bin")
        sampleFile.writeBytes("Cinepvq Android Native Test Payload".toByteArray(Charsets.UTF_8))

        // Compute expected SHA-256
        val digest = MessageDigest.getInstance("SHA-256")
        val expectedHash = digest.digest("Cinepvq Android Native Test Payload".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

        val computedHash = updateManager.computeFileSha256(sampleFile)
        assertEquals("Calculated SHA-256 must match byte-for-byte", expectedHash, computedHash)
    }

    @Test
    fun testNetworkFailure_handledGracefullyWithoutCrashing() = runBlocking {
        mockApiService.shouldThrowException = true

        // Background check: should not throw, should set Idle
        val hasUpdate = updateManager.checkForUpdate(manualTrigger = false)
        assertFalse(hasUpdate)
        assertEquals(UpdateUiState.Idle, updateManager.uiState.value)

        // Manual check: should set Error with retry
        val manualHasUpdate = updateManager.checkForUpdate(manualTrigger = true)
        assertFalse(manualHasUpdate)
        val state = updateManager.uiState.value
        assertTrue(state is UpdateUiState.Error)
        val errorState = state as UpdateUiState.Error
        assertTrue(errorState.canRetry)
    }

    @Test
    fun testTrustedUrlValidation_redirectHopToObjectsGithubusercontent() {
        assertTrue(updateManager.isDownloadUrlTrusted("https://objects.githubusercontent.com/github-production-release-asset-2e65be/12345/Cinepvq.apk"))
        assertTrue(updateManager.isDownloadUrlTrusted("https://raw.githubusercontent.com/pvq-vn/Cinepvq/main/app.json"))
        assertFalse(updateManager.isDownloadUrlTrusted("https://evil.githubusercontent.com.attacker.com/Cinepvq.apk"))
    }

    @Test
    fun testStartDownload_rejectsMissingOrMalformedSha256Upfront() = runBlocking {
        val invalidHashDto = AppVersionDto(
            versionCode = 2,
            versionName = "1.1.0",
            downloadUrl = "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk",
            sha256 = "not_a_valid_hash"
        )

        updateManager.startDownload(invalidHashDto)

        val state = updateManager.uiState.value
        assertTrue("Must transition to Error state", state is UpdateUiState.Error)
        val errorState = state as UpdateUiState.Error
        assertFalse("Cannot retry with malformed server manifest hash", errorState.canRetry)
        assertEquals("Bản cập nhật thiếu mã xác thực SHA-256 hợp lệ từ máy chủ.", errorState.message)
    }

    @Test
    fun testStartDownload_rejectsUntrustedUrlUpfront() = runBlocking {
        val untrustedUrlDto = AppVersionDto(
            versionCode = 2,
            versionName = "1.1.0",
            downloadUrl = "http://malicious.com/app.apk",
            sha256 = "a".repeat(64)
        )

        updateManager.startDownload(untrustedUrlDto)

        val state = updateManager.uiState.value
        assertTrue("Must transition to Error state", state is UpdateUiState.Error)
        val errorState = state as UpdateUiState.Error
        assertFalse(errorState.canRetry)
        assertEquals("Đường dẫn tải về không an toàn hoặc không được hỗ trợ.", errorState.message)
    }

    @Test
    fun testCachedApk_reusedWhenValidSha256Matches() = runBlocking {
        val updatesDir = File(testCacheDir, "updates").apply { mkdirs() }
        val targetFile = File(updatesDir, "Cinepvq-2.apk")
        val sampleBytes = "Valid Pre-downloaded APK Content".toByteArray(Charsets.UTF_8)
        targetFile.writeBytes(sampleBytes)

        val digest = MessageDigest.getInstance("SHA-256")
        val expectedHash = digest.digest(sampleBytes).joinToString("") { "%02x".format(it) }

        val validDto = AppVersionDto(
            versionCode = 2,
            versionName = "1.1.0",
            downloadUrl = "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk",
            sha256 = expectedHash
        )

        updateManager.startDownload(validDto)

        val state = updateManager.uiState.value
        assertTrue("Must recognize valid cached APK and transition to ReadyToInstall", state is UpdateUiState.ReadyToInstall)
        val readyState = state as UpdateUiState.ReadyToInstall
        assertEquals(targetFile.absolutePath, readyState.apkFile.absolutePath)
    }
}
