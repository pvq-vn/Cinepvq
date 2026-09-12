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

    private val _heroMovie = MutableStateFlow<Movie?>(null)
    val heroMovie: StateFlow<Movie?> = _heroMovie.asStateFlow()

    private val _latestMovies = MutableStateFlow<List<Movie>>(emptyList())
    val latestMovies: StateFlow<List<Movie>> = _latestMovies.asStateFlow()

    private val _seriesMovies = MutableStateFlow<List<Movie>>(emptyList())
    val seriesMovies: StateFlow<List<Movie>> = _seriesMovies.asStateFlow()

    private val _singleMovies = MutableStateFlow<List<Movie>>(emptyList())
    val singleMovies: StateFlow<List<Movie>> = _singleMovies.asStateFlow()

    private val _animeMovies = MutableStateFlow<List<Movie>>(emptyList())
    val animeMovies: StateFlow<List<Movie>> = _animeMovies.asStateFlow()

    val continueWatching: StateFlow<List<WatchHistoryItem>> = userSyncRepository.getAllHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    val isLoggedIn: StateFlow<Boolean> = CinepvqApp.instance.authRepository.isLoggedIn

    init {
        loadHomeData()
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                // Load Hero/Latest first for fastest initial render
                val latestRes = movieRepository.getLatestMovies(1)
                val latestList = latestRes.getOrDefault(emptyList())
                _latestMovies.value = latestList
                if (latestList.isNotEmpty()) {
                    _heroMovie.value = latestList.first()
                } else if (latestRes.isFailure) {
                    _errorMessage.value = latestRes.exceptionOrNull()?.message ?: "Không thể tải dữ liệu phim"
                }

                // Initial UI is unblocked, now load rest sequentially to avoid network/JSON parsing spike
                _isLoading.value = false

                val seriesRes = movieRepository.getMoviesByCategory("phim-bo", 1)
                _seriesMovies.value = seriesRes.getOrDefault(emptyList())

                val singleRes = movieRepository.getMoviesByCategory("phim-le", 1)
                _singleMovies.value = singleRes.getOrDefault(emptyList())

                val animeRes = movieRepository.getMoviesByCategory("hoat-hinh", 1)
                _animeMovies.value = animeRes.getOrDefault(emptyList())

            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Đã xảy ra lỗi khi tải dữ liệu"
                _isLoading.value = false
            }
        }
    }
}
