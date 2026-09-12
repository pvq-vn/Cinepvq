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
import kotlinx.coroutines.launch

class SearchViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val database: com.pvq.cinepvq.core.database.CinepvqDatabase = CinepvqApp.instance.database
) : ViewModel() {

    val query = MutableStateFlow("")

    private val _searchResults = MutableStateFlow<List<Movie>>(emptyList())
    val searchResults: StateFlow<List<Movie>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    val selectedTag = MutableStateFlow("Tất cả")

    val quickTags = listOf("Tất cả", "Phim bộ", "Phim lẻ", "Hoạt hình", "Hành động", "Tình cảm", "Kinh dị")

    private var searchJob: Job? = null

    // Filter States
    val activeCategory = MutableStateFlow<String?>(null)
    val activeGenre = MutableStateFlow<String?>(null)
    val activeCountry = MutableStateFlow<String?>(null)
    val activeSort = MutableStateFlow("latest")

    // Search History
    val searchHistory = database.searchHistoryDao().getRecentSearches()

    init {
        loadInitialList()
    }

    private fun loadInitialList() {
        viewModelScope.launch {
            _isSearching.value = true
            val res = movieRepository.getLatestMovies(1)
            applySorting(res.getOrDefault(emptyList()))
            _isSearching.value = false
        }
    }

    private fun applySorting(list: List<Movie>) {
        val sorted = when (activeSort.value) {
            "name" -> list.sortedBy { it.name }
            "year" -> list.sortedByDescending { it.year.toIntOrNull() ?: 0 }
            else -> list
        }
        _searchResults.value = sorted
    }

    fun onSortChanged(sort: String) {
        activeSort.value = sort
        applySorting(_searchResults.value)
    }

    fun applyFilter(type: String, value: String?) {
        query.value = "" // clear keyword
        activeCategory.value = if (type == "category") value else null
        activeGenre.value = if (type == "genre") value else null
        activeCountry.value = if (type == "country") value else null
        
        searchJob?.cancel()
        if (value == null) {
            loadInitialList()
            return
        }
        
        searchJob = viewModelScope.launch {
            _isSearching.value = true
            val res = when (type) {
                "category" -> movieRepository.getMoviesByCategory(value, 1)
                "genre" -> movieRepository.getMoviesByGenre(value, 1)
                "country" -> movieRepository.getMoviesByCountry(value, 1)
                else -> movieRepository.getLatestMovies(1)
            }
            applySorting(res.getOrDefault(emptyList()))
            _isSearching.value = false
        }
    }

    fun clearAllFilters() {
        query.value = ""
        activeCategory.value = null
        activeGenre.value = null
        activeCountry.value = null
        activeSort.value = "latest"
        loadInitialList()
    }

    fun saveSearchQuery(query: String) {
        if (query.isBlank()) return
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            database.searchHistoryDao().insert(
                com.pvq.cinepvq.core.database.SearchHistoryEntity(query.trim())
            )
        }
    }

    fun deleteSearchQuery(query: String) {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            database.searchHistoryDao().delete(query)
        }
    }

    fun clearSearchHistory() {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            database.searchHistoryDao().clearAll()
        }
    }

    fun onQueryChange(newQuery: String) {
        query.value = newQuery
        // When typing query, clear other filters
        activeCategory.value = null
        activeGenre.value = null
        activeCountry.value = null
        
        searchJob?.cancel()

        if (newQuery.isBlank()) {
            loadInitialList()
            return
        }

        searchJob = viewModelScope.launch {
            delay(350)
            _isSearching.value = true
            val res = movieRepository.searchMovies(newQuery)
            applySorting(res.getOrDefault(emptyList()))
            _isSearching.value = false
        }
    }

    fun clearQuery() {
        query.value = ""
        loadInitialList()
    }
}
