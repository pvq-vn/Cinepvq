package com.pvq.cinepvq.features.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.domain.model.Movie
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch

class SearchViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val database: com.pvq.cinepvq.core.database.CinepvqDatabase = CinepvqApp.instance.database,
    private val secureStorageManager: com.pvq.cinepvq.core.security.SecureStorageManager = CinepvqApp.instance.secureStorageManager,
    private val userSyncRepository: com.pvq.cinepvq.data.user.UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    val query = MutableStateFlow("")

    private val _searchResults = MutableStateFlow<List<Movie>>(emptyList())
    val searchResults: StateFlow<List<Movie>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _isLoadingMore = MutableStateFlow(false)
    val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

    private val _canLoadMore = MutableStateFlow(true)
    val canLoadMore: StateFlow<Boolean> = _canLoadMore.asStateFlow()

    val selectedTag = MutableStateFlow("Tất cả")
    val quickTags = listOf("Tất cả", "Phim bộ", "Phim lẻ", "Hoạt hình", "Hành động", "Tình cảm", "Kinh dị")

    private var searchJob: Job? = null
    private var loadMoreJob: Job? = null

    // Internal paging state
    private var currentPage = 1
    private var rawMovies = mutableListOf<Movie>()

    // Filter States
    val activeCategory = MutableStateFlow<String?>(null)
    val activeGenre = MutableStateFlow<String?>(null)
    val activeCountry = MutableStateFlow<String?>(null)
    val activeSort = MutableStateFlow("latest")

    // Search History isolated by active user
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val searchHistory = userSyncRepository.activeUserIdFlow.flatMapLatest { uid ->
        database.searchHistoryDao().getRecentSearches(uid)
    }

    init {
        loadInitialList()
    }

    private fun executeDiscovery() {
        searchJob?.cancel()
        loadMoreJob?.cancel()
        searchJob = viewModelScope.launch {
            _isSearching.value = true
            currentPage = 1
            _canLoadMore.value = true

            val q = query.value.trim()
            val cat = activeCategory.value
            val gen = activeGenre.value
            val cou = activeCountry.value

            val res = when {
                q.isNotBlank() -> movieRepository.searchMovies(q, 1)
                cat != null -> movieRepository.getMoviesByCategory(cat, 1)
                gen != null -> movieRepository.getMoviesByGenre(gen, 1)
                cou != null -> movieRepository.getMoviesByCountry(cou, 1)
                else -> movieRepository.getLatestMovies(1)
            }

            val list = res.getOrDefault(emptyList())
            rawMovies = list.toMutableList()
            _canLoadMore.value = list.size >= 10
            applySorting(rawMovies)
            _isSearching.value = false
        }
    }

    private fun loadInitialList() {
        executeDiscovery()
    }

    private fun applySorting(list: List<Movie>) {
        val sorted = when (activeSort.value) {
            "name" -> list.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.name })
            "year" -> list.sortedByDescending { it.year.filter { c -> c.isDigit() }.toIntOrNull() ?: 0 }
            else -> list
        }
        _searchResults.value = sorted
    }

    fun onSortChanged(sort: String) {
        if (activeSort.value == sort) return
        activeSort.value = sort
        // Reset to page 1 fresh and re-fetch discovery under the new sort
        executeDiscovery()
    }

    fun applyFilter(type: String, value: String?) {
        when (type) {
            "category" -> activeCategory.value = value
            "genre" -> activeGenre.value = value
            "country" -> activeCountry.value = value
        }
        executeDiscovery()
    }

    fun loadMore() {
        if (_isSearching.value || _isLoadingMore.value || !_canLoadMore.value) return

        loadMoreJob?.cancel()
        loadMoreJob = viewModelScope.launch {
            _isLoadingMore.value = true
            val nextPage = currentPage + 1

            val q = query.value.trim()
            val cat = activeCategory.value
            val gen = activeGenre.value
            val cou = activeCountry.value

            val res = when {
                q.isNotBlank() -> movieRepository.searchMovies(q, nextPage)
                cat != null -> movieRepository.getMoviesByCategory(cat, nextPage)
                gen != null -> movieRepository.getMoviesByGenre(gen, nextPage)
                cou != null -> movieRepository.getMoviesByCountry(cou, nextPage)
                else -> movieRepository.getLatestMovies(nextPage)
            }

            val newItems = res.getOrDefault(emptyList())
            if (newItems.isEmpty()) {
                _canLoadMore.value = false
            } else {
                val existingSlugs = rawMovies.map { it.slug }.toSet()
                val uniqueNew = newItems.filter { it.slug !in existingSlugs }
                if (uniqueNew.isEmpty()) {
                    _canLoadMore.value = false
                } else {
                    currentPage = nextPage
                    rawMovies.addAll(uniqueNew)
                    applySorting(rawMovies)
                    if (newItems.size < 10) {
                        _canLoadMore.value = false
                    }
                }
            }
            _isLoadingMore.value = false
        }
    }

    fun clearAllFilters() {
        query.value = ""
        activeCategory.value = null
        activeGenre.value = null
        activeCountry.value = null
        activeSort.value = "latest"
        executeDiscovery()
    }

    fun saveSearchQuery(query: String) {
        if (query.isBlank()) return
        val uid = secureStorageManager.activeUserId
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            database.searchHistoryDao().insert(
                com.pvq.cinepvq.core.database.SearchHistoryEntity(userId = uid, query = query.trim())
            )
        }
    }

    fun deleteSearchQuery(query: String) {
        val uid = secureStorageManager.activeUserId
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            database.searchHistoryDao().delete(userId = uid, query = query)
        }
    }

    fun clearSearchHistory() {
        val uid = secureStorageManager.activeUserId
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            database.searchHistoryDao().clearByUser(userId = uid)
        }
    }

    fun onQueryChange(newQuery: String) {
        query.value = newQuery

        searchJob?.cancel()
        loadMoreJob?.cancel()

        searchJob = viewModelScope.launch {
            if (newQuery.isNotBlank()) {
                delay(350)
            }
            executeDiscovery()
        }
    }

    fun clearQuery() {
        query.value = ""
        executeDiscovery()
    }
}
