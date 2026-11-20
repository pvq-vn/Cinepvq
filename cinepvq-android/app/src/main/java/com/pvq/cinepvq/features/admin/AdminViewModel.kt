package com.pvq.cinepvq.features.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.core.network.model.*
import com.pvq.cinepvq.data.auth.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AdminTab(val label: String) {
    OVERVIEW("Tổng quan"),
    MOVIES("Phim"),
    CRAWLER("Crawler"),
    USERS("Người dùng"),
    ENGAGEMENT("Tương tác")
}

class AdminViewModel(
    private val networkModule: NetworkModule = CinepvqApp.instance.networkModule,
    private val authRepository: AuthRepository = CinepvqApp.instance.authRepository
) : ViewModel() {

    companion object {
        const val SOLE_ADMIN_EMAIL = "vanquyetp823@gmail.com"
        fun isAdminEmail(email: String?): Boolean =
            email?.trim().equals(SOLE_ADMIN_EMAIL, ignoreCase = true)
    }

    val currentUser = authRepository.currentUser

    private val _activeTab = MutableStateFlow(AdminTab.OVERVIEW)
    val activeTab: StateFlow<AdminTab> = _activeTab.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

    private val _isBusy = MutableStateFlow(false)
    val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()

    // Overview
    private val _stats = MutableStateFlow<AdminStatsResponseDto?>(null)
    val stats: StateFlow<AdminStatsResponseDto?> = _stats.asStateFlow()

    private val _isLoadingStats = MutableStateFlow(false)
    val isLoadingStats: StateFlow<Boolean> = _isLoadingStats.asStateFlow()

    // Movies
    private val _movies = MutableStateFlow<List<AdminMovieRowDto>>(emptyList())
    val movies: StateFlow<List<AdminMovieRowDto>> = _movies.asStateFlow()

    private val _movieSearch = MutableStateFlow("")
    val movieSearch: StateFlow<String> = _movieSearch.asStateFlow()

    private val _moviePage = MutableStateFlow(1)
    val moviePage: StateFlow<Int> = _moviePage.asStateFlow()

    private val _movieTotalPages = MutableStateFlow(1)
    val movieTotalPages: StateFlow<Int> = _movieTotalPages.asStateFlow()

    private val _isLoadingMovies = MutableStateFlow(false)
    val isLoadingMovies: StateFlow<Boolean> = _isLoadingMovies.asStateFlow()

    // Crawler
    private val _crawlerCaches = MutableStateFlow<List<AdminCrawlerCacheDto>>(emptyList())
    val crawlerCaches: StateFlow<List<AdminCrawlerCacheDto>> = _crawlerCaches.asStateFlow()

    private val _isLoadingCrawler = MutableStateFlow(false)
    val isLoadingCrawler: StateFlow<Boolean> = _isLoadingCrawler.asStateFlow()

    // Users
    private val _users = MutableStateFlow<List<AdminUserRowDto>>(emptyList())
    val users: StateFlow<List<AdminUserRowDto>> = _users.asStateFlow()

    private val _userSearch = MutableStateFlow("")
    val userSearch: StateFlow<String> = _userSearch.asStateFlow()

    private val _isLoadingUsers = MutableStateFlow(false)
    val isLoadingUsers: StateFlow<Boolean> = _isLoadingUsers.asStateFlow()

    // Engagement (Comments + Broadcast Notifications)
    private val _comments = MutableStateFlow<List<AdminCommentRowDto>>(emptyList())
    val comments: StateFlow<List<AdminCommentRowDto>> = _comments.asStateFlow()

    private val _isLoadingComments = MutableStateFlow(false)
    val isLoadingComments: StateFlow<Boolean> = _isLoadingComments.asStateFlow()

    init {
        if (isAdminEmail(authRepository.currentUser.value?.email)) {
            loadStats()
        }
    }

    fun clearToast() {
        _toastMessage.value = null
    }

    fun selectTab(tab: AdminTab) {
        _activeTab.value = tab
        when (tab) {
            AdminTab.OVERVIEW -> loadStats()
            AdminTab.MOVIES -> loadMovies()
            AdminTab.CRAWLER -> loadCrawlerStatus()
            AdminTab.USERS -> loadUsers()
            AdminTab.ENGAGEMENT -> loadComments()
        }
    }

    fun loadStats() {
        viewModelScope.launch {
            _isLoadingStats.value = true
            try {
                val res = networkModule.cinepvqApi.getAdminStats()
                if (res.isSuccessful && res.body()?.status == true) {
                    _stats.value = res.body()
                } else {
                    _toastMessage.value = res.body()?.message ?: "Không thể tải thống kê (HTTP ${res.code()})"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi kết nối máy chủ quản trị: ${e.localizedMessage ?: e.message}"
            } finally {
                _isLoadingStats.value = false
            }
        }
    }

    fun updateMovieSearch(q: String) {
        _movieSearch.value = q
    }

    fun loadMovies(query: String = _movieSearch.value, page: Int = 1) {
        viewModelScope.launch {
            _isLoadingMovies.value = true
            _moviePage.value = page
            try {
                val res = networkModule.cinepvqApi.getAdminMovies(query = query.trim(), page = page, limit = 15)
                val body = res.body()
                if (res.isSuccessful && body != null && body.status) {
                    _movies.value = body.items
                    _movieTotalPages.value = body.paginate.totalPage.coerceAtLeast(1)
                } else {
                    _toastMessage.value = body?.message ?: "Lỗi tải danh sách phim (HTTP ${res.code()})"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi mạng: ${e.localizedMessage ?: e.message}"
            } finally {
                _isLoadingMovies.value = false
            }
        }
    }

    fun enrichMovie(rawSlug: String) {
        val cleanSlug = rawSlug.trim().trim('/').removePrefix("phim/")
        if (cleanSlug.isBlank()) return
        viewModelScope.launch {
            _isBusy.value = true
            try {
                val res = networkModule.cinepvqApi.postAdminMovieAction(
                    AdminMovieActionRequest(action = "enrich", slug = cleanSlug)
                )
                _toastMessage.value = res.body()?.message
                    ?: if (res.isSuccessful) "Đã cào dữ liệu phim thành công!" else "Lỗi cào phim"
                loadMovies(page = _moviePage.value)
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi cào phim: ${e.localizedMessage ?: e.message}"
            } finally {
                _isBusy.value = false
            }
        }
    }

    fun fixAllEpisodes() {
        viewModelScope.launch {
            _isBusy.value = true
            try {
                val res = networkModule.cinepvqApi.postAdminMovieAction(
                    AdminMovieActionRequest(action = "fix_episodes")
                )
                _toastMessage.value = res.body()?.message ?: "Đã chuẩn hóa tên tập phim!"
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi chuẩn hóa: ${e.localizedMessage ?: e.message}"
            } finally {
                _isBusy.value = false
            }
        }
    }

    fun toggleMovieFeatured(movie: AdminMovieRowDto) {
        viewModelScope.launch {
            val next = !movie.isFeatured
            try {
                val res = networkModule.cinepvqApi.postAdminMovieAction(
                    AdminMovieActionRequest(action = "update", slug = movie.slug, isFeatured = next)
                )
                if (res.isSuccessful && res.body()?.status == true) {
                    _movies.value = _movies.value.map {
                        if (it.slug == movie.slug) it.copy(isFeatured = next) else it
                    }
                    _toastMessage.value = res.body()?.message ?: "Đã cập nhật trạng thái nổi bật"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi cập nhật: ${e.localizedMessage ?: e.message}"
            }
        }
    }

    fun toggleMovieHidden(movie: AdminMovieRowDto) {
        viewModelScope.launch {
            val next = !movie.isHidden
            try {
                val res = networkModule.cinepvqApi.postAdminMovieAction(
                    AdminMovieActionRequest(action = "update", slug = movie.slug, isHidden = next)
                )
                if (res.isSuccessful && res.body()?.status == true) {
                    _movies.value = _movies.value.map {
                        if (it.slug == movie.slug) it.copy(isHidden = next) else it
                    }
                    _toastMessage.value = res.body()?.message ?: "Đã cập nhật hiển thị phim"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi cập nhật: ${e.localizedMessage ?: e.message}"
            }
        }
    }

    fun deleteMovie(slug: String) {
        viewModelScope.launch {
            try {
                val res = networkModule.cinepvqApi.postAdminMovieAction(
                    AdminMovieActionRequest(action = "delete", slug = slug)
                )
                if (res.isSuccessful && res.body()?.status == true) {
                    _movies.value = _movies.value.filterNot { it.slug == slug }
                    _toastMessage.value = res.body()?.message ?: "Đã xóa phim khỏi DB nội bộ"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi xóa phim: ${e.localizedMessage ?: e.message}"
            }
        }
    }

    fun loadCrawlerStatus() {
        viewModelScope.launch {
            _isLoadingCrawler.value = true
            try {
                val res = networkModule.cinepvqApi.getAdminCrawlerStatus()
                if (res.isSuccessful && res.body()?.status == true) {
                    _crawlerCaches.value = res.body()!!.caches
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi tải trạng thái crawler: ${e.localizedMessage ?: e.message}"
            } finally {
                _isLoadingCrawler.value = false
            }
        }
    }

    fun runCrawlerAction(action: String) {
        viewModelScope.launch {
            _isBusy.value = true
            try {
                val res = networkModule.cinepvqApi.postAdminCrawlerAction(
                    AdminCrawlerActionRequest(action = action, limit = 6)
                )
                _toastMessage.value = res.body()?.message
                    ?: if (res.isSuccessful) "Thực thi crawler thành công!" else "Lỗi chạy crawler"
                loadCrawlerStatus()
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi crawler: ${e.localizedMessage ?: e.message}"
            } finally {
                _isBusy.value = false
            }
        }
    }

    fun updateUserSearch(q: String) {
        _userSearch.value = q
    }

    fun loadUsers(query: String = _userSearch.value) {
        viewModelScope.launch {
            _isLoadingUsers.value = true
            try {
                val res = networkModule.cinepvqApi.getAdminUsers(query.trim())
                if (res.isSuccessful && res.body()?.status == true) {
                    _users.value = res.body()!!.users
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi tải người dùng: ${e.localizedMessage ?: e.message}"
            } finally {
                _isLoadingUsers.value = false
            }
        }
    }

    fun toggleUserBan(user: AdminUserRowDto) {
        viewModelScope.launch {
            val nextStatus = if (user.status == "active") "banned" else "active"
            try {
                val res = networkModule.cinepvqApi.patchAdminUser(
                    AdminUserPatchRequest(userId = user.id, status = nextStatus)
                )
                if (res.isSuccessful && res.body()?.status == true) {
                    _users.value = _users.value.map {
                        if (it.id == user.id) it.copy(status = nextStatus) else it
                    }
                    _toastMessage.value = res.body()?.message ?: "Đã cập nhật trạng thái tài khoản"
                } else {
                    _toastMessage.value = res.body()?.message ?: "Không thể thay đổi trạng thái"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi: ${e.localizedMessage ?: e.message}"
            }
        }
    }

    fun loadComments() {
        viewModelScope.launch {
            _isLoadingComments.value = true
            try {
                val res = networkModule.cinepvqApi.getAdminComments()
                if (res.isSuccessful && res.body()?.status == true) {
                    _comments.value = res.body()!!.comments
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi tải bình luận: ${e.localizedMessage ?: e.message}"
            } finally {
                _isLoadingComments.value = false
            }
        }
    }

    fun deleteComment(id: String) {
        viewModelScope.launch {
            try {
                val res = networkModule.cinepvqApi.deleteAdminComment(id)
                if (res.isSuccessful && res.body()?.status == true) {
                    _comments.value = _comments.value.filterNot { it.id == id }
                    _toastMessage.value = res.body()?.message ?: "Đã xóa bình luận"
                }
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi xóa bình luận: ${e.localizedMessage ?: e.message}"
            }
        }
    }

    fun sendBroadcastNotification(title: String, message: String, movieSlug: String?) {
        if (title.isBlank() || message.isBlank()) {
            _toastMessage.value = "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo"
            return
        }
        viewModelScope.launch {
            _isBusy.value = true
            try {
                val res = networkModule.cinepvqApi.sendAdminNotification(
                    AdminNotificationRequest(
                        title = title.trim(),
                        message = message.trim(),
                        movieSlug = movieSlug?.trim()?.ifBlank { null },
                        targetUserId = "all"
                    )
                )
                _toastMessage.value = res.body()?.message
                    ?: if (res.isSuccessful) "Đã phát thông báo thành công!" else "Gửi thông báo thất bại"
            } catch (e: Exception) {
                _toastMessage.value = "Lỗi gửi thông báo: ${e.localizedMessage ?: e.message}"
            } finally {
                _isBusy.value = false
            }
        }
    }
}
