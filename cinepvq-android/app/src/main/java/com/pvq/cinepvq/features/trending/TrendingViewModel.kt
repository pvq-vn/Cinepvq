package com.pvq.cinepvq.features.trending

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.domain.model.Movie
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class TrendingTab(val label: String, val icon: String, val categoryKey: String, val isGenre: Boolean = false) {
    ALL("Tổng hợp", "🔥", "all"),
    SERIES("Phim bộ", "📺", "phim-bo"),
    SINGLE("Phim lẻ", "🎬", "phim-le"),
    ANIME("Hoạt hình", "⚡", "hoat-hinh"),
    ACTION("Hành động", "💥", "hanh-dong", isGenre = true),
    ROMANCE("Tình cảm", "💖", "tinh-cam", isGenre = true)
}

class TrendingViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository
) : ViewModel() {

    private val _activeTab = MutableStateFlow(TrendingTab.ALL)
    val activeTab: StateFlow<TrendingTab> = _activeTab.asStateFlow()

    private val _movies = MutableStateFlow<List<Movie>>(emptyList())
    val movies: StateFlow<List<Movie>> = _movies.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var currentJob: Job? = null
    private val cache = mutableMapOf<TrendingTab, List<Movie>>()

    init {
        loadTab(TrendingTab.ALL, isRefresh = false)
    }

    fun selectTab(tab: TrendingTab) {
        if (_activeTab.value == tab) return
        _activeTab.value = tab
        if (cache.containsKey(tab)) {
            _movies.value = cache[tab] ?: emptyList()
        } else {
            loadTab(tab, isRefresh = false)
        }
    }

    fun refresh() {
        cache.clear()
        loadTab(_activeTab.value, isRefresh = true)
    }

    private fun loadTab(tab: TrendingTab, isRefresh: Boolean) {
        currentJob?.cancel()
        currentJob = viewModelScope.launch {
            if (isRefresh) {
                _isRefreshing.value = true
            } else {
                _isLoading.value = true
            }
            _errorMessage.value = null

            val result = if (tab == TrendingTab.ALL) {
                movieRepository.getLatestMovies(1)
            } else if (tab.isGenre) {
                movieRepository.getMoviesByGenre(tab.categoryKey, 1)
            } else {
                movieRepository.getMoviesByCategory(tab.categoryKey, 1)
            }

            if (result.isSuccess) {
                val list = result.getOrDefault(emptyList())
                cache[tab] = list
                _movies.value = list
            } else {
                _errorMessage.value = result.exceptionOrNull()?.message ?: "Không thể tải bảng xếp hạng"
            }

            _isLoading.value = false
            _isRefreshing.value = false
        }
    }
}
