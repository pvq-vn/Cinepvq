package com.pvq.cinepvq.core.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import com.pvq.cinepvq.BuildConfig
import com.pvq.cinepvq.core.network.CinepvqApiService
import com.pvq.cinepvq.core.network.model.AppVersionDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.URI
import java.security.MessageDigest

sealed interface UpdateUiState {
    object Idle : UpdateUiState
    object Checking : UpdateUiState
    data class UpdateAvailable(
        val versionInfo: AppVersionDto,
        val isForced: Boolean
    ) : UpdateUiState
    data class Downloading(
        val versionInfo: AppVersionDto,
        val progress: Float,
        val bytesDownloaded: Long,
        val totalBytes: Long
    ) : UpdateUiState
    data class ReadyToInstall(
        val versionInfo: AppVersionDto,
        val apkFile: File
    ) : UpdateUiState
    data class Error(
        val message: String,
        val canRetry: Boolean,
        val versionInfo: AppVersionDto? = null
    ) : UpdateUiState
}

enum class InstallResult {
    Launched,
    PermissionRequested,
    FileNotFound,
    Error
}

class CinepvqUpdateManager(
    private val context: Context,
    private val apiService: CinepvqApiService,
    private val okHttpClient: OkHttpClient
) {
    companion object {
        private const val TAG = "CinepvqUpdateManager"
        private const val BUFFER_SIZE = 8192
    }

    val currentVersionCode: Int = BuildConfig.VERSION_CODE
    val currentVersionName: String = BuildConfig.VERSION_NAME

    private val _uiState = MutableStateFlow<UpdateUiState>(UpdateUiState.Idle)
    val uiState: StateFlow<UpdateUiState> = _uiState.asStateFlow()

    private var dismissedVersionCode: Int? = null

    private val downloadOkHttpClient: OkHttpClient = okHttpClient.newBuilder()
        .addNetworkInterceptor { chain ->
            val requestUrl = chain.request().url.toString()
            if (!isDownloadUrlTrusted(requestUrl)) {
                throw SecurityException("Redirect to untrusted host rejected: $requestUrl")
            }
            chain.proceed(chain.request())
        }
        .build()

    fun isDownloadUrlTrusted(url: String): Boolean {
        if (!url.startsWith("https://", ignoreCase = true)) return false
        return try {
            val uri = URI(url)
            val host = uri.host?.lowercase() ?: return false
            host == "github.com" ||
                host.endsWith(".github.com") ||
                host == "github-releases.githubusercontent.com" ||
                host == "objects.githubusercontent.com" ||
                host.endsWith(".githubusercontent.com") ||
                host == "cinepvq.vercel.app" ||
                host.endsWith(".cinepvq.vercel.app")
        } catch (_: Exception) {
            false
        }
    }

    suspend fun checkForUpdate(manualTrigger: Boolean = false): Boolean = withContext(Dispatchers.IO) {
        val currentState = _uiState.value
        if (currentState is UpdateUiState.Downloading || currentState is UpdateUiState.ReadyToInstall) {
            Log.d(TAG, "Update operation already active; skipping check.")
            return@withContext false
        }

        if (manualTrigger) {
            _uiState.value = UpdateUiState.Checking
        }

        try {
            val response = apiService.getAppVersion()
            if (!response.isSuccessful) {
                Log.w(TAG, "getAppVersion response failed with code ${response.code()}")
                if (manualTrigger) {
                    _uiState.value = UpdateUiState.Error(
                        message = "Không thể kiểm tra bản cập nhật lúc này (HTTP ${response.code()}).",
                        canRetry = true
                    )
                } else {
                    _uiState.value = UpdateUiState.Idle
                }
                return@withContext false
            }

            val info = response.body()
            if (info == null) {
                Log.w(TAG, "getAppVersion returned null body")
                if (manualTrigger) {
                    _uiState.value = UpdateUiState.Error(
                        message = "Dữ liệu phiên bản không hợp lệ.",
                        canRetry = true
                    )
                } else {
                    _uiState.value = UpdateUiState.Idle
                }
                return@withContext false
            }

            Log.d(TAG, "Current versionCode=$currentVersionCode, remote versionCode=${info.versionCode}")

            if (info.versionCode > currentVersionCode) {
                if (!manualTrigger && !info.forceUpdate && dismissedVersionCode == info.versionCode) {
                    Log.d(TAG, "Update ${info.versionCode} previously dismissed this session; ignoring background check.")
                    return@withContext true
                }

                _uiState.value = UpdateUiState.UpdateAvailable(
                    versionInfo = info,
                    isForced = info.forceUpdate
                )
                return@withContext true
            } else {
                if (manualTrigger) {
                    _uiState.value = UpdateUiState.Idle
                }
                return@withContext false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Update check failed: ${e.message}", e)
            if (manualTrigger) {
                _uiState.value = UpdateUiState.Error(
                    message = "Lỗi kết nối khi kiểm tra cập nhật. Vui lòng kiểm tra lại mạng.",
                    canRetry = true
                )
            } else {
                _uiState.value = UpdateUiState.Idle
            }
            return@withContext false
        }
    }

    suspend fun startDownload(versionInfo: AppVersionDto) = withContext(Dispatchers.IO) {
        val downloadUrl = versionInfo.downloadUrl.trim()
        if (!isDownloadUrlTrusted(downloadUrl)) {
            Log.e(TAG, "Untrusted download URL rejected: $downloadUrl")
            _uiState.value = UpdateUiState.Error(
                message = "Đường dẫn tải về không an toàn hoặc không được hỗ trợ.",
                canRetry = false,
                versionInfo = versionInfo
            )
            return@withContext
        }
        val expectedSha256 = versionInfo.sha256?.trim()?.lowercase()
        if (expectedSha256.isNullOrBlank() || !expectedSha256.matches(Regex("^[a-fA-F0-9]{64}$"))) {
            Log.e(TAG, "Missing or invalid SHA-256 in update manifest: '$expectedSha256'")
            _uiState.value = UpdateUiState.Error(
                message = "Bản cập nhật thiếu mã xác thực SHA-256 hợp lệ từ máy chủ.",
                canRetry = false,
                versionInfo = versionInfo
            )
            return@withContext
        }

        val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
        val targetFile = File(updatesDir, "Cinepvq-${versionInfo.versionCode}.apk")
        val tempFile = File(updatesDir, "Cinepvq-${versionInfo.versionCode}.apk.tmp")

        // If target file already exists and valid SHA-256 matches, reuse it
        if (targetFile.exists() && targetFile.length() > 0) {
            val expectedSha256 = versionInfo.sha256?.trim()?.lowercase()
            if (!expectedSha256.isNullOrBlank() && expectedSha256.matches(Regex("^[a-fA-F0-9]{64}$"))) {
                val existingHash = computeFileSha256(targetFile)
                if (existingHash.equals(expectedSha256, ignoreCase = true)) {
                    Log.d(TAG, "Cached APK has matching checksum; ready to install.")
                    _uiState.value = UpdateUiState.ReadyToInstall(versionInfo, targetFile)
                    return@withContext
                } else {
                    targetFile.delete()
                }
            } else {
                targetFile.delete()
            }
        }

        if (tempFile.exists()) {
            tempFile.delete()
        }

        _uiState.value = UpdateUiState.Downloading(
            versionInfo = versionInfo,
            progress = 0f,
            bytesDownloaded = 0L,
            totalBytes = -1L
        )

        try {
            val request = Request.Builder()
                .url(downloadUrl)
                .header("User-Agent", "Cinepvq-Android/${BuildConfig.VERSION_NAME}")
                .build()

            val response = downloadOkHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                _uiState.value = UpdateUiState.Error(
                    message = "Tải gói cài đặt thất bại (HTTP ${response.code}).",
                    canRetry = true,
                    versionInfo = versionInfo
                )
                return@withContext
            }

            val body = response.body ?: throw IOException("Empty response body from update server")
            val totalBytes = body.contentLength()
            val inputStream = body.byteStream()
            val outputStream = FileOutputStream(tempFile)
            val digest = MessageDigest.getInstance("SHA-256")

            val buffer = ByteArray(BUFFER_SIZE)
            var bytesRead: Int
            var downloadedBytes = 0L
            var lastEmittedTime = 0L

            inputStream.use { input ->
                outputStream.use { output ->
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                        digest.update(buffer, 0, bytesRead)
                        downloadedBytes += bytesRead

                        val now = System.currentTimeMillis()
                        if (now - lastEmittedTime >= 100 || (totalBytes > 0 && downloadedBytes == totalBytes)) {
                            lastEmittedTime = now
                            val progress = if (totalBytes > 0) {
                                (downloadedBytes.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f)
                            } else {
                                -1f
                            }
                            _uiState.value = UpdateUiState.Downloading(
                                versionInfo = versionInfo,
                                progress = progress,
                                bytesDownloaded = downloadedBytes,
                                totalBytes = totalBytes
                            )
                        }
                    }
                    output.flush()
                }
            }

            val calculatedHash = digest.digest().joinToString("") { "%02x".format(it) }
            val expectedHash = versionInfo.sha256?.trim()?.lowercase()

            if (expectedHash.isNullOrBlank() || !expectedHash.matches(Regex("^[a-fA-F0-9]{64}$"))) {
                Log.e(TAG, "Missing or invalid SHA-256 format in update manifest: '$expectedHash'")
                tempFile.delete()
                _uiState.value = UpdateUiState.Error(
                    message = "Bản cập nhật thiếu mã kiểm tra toàn vẹn SHA-256 hợp lệ từ máy chủ. Tệp đã bị hủy để đảm bảo an toàn.",
                    canRetry = true,
                    versionInfo = versionInfo
                )
                return@withContext
            }

            if (!calculatedHash.equals(expectedHash, ignoreCase = true)) {
                Log.e(TAG, "SHA-256 hash mismatch! Computed: $calculatedHash, Expected: $expectedHash")
                tempFile.delete()
                _uiState.value = UpdateUiState.Error(
                    message = "Xác thực gói cài đặt thất bại (Mã kiểm tra SHA-256 không khớp). Tệp đã bị hủy để đảm bảo an toàn.",
                    canRetry = true,
                    versionInfo = versionInfo
                )
                return@withContext
            }

            if (targetFile.exists()) {
                targetFile.delete()
            }
            if (!tempFile.renameTo(targetFile)) {
                tempFile.copyTo(targetFile, overwrite = true)
                tempFile.delete()
            }

            Log.d(TAG, "APK download and verification complete: ${targetFile.absolutePath}")
            _uiState.value = UpdateUiState.ReadyToInstall(
                versionInfo = versionInfo,
                apkFile = targetFile
            )
        } catch (e: Exception) {
            Log.e(TAG, "APK download failed: ${e.message}", e)
            if (tempFile.exists()) {
                tempFile.delete()
            }
            _uiState.value = UpdateUiState.Error(
                message = "Quá trình tải về bị gián đoạn: ${e.message ?: "Lỗi mạng"}",
                canRetry = true,
                versionInfo = versionInfo
            )
        }
    }

    fun canInstallApk(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    fun openInstallPermissionSettings(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to open unknown app sources settings", e)
                try {
                    val genericSettings = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(genericSettings)
                } catch (_: Exception) {}
            }
        }
    }

    fun installApk(context: Context, apkFile: File): InstallResult {
        if (!apkFile.exists() || apkFile.length() <= 0) {
            Log.e(TAG, "installApk: APK file does not exist or empty: ${apkFile.absolutePath}")
            return InstallResult.FileNotFound
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canInstallApk()) {
            Log.w(TAG, "Install permission not granted; requesting settings.")
            openInstallPermissionSettings(context)
            return InstallResult.PermissionRequested
        }

        return try {
            val authority = "${context.packageName}.fileprovider"
            val contentUri: Uri = FileProvider.getUriForFile(context, authority, apkFile)

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(installIntent)
            InstallResult.Launched
        } catch (e: Exception) {
            Log.e(TAG, "installApk failed to launch Package Installer", e)
            _uiState.value = UpdateUiState.Error(
                message = "Không thể khởi động trình cài đặt: ${e.message}",
                canRetry = true
            )
            InstallResult.Error
        }
    }

    fun dismissOptionalUpdate() {
        val current = _uiState.value
        if (current is UpdateUiState.UpdateAvailable && !current.isForced) {
            dismissedVersionCode = current.versionInfo.versionCode
            _uiState.value = UpdateUiState.Idle
        }
    }

    fun resetState() {
        _uiState.value = UpdateUiState.Idle
    }

    fun computeFileSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(BUFFER_SIZE)
        file.inputStream().use { input ->
            var read: Int
            while (input.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
