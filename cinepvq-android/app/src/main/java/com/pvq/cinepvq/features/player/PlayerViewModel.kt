package com.pvq.cinepvq.features.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.data.player.PlaybackManager
import com.pvq.cinepvq.data.player.VideoSourceRepository
import com.pvq.cinepvq.data.settings.SettingsRepository
import com.pvq.cinepvq.data.user.UserSyncRepository
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.domain.model.StreamSource
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PlayerViewModel(
    val playbackManager: PlaybackManager = CinepvqApp.instance.playbackManager,
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository,
    private val videoSourceRepository: VideoSourceRepository = CinepvqApp.instance.videoSourceRepository,
    private val userSyncRepository: UserSyncRepository = CinepvqApp.instance.userSyncRepository,
    private val settingsRepository: SettingsRepository = CinepvqApp.instance.settingsRepository
) : ViewModel() {

    val movie: StateFlow<MovieDetail?> = playbackManager.movie
    val currentEpisode: StateFlow<EpisodeItem?> = playbackManager.currentEpisode
    val availableSources: StateFlow<List<StreamSource>> = playbackManager.availableSources
    val activeStream: StateFlow<StreamSource?> = playbackManager.activeStream
    val isLoadingStream: StateFlow<Boolean> = playbackManager.isLoadingStream
    val errorMessage: StateFlow<String?> = playbackManager.errorMessage

    val initialResumePositionMs: Long
        get() = 0L

    fun initializePlayer(
        slug: String,
        episodeSlug: String,
        serverName: String? = null,
        initialEmbedUrl: String? = null,
        resumePositionMs: Long? = null,
        preferredSourceKey: String? = null
    ) {
        playbackManager.playMovie(
            slug = slug,
            episodeSlug = episodeSlug,
            serverName = serverName,
            initialEmbedUrl = initialEmbedUrl,
            resumePositionMs = resumePositionMs,
            preferredSourceKey = preferredSourceKey
        )
    }

    fun switchStream(source: StreamSource) {
        playbackManager.switchStream(source)
    }

    fun recordProgress(forEpisodeSlug: String, currentMs: Long, durationMs: Long) {
        playbackManager.recordProgress(forEpisodeSlug, currentMs, durationMs)
    }

    fun getNextEpisode(): EpisodeItem? = playbackManager.getNextEpisode()

    fun getPreviousEpisode(): EpisodeItem? = playbackManager.getPreviousEpisode()

    override fun onCleared() {
        super.onCleared()
        val currentSlug = movie.value?.slug
        viewModelScope.launch {
            userSyncRepository.flushWatchProgress(currentSlug)
        }
    }
}
