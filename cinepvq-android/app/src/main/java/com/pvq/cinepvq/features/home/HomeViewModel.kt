package com.pvq.cinepvq.features.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.Movie
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class HomeViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    // ─── BATCH 1: Immediate Mount ──────────────────────────────────────────
    private val _heroMovie = MutableStateFlow<Movie?>(null)
    val heroMovie: StateFlow<Movie?> = _heroMovie.asStateFlow()

    private val _latestMovies = MutableStateFlow<List<Movie>>(emptyList())
    val latestMovies: StateFlow<List<Movie>> = _latestMovies.asStateFlow()

    private val _seriesMovies = MutableStateFlow<List<Movie>>(emptyList())
    val seriesMovies: StateFlow<List<Movie>> = _seriesMovies.asStateFlow()

    val continueWatching: StateFlow<List<WatchHistoryItem>> = userSyncRepository.getAllHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // ─── BATCH 2: Viewport Lazy Load (Phim Lẻ, Hoạt Hình, TV Shows) ────────
    private val _singleMovies = MutableStateFlow<List<Movie>>(emptyList())
    val singleMovies: StateFlow<List<Movie>> = _singleMovies.asStateFlow()

    private val _animeMovies = MutableStateFlow<List<Movie>>(emptyList())
    val animeMovies: StateFlow<List<Movie>> = _animeMovies.asStateFlow()

    private val _tvShowsMovies = MutableStateFlow<List<Movie>>(emptyList())
    val tvShowsMovies: StateFlow<List<Movie>> = _tvShowsMovies.asStateFlow()

    private val _isBatch2Loading = MutableStateFlow(false)
    val isBatch2Loading: StateFlow<Boolean> = _isBatch2Loading.asStateFlow()

    private val _isBatch2Loaded = MutableStateFlow(false)
    val isBatch2Loaded: StateFlow<Boolean> = _isBatch2Loaded.asStateFlow()

    // ─── BATCH 3: Viewport Lazy Load (Hành Động, Âu Mỹ, Hàn Quốc) ───────────
    private val _actionMovies = MutableStateFlow<List<Movie>>(emptyList())
    val actionMovies: StateFlow<List<Movie>> = _actionMovies.asStateFlow()

    private val _westernMovies = MutableStateFlow<List<Movie>>(emptyList())
    val westernMovies: StateFlow<List<Movie>> = _westernMovies.asStateFlow()

    private val _koreanMovies = MutableStateFlow<List<Movie>>(emptyList())
    val koreanMovies: StateFlow<List<Movie>> = _koreanMovies.asStateFlow()

    private val _isBatch3Loading = MutableStateFlow(false)
    val isBatch3Loading: StateFlow<Boolean> = _isBatch3Loading.asStateFlow()

    private val _isBatch3Loaded = MutableStateFlow(false)
    val isBatch3Loaded: StateFlow<Boolean> = _isBatch3Loaded.asStateFlow()

    // ─── Screen Status ─────────────────────────────────────────────────────
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    val isLoggedIn: StateFlow<Boolean> = CinepvqApp.instance.authRepository.isLoggedIn

    init {
        loadHomeData()
    }

    fun loadHomeData(isRefresh: Boolean = false) {
        viewModelScope.launch {
            if (isRefresh) {
                _isRefreshing.value = true
            } else {
                _isLoading.value = true
            }
            _errorMessage.value = null

            try {
                // 1. Prioritize Latest / Hero to unblock initial screen rendering immediately
                val latestRes = movieRepository.getLatestMovies(1)
                val latestList = latestRes.getOrDefault(emptyList())
                _latestMovies.value = latestList
                if (latestList.isNotEmpty()) {
                    _heroMovie.value = latestList.first()
                } else if (latestRes.isFailure) {
                    _errorMessage.value = latestRes.exceptionOrNull()?.message ?: "Không thể tải dữ liệu phim"
                }

                // Initial screen is now ready to compose with zero jank
                _isLoading.value = false

                // 2. Load Series (Batch 1 completion)
                val seriesRes = movieRepository.getMoviesByCategory("phim-bo", 1)
                _seriesMovies.value = seriesRes.getOrDefault(emptyList())

                if (isRefresh) {
                    // Reset batches so user scrolling can re-fetch fresh data on-demand
                    _isBatch2Loaded.value = false
                    _isBatch3Loaded.value = false
                }
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Đã xảy ra lỗi khi tải dữ liệu"
                _isLoading.value = false
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun loadBatch2() {
        if (_isBatch2Loaded.value || _isBatch2Loading.value) return
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            _isBatch2Loading.value = true
            try {
                val singleDeferred = async { movieRepository.getMoviesByCategory("phim-le", 1) }
                val animeDeferred = async { movieRepository.getMoviesByCategory("hoat-hinh", 1) }
                val tvShowsDeferred = async { movieRepository.getMoviesByCategory("tv-shows", 1) }

                val single = singleDeferred.await().getOrDefault(emptyList())
                val anime = animeDeferred.await().getOrDefault(emptyList())
                val tv = tvShowsDeferred.await().getOrDefault(emptyList())

                _singleMovies.value = single
                _animeMovies.value = anime
                _tvShowsMovies.value = tv

                _isBatch2Loaded.value = true
            } catch (_: Exception) {
                // Ignore transient network errors; will retry on next scroll trigger
            } finally {
                _isBatch2Loading.value = false
            }
        }
    }

    fun loadBatch3() {
        if (!_isBatch2Loaded.value || _isBatch3Loaded.value || _isBatch3Loading.value) return
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            _isBatch3Loading.value = true
            try {
                val actionDeferred = async { movieRepository.getMoviesByGenre("hanh-dong", 1) }
                val westernDeferred = async { movieRepository.getMoviesByCountry("au-my", 1) }
                val koreanDeferred = async { movieRepository.getMoviesByCountry("han-quoc", 1) }

                val action = actionDeferred.await().getOrDefault(emptyList())
                val western = westernDeferred.await().getOrDefault(emptyList())
                val korean = koreanDeferred.await().getOrDefault(emptyList())

                _actionMovies.value = action
                _westernMovies.value = western
                _koreanMovies.value = korean

                _isBatch3Loaded.value = true
            } catch (_: Exception) {
                // Ignore transient network errors; will retry on next scroll trigger
            } finally {
                _isBatch3Loading.value = false
            }
        }
    }
}
