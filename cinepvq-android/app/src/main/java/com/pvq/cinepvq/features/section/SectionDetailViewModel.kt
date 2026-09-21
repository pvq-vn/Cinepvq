package com.pvq.cinepvq.features.section

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

class SectionDetailViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository
) : ViewModel() {

    private val _movies = MutableStateFlow<List<Movie>>(emptyList())
    val movies: StateFlow<List<Movie>> = _movies.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _isLoadingMore = MutableStateFlow(false)
    val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var currentType: String = ""
    private var currentPage: Int = 1
    private var fetchJob: Job? = null

    fun initSection(type: String) {
        if (currentType == type && _movies.value.isNotEmpty()) return
        currentType = type
        currentPage = 1
        _hasMore.value = true
        _movies.value = emptyList()
        loadData(isRefresh = false)
    }

    fun refresh() {
        if (_isRefreshing.value) return
        currentPage = 1
        _hasMore.value = true
        loadData(isRefresh = true)
    }

    fun loadMore() {
        if (_isLoading.value || _isLoadingMore.value || !_hasMore.value) return
        currentPage++
        fetchJob?.cancel()
        fetchJob = viewModelScope.launch {
            _isLoadingMore.value = true
            val result = fetchPage(currentType, currentPage)
            val newItems = result.getOrDefault(emptyList())
            if (newItems.isEmpty()) {
                _hasMore.value = false
            } else {
                val existingSlugs = _movies.value.map { it.slug }.toSet()
                val filteredNew = newItems.filter { it.slug !in existingSlugs }
                if (filteredNew.isEmpty()) {
                    _hasMore.value = false
                } else {
                    _movies.value = _movies.value + filteredNew
                }
            }
            _isLoadingMore.value = false
        }
    }

    private fun loadData(isRefresh: Boolean) {
        fetchJob?.cancel()
        fetchJob = viewModelScope.launch {
            if (isRefresh) {
                _isRefreshing.value = true
            } else {
                _isLoading.value = true
            }
            _errorMessage.value = null

            val result = fetchPage(currentType, 1)
            if (result.isSuccess) {
                val list = result.getOrDefault(emptyList())
                _movies.value = list
                _hasMore.value = list.size >= 10
            } else {
                _errorMessage.value = result.exceptionOrNull()?.message ?: "Không thể tải danh sách phim"
            }

            _isLoading.value = false
            _isRefreshing.value = false
        }
    }

    private suspend fun fetchPage(type: String, page: Int): Result<List<Movie>> {
        val cleanType = type.trim()
        return when {
            cleanType == "phim-moi" || cleanType == "phim" || cleanType == "latest" -> {
                movieRepository.getLatestMovies(page)
            }
            cleanType.startsWith("the-loai/") -> {
                val genreSlug = cleanType.removePrefix("the-loai/")
                movieRepository.getMoviesByGenre(genreSlug, page)
            }
            cleanType.startsWith("quoc-gia/") -> {
                val countrySlug = cleanType.removePrefix("quoc-gia/")
                movieRepository.getMoviesByCountry(countrySlug, page)
            }
            cleanType == "thinh-hanh" || cleanType == "trending" -> {
                movieRepository.getLatestMovies(page)
            }
            else -> {
                movieRepository.getMoviesByCategory(cleanType, page)
            }
        }
    }
}
