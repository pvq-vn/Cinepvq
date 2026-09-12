package com.pvq.cinepvq.features.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.player.VideoSourceRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlayerViewModel(
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val videoSourceRepository: VideoSourceRepository = CinepvqApp.instance.videoSourceRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository
) : ViewModel() {

    private val _movie = MutableStateFlow<MovieDetail?>(null)
    val movie: StateFlow<MovieDetail?> = _movie.asStateFlow()

    private val _currentEpisode = MutableStateFlow<EpisodeItem?>(null)
    val currentEpisode: StateFlow<EpisodeItem?> = _currentEpisode.asStateFlow()

    private val _availableSources = MutableStateFlow<List<StreamSource>>(emptyList())
    val availableSources: StateFlow<List<StreamSource>> = _availableSources.asStateFlow()

    private val _activeStream = MutableStateFlow<StreamSource?>(null)
    val activeStream: StateFlow<StreamSource?> = _activeStream.asStateFlow()

    private val _isLoadingStream = MutableStateFlow(true)
    val isLoadingStream: StateFlow<Boolean> = _isLoadingStream.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    var initialResumePositionMs: Long = 0L
        private set

    fun initializePlayer(
        slug: String,
        episodeSlug: String,
        serverName: String? = null,
        initialEmbedUrl: String? = null
    ) {
        viewModelScope.launch {
            _isLoadingStream.value = true
            _errorMessage.value = null

            // 1. Fetch movie detail
            val movieRes = movieRepository.getMovieDetail(slug)
            val detail = movieRes.getOrNull()
            _movie.value = detail

            // 2. Find matching episode
            val allEpisodes = detail?.episodes?.flatMap { it.items } ?: emptyList()
            val targetEp = allEpisodes.find { it.slug == episodeSlug }
                ?: EpisodeItem(name = episodeSlug, slug = episodeSlug, embed = initialEmbedUrl ?: "")
            _currentEpisode.value = targetEp

            // 3. Find resume position from local watch history
            val history = CinepvqApp.instance.database.watchHistoryDao().getHistoryBySlug(slug)
            if (history != null && history.currentTime > 0) {
                // If history is for the same episode or general resume
                initialResumePositionMs = history.currentTime * 1000L
            }

            // 4. Resolve multi-source stream (K20 Direct HLS, KKPhim HLS, etc.)
            val sources = videoSourceRepository.resolveStreams(
                slug = slug,
                episodeSlug = episodeSlug,
                serverName = serverName,
                fallbackM3u8 = targetEp.m3u8Url,
                fallbackEmbed = targetEp.embed.ifBlank { initialEmbedUrl }
            )

            _availableSources.value = sources
            val chosen = sources.firstOrNull { it.isAvailable }
            if (chosen != null) {
                _activeStream.value = chosen
            } else {
                _errorMessage.value = "Không tìm thấy nguồn phát khả dụng cho tập này"
            }

            _isLoadingStream.value = false
        }
    }

    fun switchStream(source: StreamSource) {
        _activeStream.value = source
    }

    fun recordProgress(currentMs: Long, durationMs: Long) {
        val m = _movie.value ?: return
        val ep = _currentEpisode.value ?: return
        val currentSec = currentMs / 1000L
        val durationSec = durationMs / 1000L

        if (currentSec <= 0) return

        viewModelScope.launch {
            userSyncRepository.recordWatchProgress(
                movieSlug = m.slug,
                movieName = m.name,
                originalName = m.originalName,
                thumbUrl = m.thumbUrl,
                episodeSlug = ep.slug,
                episodeName = "Tập ${ep.name}",
                currentTime = currentSec,
                duration = durationSec
            )
        }
    }

    fun getNextEpisode(): EpisodeItem? {
        val detail = _movie.value ?: return null
        val currentEp = _currentEpisode.value ?: return null
        val server = detail.episodes.firstOrNull { it.items.any { item -> item.slug == currentEp.slug } }
            ?: detail.episodes.firstOrNull() ?: return null
        val currentIndex = server.items.indexOfFirst { it.slug == currentEp.slug }
        if (currentIndex != -1 && currentIndex < server.items.size - 1) {
            return server.items[currentIndex + 1]
        }
        return null
    }

    fun getPreviousEpisode(): EpisodeItem? {
        val detail = _movie.value ?: return null
        val currentEp = _currentEpisode.value ?: return null
        val server = detail.episodes.firstOrNull { it.items.any { item -> item.slug == currentEp.slug } }
            ?: detail.episodes.firstOrNull() ?: return null
        val currentIndex = server.items.indexOfFirst { it.slug == currentEp.slug }
        if (currentIndex > 0) {
            return server.items[currentIndex - 1]
        }
        return null
    }
}
