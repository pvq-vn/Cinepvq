package com.pvq.cinepvq.features.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.core.network.model.Comment
import com.pvq.cinepvq.core.network.model.PostCommentRequest
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import com.pvq.cinepvq.domain.model.Movie

class DetailViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    private val _movieDetail = MutableStateFlow<MovieDetail?>(null)
    val movieDetail: StateFlow<MovieDetail?> = _movieDetail.asStateFlow()

    private val _isFavorite = MutableStateFlow(false)
    val isFavorite: StateFlow<Boolean> = _isFavorite.asStateFlow()

    private val _selectedServerIndex = MutableStateFlow(0)
    val selectedServerIndex: StateFlow<Int> = _selectedServerIndex.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _resumeHistory = MutableStateFlow<com.pvq.cinepvq.domain.model.WatchHistoryItem?>(null)
    val resumeHistory: StateFlow<com.pvq.cinepvq.domain.model.WatchHistoryItem?> = _resumeHistory.asStateFlow()

    private val _comments = MutableStateFlow<List<Comment>>(emptyList())
    val comments: StateFlow<List<Comment>> = _comments.asStateFlow()

    private val _isPostingComment = MutableStateFlow(false)
    val isPostingComment: StateFlow<Boolean> = _isPostingComment.asStateFlow()

    private val _similarMovies = MutableStateFlow<List<Movie>>(emptyList())
    val similarMovies: StateFlow<List<Movie>> = _similarMovies.asStateFlow()

    fun loadMovie(slug: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            // Observe favorite status
            userSyncRepository.isFavorite(slug).collectLatest {
                _isFavorite.value = it
            }
        }

        viewModelScope.launch {
            // Observe resume progress
            userSyncRepository.getHistory(slug).collectLatest {
                _resumeHistory.value = it
            }
        }

        viewModelScope.launch {
            val res = movieRepository.getMovieDetail(slug)
            if (res.isSuccess && res.getOrNull() != null) {
                val detail = res.getOrNull()!!
                _movieDetail.value = detail
                fetchSimilarMovies(detail)
            } else {
                _errorMessage.value = res.exceptionOrNull()?.message ?: "Không thể tải chi tiết phim"
            }
            _isLoading.value = false
        }

        fetchComments(slug)
    }

    private fun fetchSimilarMovies(detail: MovieDetail) {
        viewModelScope.launch {
            try {
                // Fallback to Latest movies as recommendations
                val res = movieRepository.getLatestMovies(1)
                if (res.isSuccess) {
                    val list = res.getOrDefault(emptyList())
                    // Filter out current movie and take first 10
                    _similarMovies.value = list.filter { it.slug != detail.slug }.take(10)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun fetchComments(slug: String) {
        viewModelScope.launch {
            try {
                val response = CinepvqApp.instance.networkModule.cinepvqApi.getComments(slug)
                if (response.isSuccessful) {
                    _comments.value = response.body()?.comments ?: emptyList()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun postComment(slug: String, content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _isPostingComment.value = true
            try {
                val request = PostCommentRequest(movieSlug = slug, content = content)
                val response = CinepvqApp.instance.networkModule.cinepvqApi.postComment(request)
                if (response.isSuccessful) {
                    val newComment = response.body()?.comment
                    if (newComment != null) {
                        _comments.value = listOf(newComment) + _comments.value
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _isPostingComment.value = false
            }
        }
    }

    fun selectServer(index: Int) {
        _selectedServerIndex.value = index
    }

    fun toggleFavorite() {
        val detail = _movieDetail.value ?: return
        viewModelScope.launch {
            userSyncRepository.toggleFavorite(detail)
        }
    }
}
