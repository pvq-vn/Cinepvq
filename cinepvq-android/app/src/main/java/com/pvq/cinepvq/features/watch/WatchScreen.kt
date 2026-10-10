package com.pvq.cinepvq.features.watch

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import com.pvq.cinepvq.core.designsystem.components.ErrorView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.detail.DetailViewModel
import com.pvq.cinepvq.features.player.PlayerAudioLanguageBottomSheet
import com.pvq.cinepvq.features.player.PlayerScreen
import com.pvq.cinepvq.features.player.PlayerSourceBottomSheet
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

    val playbackManager = remember { com.pvq.cinepvq.CinepvqApp.instance.playbackManager }
    val initialIsFullscreen = qaFullscreen ||
        playbackManager.presentationState.value == com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_LANDSCAPE

    // Fullscreen state: strictly controlled by explicit user toggle & landscape orientation
    var isFullscreen by remember { mutableStateOf(initialIsFullscreen) }

    // Restore portrait orientation when leaving WatchScreen
    DisposableEffect(Unit) {
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
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

    val activeStream by playbackManager.activeStream.collectAsStateWithLifecycle()
    val watchedEpisodes by playbackManager.watchedEpisodes.collectAsStateWithLifecycle()
    val isEmbedStream = activeStream?.type == StreamType.EMBED
    var showSourcePickerSheet by remember { mutableStateOf(false) }
    var isCocCocFullscreen by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val viewConfig = LocalViewConfiguration.current

    val isLandscape = configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
    val effectiveFullscreen = isFullscreen && isLandscape
    var wasLandscape by remember { mutableStateOf(isLandscape) }

    LaunchedEffect(isLandscape) {
        if (wasLandscape && !isLandscape) {
            isFullscreen = false
            isCocCocFullscreen = false
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            playbackManager.setPresentation(com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_PORTRAIT)
        }
        wasLandscape = isLandscape
    }

    LaunchedEffect(isFullscreen) {
        if (isFullscreen) {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
    }

    val screenWidthPx = with(density) { configuration.screenWidthDp.dp.toPx() }
    val screenHeightPx = with(density) { configuration.screenHeightDp.dp.toPx() }
    val miniWidthPx = with(density) { 210.dp.toPx() }
    val miniHeightPx = with(density) { 118.dp.toPx() }
    val targetDistanceY = screenHeightPx - miniHeightPx - with(density) { 90.dp.toPx() }
    val targetDistanceX = screenWidthPx - miniWidthPx - with(density) { 16.dp.toPx() }

    val animOffsetY = remember { Animatable(0f) }

    LaunchedEffect(effectiveFullscreen) {
        animOffsetY.snapTo(0f)
        val currentPres = playbackManager.presentationState.value
        if (currentPres != com.pvq.cinepvq.data.player.PlayerPresentationState.MINI_IN_APP &&
            currentPres != com.pvq.cinepvq.data.player.PlayerPresentationState.SYSTEM_PIP
        ) {
            if (effectiveFullscreen) {
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                playbackManager.setPresentation(com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_LANDSCAPE)
            } else {
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                playbackManager.setPresentation(com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_PORTRAIT)
            }
        }
    }
    val fraction = if (!effectiveFullscreen) (animOffsetY.value / targetDistanceY).coerceIn(0f, 1f) else 0f
    val backgroundAlpha = if (!effectiveFullscreen) (1f - fraction * 1.5f).coerceIn(0f, 1f) else 1f
    val contentAlpha = if (!effectiveFullscreen) (1f - fraction * 3.0f).coerceIn(0f, 1f) else 1f

    val currentScale = if (!effectiveFullscreen) lerp(1f, miniWidthPx / screenWidthPx, fraction) else 1f
    val currentTransX = if (!effectiveFullscreen) lerp(0f, targetDistanceX, fraction) else 0f
    val currentTransY = if (!effectiveFullscreen) animOffsetY.value else 0f
    val currentCornerRadius = if (!effectiveFullscreen) lerp(0f, with(density) { 12.dp.toPx() }, fraction) else 0f

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

    val handleMinimize: () -> Unit = {
        coroutineScope.launch {
            if (!effectiveFullscreen && animOffsetY.value < targetDistanceY) {
                animOffsetY.animateTo(
                    targetValue = targetDistanceY,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioLowBouncy,
                        stiffness = Spring.StiffnessMediumLow
                    )
                )
            }
            playbackManager.minimize()
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            onBackClick()
        }
    }

    // Back Handler: Close landscape comments -> Exit fullscreen -> Minimize to In-App Mini Player
    BackHandler {
        if (showLandscapeComments) {
            showLandscapeComments = false
        } else if (effectiveFullscreen) {
            isCocCocFullscreen = false
            isFullscreen = false
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } else {
            handleMinimize()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground.copy(alpha = backgroundAlpha))
            .then(if (effectiveFullscreen) Modifier else Modifier.statusBarsPadding())
    ) {
        // ── Sticky Player Section at Top ──────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (effectiveFullscreen) Modifier.fillMaxSize() else Modifier.aspectRatio(16f / 9f))
                .graphicsLayer {
                    if (!effectiveFullscreen) {
                        scaleX = currentScale
                        scaleY = currentScale
                        transformOrigin = TransformOrigin(0f, 0f)
                        translationX = currentTransX
                        translationY = currentTransY
                        clip = fraction > 0f
                        shape = RoundedCornerShape(currentCornerRadius.toDp())
                        shadowElevation = if (fraction > 0f) 12.dp.toPx() else 0f
                    } else {
                        scaleX = 1f
                        scaleY = 1f
                        transformOrigin = TransformOrigin(0.5f, 0.5f)
                        translationX = 0f
                        translationY = 0f
                        clip = false
                        shadowElevation = 0f
                    }
                }
                .then(
                    if (!effectiveFullscreen) {
                        Modifier.pointerInput(Unit) {
                            awaitEachGesture {
                                val down = awaitFirstDown(requireUnconsumed = false)
                                val startY = down.position.y
                                var totalY = 0f
                                var totalX = 0f
                                var isDownDrag = false
                                val touchSlop = viewConfig.touchSlop
                                val isTopArea = startY < with(density) { 56.dp.toPx() }
                                val requiredSlopY = if (isTopArea) touchSlop * 1.5f else with(density) { 48.dp.toPx() }

                                while (true) {
                                    val event = awaitPointerEvent()
                                    val change = event.changes.firstOrNull { it.id == down.id } ?: break

                                    if (change.changedToUpIgnoreConsumed()) {
                                        if (isDownDrag) {
                                            coroutineScope.launch {
                                                val currentF = (animOffsetY.value / targetDistanceY).coerceIn(0f, 1f)
                                                if (currentF >= 0.35f) {
                                                    animOffsetY.animateTo(
                                                        targetValue = targetDistanceY,
                                                        animationSpec = spring(
                                                            dampingRatio = Spring.DampingRatioLowBouncy,
                                                            stiffness = Spring.StiffnessMediumLow
                                                        )
                                                    )
                                                    handleMinimize()
                                                } else {
                                                    animOffsetY.animateTo(
                                                        targetValue = 0f,
                                                        animationSpec = spring(
                                                            dampingRatio = Spring.DampingRatioLowBouncy,
                                                            stiffness = Spring.StiffnessMediumLow
                                                        )
                                                    )
                                                }
                                            }
                                        }
                                        break
                                    }

                                    val dy = change.position.y - change.previousPosition.y
                                    val dx = change.position.x - change.previousPosition.x
                                    totalY += dy
                                    totalX += dx

                                    if (!isDownDrag) {
                                        if (totalY > requiredSlopY && totalY > kotlin.math.abs(totalX) * 1.8f) {
                                            isDownDrag = true
                                        } else if (kotlin.math.abs(totalX) > touchSlop * 1.5f || totalY < -touchSlop) {
                                            break
                                        }
                                    }

                                    if (isDownDrag) {
                                        change.consume()
                                        coroutineScope.launch {
                                            animOffsetY.snapTo((animOffsetY.value + dy).coerceIn(0f, targetDistanceY))
                                        }
                                    }
                                }
                            }
                        }
                    } else Modifier
                )
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
                        isCocCocNativeFullscreen = isCocCocFullscreen && effectiveFullscreen,
                        onFullscreenToggle = { fullscreen ->
                            coroutineScope.launch {
                                animOffsetY.snapTo(0f)
                            }
                            isFullscreen = fullscreen
                            if (!fullscreen) {
                                showLandscapeComments = false
                                isCocCocFullscreen = false
                            }
                            activity?.requestedOrientation = if (fullscreen) {
                                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                            } else {
                                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                            }
                        },
                        onMinimize = handleMinimize,
                        onBackClick = {
                            if (effectiveFullscreen) {
                                if (showLandscapeComments) {
                                    showLandscapeComments = false
                                } else {
                                    isCocCocFullscreen = false
                                    isFullscreen = false
                                    activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                                }
                            } else {
                                handleMinimize()
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
            Box(
                modifier = Modifier
                    .weight(1f)
                    .alpha(contentAlpha)
            ) {
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
                                        watchedEpisodes = watchedEpisodes,
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
                                        onMovieClick = { movieSlug ->
                                            val isPlaying = playbackManager.isActivelyPlaying
                                            if (isPlaying) {
                                                handleMinimize()
                                                onNavigateToMovie(movieSlug)
                                            } else {
                                                playbackManager.closePlayback()
                                                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                                                onNavigateToMovie(movieSlug)
                                            }
                                        }
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

    // ── Video Source Picker Bottom Sheet ──────────────────────────────────
    if (showSourcePickerSheet) {
        val availableSources by playbackManager.availableSources.collectAsStateWithLifecycle()
        PlayerSourceBottomSheet(
            sources = availableSources,
            activeSource = activeStream,
            onSelectSource = { src ->
                val isVsmovCurrent = activeStream?.sourceId?.contains("vsmov", ignoreCase = true) == true ||
                                     activeStream?.name?.contains("vsmov", ignoreCase = true) == true ||
                                     activeStream?.url?.contains("vsmov", ignoreCase = true) == true
                if (isVsmovCurrent && effectiveFullscreen) {
                    isFullscreen = false
                    activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                }
                playbackManager.switchStream(src)
                showSourcePickerSheet = false
            },
            onDismiss = { showSourcePickerSheet = false }
        )
    }
}
