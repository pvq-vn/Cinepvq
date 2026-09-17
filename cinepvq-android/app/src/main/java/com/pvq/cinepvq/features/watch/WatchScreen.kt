package com.pvq.cinepvq.features.watch

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pvq.cinepvq.core.designsystem.components.ErrorView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.features.detail.DetailViewModel
import com.pvq.cinepvq.features.player.PlayerAudioLanguageBottomSheet
import com.pvq.cinepvq.features.player.PlayerScreen
import com.pvq.cinepvq.features.watch.components.*
import com.pvq.cinepvq.ui.theme.*

@Composable
fun WatchScreen(
    slug: String,
    initialEpisodeSlug: String,
    initialServerName: String? = null,
    initialEmbedUrl: String? = null,
    onBackClick: () -> Unit,
    onNavigateToMovie: (String) -> Unit,
    viewModel: DetailViewModel = viewModel(),
    qaFullscreen: Boolean = false,
    qaControls: Boolean = false,
    qaComments: Boolean = false,
    qaBrightness: Float = -1f,
    qaVolume: Float = -1f,
    qaSeek: Long = -1L
) {
    val context = LocalContext.current
    val activity = context as? ComponentActivity

    // Restore portrait orientation when leaving WatchScreen
    DisposableEffect(Unit) {
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    LaunchedEffect(qaFullscreen) {
        if (qaFullscreen) {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
    }

    LaunchedEffect(slug) {
        viewModel.loadMovie(slug)
    }

    val movie by viewModel.movieDetail.collectAsStateWithLifecycle()
    val isFavorite by viewModel.isFavorite.collectAsStateWithLifecycle()
    val isWatchLater by viewModel.isWatchLater.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val selectedServerIndex by viewModel.selectedServerIndex.collectAsStateWithLifecycle()
    val comments by viewModel.comments.collectAsStateWithLifecycle()
    val isPostingComment by viewModel.isPostingComment.collectAsStateWithLifecycle()
    val similarMovies by viewModel.similarMovies.collectAsStateWithLifecycle()

    var currentEpisodeSlug by remember { mutableStateOf(initialEpisodeSlug) }
    var currentServerName by remember { mutableStateOf(initialServerName) }
    var currentEmbedUrl by remember { mutableStateOf(initialEmbedUrl) }

    // Fullscreen state: strictly controlled by explicit user toggle
    var isFullscreen by remember { mutableStateOf(qaFullscreen) }
    val effectiveFullscreen = isFullscreen

    // Comment States: Portrait Sheet vs Landscape Side Panel
    var showCommentSheet by remember { mutableStateOf(false) }
    var showLandscapeComments by remember { mutableStateOf(qaComments) }

    // Audio Language Bottom Sheet & Sync Warning State
    var showAudioLanguageSheet by remember { mutableStateOf(false) }
    var showSyncWarning by remember { mutableStateOf(false) }

    val servers = movie?.episodes ?: emptyList()
    val currentServer = servers.getOrNull(selectedServerIndex) ?: servers.firstOrNull()
    val allEpisodes = currentServer?.items ?: emptyList()
    val currentEpData = allEpisodes.find { it.slug == currentEpisodeSlug }

    // Language switcher handler (Section I.3 & I.4)
    val handleLanguageSwitch: () -> Unit = {
        if (servers.size == 2) {
            val newIndex = if (selectedServerIndex == 0) 1 else 0
            viewModel.selectServer(newIndex)
            val newServer = servers.getOrNull(newIndex)
            currentServerName = newServer?.serverName
            val targetDigits = currentEpData?.name?.filter { it.isDigit() } ?: ""
            val matchingEp = newServer?.items?.find { it.slug == currentEpisodeSlug }
                ?: if (targetDigits.isNotEmpty()) newServer?.items?.find { it.name.filter { c -> c.isDigit() } == targetDigits } else null
                ?: newServer?.items?.getOrNull(allEpisodes.indexOfFirst { it.slug == currentEpisodeSlug }.coerceAtLeast(0))
                ?: newServer?.items?.firstOrNull()
            if (matchingEp != null) {
                currentEpisodeSlug = matchingEp.slug
                currentEmbedUrl = matchingEp.embed
            }
            showSyncWarning = true
        } else if (servers.size >= 3) {
            showAudioLanguageSheet = true
        }
    }

    // Share Helper
    val onShareMovie = {
        val movieTitle = movie?.name ?: "Cinepvq"
        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, "Xem phim $movieTitle trên Cinepvq")
            type = "text/plain"
        }
        context.startActivity(Intent.createChooser(sendIntent, "Chia sẻ phim"))
    }

    // Back Handler: Close landscape comments -> Exit fullscreen -> Back navigation
    BackHandler {
        if (showLandscapeComments) {
            showLandscapeComments = false
        } else if (effectiveFullscreen) {
            isFullscreen = false
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } else {
            onBackClick()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .then(if (effectiveFullscreen) Modifier else Modifier.statusBarsPadding())
    ) {
        // ── Sticky Player Section at Top ──────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (effectiveFullscreen) Modifier.fillMaxSize() else Modifier.aspectRatio(16f / 9f))
                .background(Color.Black)
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .weight(if (effectiveFullscreen && showLandscapeComments) 0.65f else 1f)
                        .fillMaxHeight()
                ) {
                    PlayerScreen(
                        slug = slug,
                        episodeSlug = currentEpisodeSlug,
                        serverName = currentServerName,
                        embedUrl = currentEmbedUrl,
                        isFullscreen = effectiveFullscreen,
                        onFullscreenToggle = { fullscreen ->
                            isFullscreen = fullscreen
                            if (!fullscreen) showLandscapeComments = false
                            activity?.requestedOrientation = if (fullscreen) {
                                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                            } else {
                                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                            }
                        },
                        onBackClick = {
                            if (effectiveFullscreen) {
                                if (showLandscapeComments) {
                                    showLandscapeComments = false
                                } else {
                                    isFullscreen = false
                                    activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                                }
                            } else {
                                onBackClick()
                            }
                        },
                        onSwitchEpisode = { _, epSlug ->
                            currentEpisodeSlug = epSlug
                            val newEp = allEpisodes.find { it.slug == epSlug }
                            if (newEp != null) {
                                currentEmbedUrl = newEp.embed
                            }
                        },
                        isFavorite = isFavorite,
                        onToggleFavorite = { viewModel.toggleFavorite() },
                        isWatchLater = isWatchLater,
                        onToggleWatchLater = { viewModel.toggleWatchLater() },
                        onOpenComments = {
                            if (effectiveFullscreen) {
                                showLandscapeComments = !showLandscapeComments
                            } else {
                                showCommentSheet = true
                            }
                        },
                        onShareClick = onShareMovie,
                        servers = servers,
                        selectedServerIndex = selectedServerIndex,
                        onOpenAudioLanguage = handleLanguageSwitch,
                        showSyncWarning = showSyncWarning,
                        onDismissSyncWarning = { showSyncWarning = false },
                        allEpisodes = allEpisodes,
                        qaControls = qaControls,
                        qaBrightness = qaBrightness,
                        qaVolume = qaVolume,
                        qaSeek = qaSeek
                    )
                }

                if (effectiveFullscreen && showLandscapeComments) {
                    LandscapeCommentsPanel(
                        comments = comments,
                        isPostingComment = isPostingComment,
                        onPostComment = { content -> viewModel.postComment(slug, content) },
                        onClose = { showLandscapeComments = false },
                        modifier = Modifier
                            .weight(0.35f)
                            .fillMaxHeight()
                    )
                }
            }
        }

        // ── Content Below Player (Only in Portrait) ───────────────────────
        if (!effectiveFullscreen) {
            Box(modifier = Modifier.weight(1f)) {
                when {
                    isLoading && movie == null -> LoadingView()
                    errorMessage != null && movie == null -> ErrorView(
                        message = errorMessage ?: "Không thể tải thông tin phim",
                        onRetry = { viewModel.loadMovie(slug) }
                    )
                    movie != null -> {
                        val detail = movie!!

                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 40.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // 1. Movie Header & Expandable Information (Instant expand/collapse)
                            item {
                                MovieHeader(
                                    movie = detail,
                                    currentEpisodeName = currentEpData?.name ?: ""
                                )
                            }

                            // 2. Action Bar (Favorite, Watch Later, Share)
                            item {
                                MovieActionBar(
                                    isFavorite = isFavorite,
                                    onToggleFavorite = { viewModel.toggleFavorite() },
                                    isWatchLater = isWatchLater,
                                    onToggleWatchLater = { viewModel.toggleWatchLater() },
                                    onShareClick = onShareMovie
                                )
                            }

                            // 3. Comments Preview Card
                            item {
                                CommentPreviewCard(
                                    comments = comments,
                                    onClick = { showCommentSheet = true }
                                )
                            }

                            // 4. Horizontal Episode List with Pagination Navigator (< 01 02 ... 10 >)
                            if (allEpisodes.isNotEmpty()) {
                                item {
                                    EpisodeHorizontalList(
                                        servers = detail.episodes,
                                        selectedServerIndex = selectedServerIndex,
                                        onSelectServer = { idx ->
                                            if (idx != selectedServerIndex) {
                                                viewModel.selectServer(idx)
                                                val newServer = detail.episodes.getOrNull(idx)
                                                currentServerName = newServer?.serverName
                                                val targetDigits = currentEpData?.name?.filter { it.isDigit() } ?: ""
                                                val matchingEp = newServer?.items?.find { it.slug == currentEpisodeSlug }
                                                    ?: if (targetDigits.isNotEmpty()) newServer?.items?.find { it.name.filter { c -> c.isDigit() } == targetDigits } else null
                                                    ?: newServer?.items?.getOrNull(allEpisodes.indexOfFirst { it.slug == currentEpisodeSlug }.coerceAtLeast(0))
                                                    ?: newServer?.items?.firstOrNull()
                                                if (matchingEp != null) {
                                                    currentEpisodeSlug = matchingEp.slug
                                                    currentEmbedUrl = matchingEp.embed
                                                }
                                                showSyncWarning = true
                                            }
                                        },
                                        allEpisodes = allEpisodes,
                                        currentEpisodeSlug = currentEpisodeSlug,
                                        onSelectEpisode = { ep ->
                                            currentServerName = currentServer?.serverName
                                            currentEmbedUrl = ep.embed
                                            currentEpisodeSlug = ep.slug
                                        }
                                    )
                                }
                            }

                            // 5. Recommended Movies Section
                            if (similarMovies.isNotEmpty()) {
                                item {
                                    RecommendedMoviesSection(
                                        movies = similarMovies,
                                        onMovieClick = onNavigateToMovie
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Interactive Comment Modal Bottom Sheet (in Portrait) ───────────────
    if (showCommentSheet && !effectiveFullscreen) {
        CommentBottomSheet(
            comments = comments,
            isPostingComment = isPostingComment,
            onPostComment = { content ->
                viewModel.postComment(slug, content)
            },
            onDismiss = { showCommentSheet = false }
        )
    }

    // ── Audio / Language Server Bottom Sheet (When >= 3 servers) ───────────
    if (showAudioLanguageSheet) {
        PlayerAudioLanguageBottomSheet(
            servers = servers,
            selectedServerIndex = selectedServerIndex,
            onSelectServer = { idx ->
                if (idx != selectedServerIndex) {
                    val newServer = servers.getOrNull(idx)
                    currentServerName = newServer?.serverName
                    viewModel.selectServer(idx)
                    val targetDigits = currentEpData?.name?.filter { it.isDigit() } ?: ""
                    val matchingEp = newServer?.items?.find { it.slug == currentEpisodeSlug }
                        ?: if (targetDigits.isNotEmpty()) newServer?.items?.find { it.name.filter { c -> c.isDigit() } == targetDigits } else null
                        ?: newServer?.items?.getOrNull(allEpisodes.indexOfFirst { it.slug == currentEpisodeSlug }.coerceAtLeast(0))
                        ?: newServer?.items?.firstOrNull()
                    if (matchingEp != null) {
                        currentEpisodeSlug = matchingEp.slug
                        currentEmbedUrl = matchingEp.embed
                    }
                    showSyncWarning = true
                }
                showAudioLanguageSheet = false
            },
            onDismiss = { showAudioLanguageSheet = false }
        )
    }
}
