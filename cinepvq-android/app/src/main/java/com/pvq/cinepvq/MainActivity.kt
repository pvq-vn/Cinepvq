package com.pvq.cinepvq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.pvq.cinepvq.features.auth.AuthScreen
import com.pvq.cinepvq.features.detail.MovieDetailScreen
import com.pvq.cinepvq.features.favorites.FavoritesScreen
import com.pvq.cinepvq.features.history.HistoryScreen
import com.pvq.cinepvq.features.home.HomeScreen
import com.pvq.cinepvq.features.library.LibraryScreen
import com.pvq.cinepvq.features.navigation.CinepvqBottomNavBar
import com.pvq.cinepvq.features.navigation.Screen
import com.pvq.cinepvq.features.navigation.navigateToTab
import com.pvq.cinepvq.features.player.PlayerScreen
import com.pvq.cinepvq.features.profile.ProfileScreen
import com.pvq.cinepvq.features.search.SearchScreen
import com.pvq.cinepvq.features.section.SectionDetailScreen
import com.pvq.cinepvq.features.settings.SettingsScreen
import com.pvq.cinepvq.features.trending.TrendingScreen
import com.pvq.cinepvq.ui.theme.CinepvqBackground
import com.pvq.cinepvq.ui.theme.CinepvqTheme
import java.net.URLDecoder

import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Rational
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.media3.ui.PlayerView
import com.pvq.cinepvq.data.player.PlayerPresentationState
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.player.InAppMiniPlayer
import com.pvq.cinepvq.features.player.embed.EmbedPlayerView
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    companion object {
        const val ACTION_PIP_PREV = "com.pvq.cinepvq.PIP_ACTION_PREV"
        const val ACTION_PIP_PLAY_PAUSE = "com.pvq.cinepvq.PIP_ACTION_PLAY_PAUSE"
        const val ACTION_PIP_NEXT = "com.pvq.cinepvq.PIP_ACTION_NEXT"
        const val ACTION_PIP_CLOSE = "com.pvq.cinepvq.PIP_ACTION_CLOSE"
    }

    private val pipReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val pm = CinepvqApp.instance.playbackManager
            when (intent?.action) {
                ACTION_PIP_PREV -> pm.playPrevious()
                ACTION_PIP_PLAY_PAUSE -> pm.togglePlayPause()
                ACTION_PIP_NEXT -> pm.playNext()
                ACTION_PIP_CLOSE -> pm.closePlayback()
            }
            updatePipParams()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        val startRoute = intent.getStringExtra("route") ?: Screen.Home.route
        val qaFullscreen = intent.getBooleanExtra("qa_fullscreen", false)
        val qaControls = intent.getBooleanExtra("qa_controls", false)
        val qaComments = intent.getBooleanExtra("qa_comments", false)
        val qaBrightness = intent.getFloatExtra("qa_brightness", -1f)
        val qaVolume = intent.getFloatExtra("qa_volume", -1f)
        val qaSeek = intent.getLongExtra("qa_seek", -1L)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Register PiP action broadcast receiver
        val filter = IntentFilter().apply {
            addAction(ACTION_PIP_PREV)
            addAction(ACTION_PIP_PLAY_PAUSE)
            addAction(ACTION_PIP_NEXT)
            addAction(ACTION_PIP_CLOSE)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(pipReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(pipReceiver, filter)
        }

        // Dynamically monitor playback states to update PiP parameters & auto-enter eligibility
        lifecycleScope.launch {
            val pm = CinepvqApp.instance.playbackManager
            launch {
                pm.isPlaying.collect {
                    updatePipParams()
                }
            }
            launch {
                pm.currentEpisode.collect {
                    updatePipParams()
                }
            }
            launch {
                pm.presentationState.collect {
                    updatePipParams()
                }
            }
        }

        enableEdgeToEdge()
        setContent {
            CinepvqTheme {
                CinepvqAppRoot(
                    startRoute = startRoute,
                    qaFullscreen = qaFullscreen,
                    qaControls = qaControls,
                    qaComments = qaComments,
                    qaBrightness = qaBrightness,
                    qaVolume = qaVolume,
                    qaSeek = qaSeek
                )
            }
        }
    }

    fun updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pm = CinepvqApp.instance.playbackManager
            val isPlaying = pm.isPlaying.value
            val hasPrev = pm.getPreviousEpisode() != null
            val hasNext = pm.getNextEpisode() != null
            val shouldEnter = pm.shouldEnterPip()

            val actions = mutableListOf<RemoteAction>()

            // 1. Previous Episode
            val prevIntent = PendingIntent.getBroadcast(
                this,
                101,
                Intent(ACTION_PIP_PREV).setPackage(packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val prevAction = RemoteAction(
                Icon.createWithResource(this, android.R.drawable.ic_media_previous),
                "Tập trước",
                "Tập trước",
                prevIntent
            ).apply { isEnabled = hasPrev }
            actions.add(prevAction)

            // 2. Play / Pause
            val playPauseIntent = PendingIntent.getBroadcast(
                this,
                102,
                Intent(ACTION_PIP_PLAY_PAUSE).setPackage(packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
            val playPauseTitle = if (isPlaying) "Tạm dừng" else "Phát"
            val playPauseAction = RemoteAction(
                Icon.createWithResource(this, playPauseIcon),
                playPauseTitle,
                playPauseTitle,
                playPauseIntent
            ).apply { isEnabled = true }
            actions.add(playPauseAction)

            // 3. Next Episode
            val nextIntent = PendingIntent.getBroadcast(
                this,
                103,
                Intent(ACTION_PIP_NEXT).setPackage(packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val nextAction = RemoteAction(
                Icon.createWithResource(this, android.R.drawable.ic_media_next),
                "Tập tiếp theo",
                "Tập tiếp theo",
                nextIntent
            ).apply { isEnabled = hasNext }
            actions.add(nextAction)

            val builder = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .setActions(actions)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(shouldEnter)
            }

            try {
                setPictureInPictureParams(builder.build())
            } catch (_: Exception) {}
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pm = CinepvqApp.instance.playbackManager
            if (pm.shouldEnterPip()) {
                updatePipParams()
                val builder = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                try {
                    enterPictureInPictureMode(builder.build())
                } catch (_: Exception) {}
            }
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        val pm = CinepvqApp.instance.playbackManager
        if (isInPictureInPictureMode) {
            pm.onPipModeChanged(true)
        } else {
            val restoredState = pm.expand()
            requestedOrientation = if (restoredState == PlayerPresentationState.FULL_LANDSCAPE) {
                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            } else {
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(pipReceiver)
        } catch (_: Exception) {}
    }
}

@Composable
fun CinepvqAppRoot(
    startRoute: String = Screen.Home.route,
    qaFullscreen: Boolean = false,
    qaControls: Boolean = false,
    qaComments: Boolean = false,
    qaBrightness: Float = -1f,
    qaVolume: Float = -1f,
    qaSeek: Long = -1L
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val playbackManager = remember { CinepvqApp.instance.playbackManager }
    val presentationState by playbackManager.presentationState.collectAsStateWithLifecycle()
    val activeStream by playbackManager.activeStream.collectAsStateWithLifecycle()

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val isBottomBarRoute = currentRoute in listOf(
        Screen.Home.route,
        Screen.Trending.route,
        Screen.Search.route,
        Screen.Library.route,
        Screen.Profile.route,
        Screen.Favorites.route,
        Screen.History.route,
        Screen.SectionDetail.route
    )

    var isBarsVisible by remember { mutableStateOf(true) }

    // When navigating between destinations, reset bars to visible
    LaunchedEffect(currentRoute) {
        isBarsVisible = true
    }

    if (presentationState == PlayerPresentationState.SYSTEM_PIP) {
        // Pure Video Surface inside System PiP Window
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            if (activeStream?.type == StreamType.EMBED) {
                EmbedPlayerView(
                    url = activeStream?.url ?: "",
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = playbackManager.exoPlayer
                            useController = false
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    } else {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(CinepvqBackground)
        ) {
        NavHost(
            navController = navController,
            startDestination = startRoute,
            modifier = Modifier.fillMaxSize()
        ) {
            // Home Tab
            composable(Screen.Home.route) {
                HomeScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onContinueWatchingClick = { slug, episodeSlug ->
                        val ep = episodeSlug ?: "tap-1"
                        navController.navigate(Screen.Player.createRoute(slug, ep))
                    },
                    onCategoryClick = { categorySlug ->
                        if (categorySlug == "thinh-hanh") {
                            navController.navigateToTab(Screen.Trending.route)
                        } else {
                            val title = when {
                                categorySlug == "phim-bo" -> "Phim bộ"
                                categorySlug == "phim-le" -> "Phim lẻ"
                                categorySlug == "hoat-hinh" -> "Hoạt hình"
                                categorySlug == "tv-shows" -> "TV Shows"
                                categorySlug == "phim-moi" -> "Phim mới cập nhật"
                                categorySlug == "the-loai/hanh-dong" -> "Phim Hành Động"
                                categorySlug == "quoc-gia/au-my" -> "Phim Âu Mỹ"
                                categorySlug == "quoc-gia/han-quoc" -> "Phim Hàn Quốc"
                                categorySlug.startsWith("the-loai/") -> {
                                    categorySlug.removePrefix("the-loai/").replace("-", " ").replaceFirstChar { it.uppercase() }
                                }
                                categorySlug.startsWith("quoc-gia/") -> {
                                    categorySlug.removePrefix("quoc-gia/").replace("-", " ").replaceFirstChar { it.uppercase() }
                                }
                                else -> categorySlug.replace("-", " ").replaceFirstChar { it.uppercase() }
                            }
                            navController.navigate(Screen.SectionDetail.createRoute(categorySlug, title))
                        }
                    },
                    onSearchClick = {
                        navController.navigateToTab(Screen.Search.route)
                    },
                    onProfileClick = {
                        navController.navigateToTab(Screen.Profile.route)
                    },
                    onHistoryClick = {
                        navController.navigateToTab(Screen.Library.route)
                    },
                    isTopBarVisible = isBarsVisible,
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Trending Tab
            composable(Screen.Trending.route) {
                TrendingScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Search Tab
            composable(Screen.Search.route) {
                SearchScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Library Tab
            composable(Screen.Library.route) {
                LibraryScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onResumeMovie = { slug, episodeSlug ->
                        val ep = episodeSlug ?: "tap-1"
                        navController.navigate(Screen.Player.createRoute(slug, ep))
                    },
                    onExploreClick = {
                        navController.navigateToTab(Screen.Home.route)
                    },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Section Detail Screen
            composable(
                route = Screen.SectionDetail.route,
                arguments = listOf(
                    navArgument("type") { type = NavType.StringType },
                    navArgument("title") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    }
                )
            ) { backStackEntry ->
                val rawType = backStackEntry.arguments?.getString("type") ?: ""
                val type = if (rawType.isNotBlank()) {
                    try { URLDecoder.decode(rawType, "UTF-8") } catch (_: Exception) { rawType }
                } else rawType
                val rawTitle = backStackEntry.arguments?.getString("title")
                val title = if (!rawTitle.isNullOrBlank()) {
                    try { URLDecoder.decode(rawTitle, "UTF-8") } catch (_: Exception) { rawTitle }
                } else type
                SectionDetailScreen(
                    type = type,
                    title = title,
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onBackClick = { navController.popBackStack() },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Settings Screen
            composable(Screen.Settings.route) {
                SettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Favorites Tab (Direct route preserved)
            composable(Screen.Favorites.route) {
                FavoritesScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onExploreClick = {
                        navController.navigateToTab(Screen.Home.route)
                    },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // History Tab (Direct route preserved)
            composable(Screen.History.route) {
                HistoryScreen(
                    onResumeMovie = { slug, episodeSlug ->
                        val ep = episodeSlug ?: "tap-1"
                        navController.navigate(Screen.Player.createRoute(slug, ep))
                    },
                    onExploreClick = {
                        navController.navigateToTab(Screen.Home.route)
                    },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Profile Tab
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route)
                    },
                    onNavigateToSettings = {
                        navController.navigate(Screen.Settings.route)
                    },
                    onBarsVisibilityChanged = { isBarsVisible = it }
                )
            }

            // Auth Screen
            composable(Screen.Auth.route) {
                AuthScreen(
                    onBackClick = { navController.popBackStack() },
                    onAuthSuccess = { navController.popBackStack() }
                )
            }

            // Movie Detail Screen
            composable(
                route = Screen.Detail.route,
                arguments = listOf(navArgument("slug") { type = NavType.StringType })
            ) { backStackEntry ->
                val slug = backStackEntry.arguments?.getString("slug") ?: ""
                MovieDetailScreen(
                    slug = slug,
                    onBackClick = { navController.popBackStack() },
                    onPlayClick = { movieSlug, episodeSlug ->
                        navController.navigate(Screen.Player.createRoute(movieSlug, episodeSlug))
                    },
                    onNavigateToMovie = { newSlug ->
                        navController.navigate(Screen.Detail.createRoute(newSlug))
                    }
                )
            }

            // Video Player Screen
            composable(
                route = Screen.Player.route,
                arguments = listOf(
                    navArgument("slug") { type = NavType.StringType },
                    navArgument("episodeSlug") { type = NavType.StringType },
                    navArgument("serverName") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("embedUrl") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    }
                )
            ) { backStackEntry ->
                val slug = backStackEntry.arguments?.getString("slug") ?: ""
                val episodeSlug = backStackEntry.arguments?.getString("episodeSlug") ?: ""
                val rawServer = backStackEntry.arguments?.getString("serverName")
                val rawEmbed = backStackEntry.arguments?.getString("embedUrl")

                val serverName = if (!rawServer.isNullOrBlank()) {
                    try { URLDecoder.decode(rawServer, "UTF-8") } catch (_: Exception) { rawServer }
                } else null

                val embedUrl = if (!rawEmbed.isNullOrBlank()) {
                    try { URLDecoder.decode(rawEmbed, "UTF-8") } catch (_: Exception) { rawEmbed }
                } else null

                com.pvq.cinepvq.features.watch.WatchScreen(
                    slug = slug,
                    initialEpisodeSlug = episodeSlug,
                    initialServerName = serverName,
                    initialEmbedUrl = embedUrl,
                    onBackClick = { navController.popBackStack() },
                    onNavigateToMovie = { newSlug ->
                        navController.navigate(Screen.Detail.createRoute(newSlug)) {
                            popUpTo(Screen.Detail.route) { inclusive = false }
                        }
                    },
                    qaFullscreen = qaFullscreen,
                    qaControls = qaControls,
                    qaComments = qaComments,
                    qaBrightness = qaBrightness,
                    qaVolume = qaVolume,
                    qaSeek = qaSeek
                )
            }
        }

        if (isBottomBarRoute) {
            CinepvqBottomNavBar(
                navController = navController,
                isVisible = isBarsVisible,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        // ── Floating In-App Mini Player Overlay (Root Level) ─────────────────
        if (presentationState == PlayerPresentationState.MINI_IN_APP) {
            InAppMiniPlayer(
                playbackManager = playbackManager,
                onExpand = {
                    val restoredState = playbackManager.expand()
                    val targetOrientation = if (restoredState == PlayerPresentationState.FULL_LANDSCAPE) {
                        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
                    (context as? ComponentActivity)?.requestedOrientation = targetOrientation
                    navController.navigate(
                        Screen.Player.createRoute(
                            slug = playbackManager.currentSlug,
                            episodeSlug = playbackManager.currentEpisodeSlug,
                            serverName = playbackManager.currentServerName,
                            embedUrl = playbackManager.currentEmbedUrl
                        )
                    )
                },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(
                        end = 16.dp,
                        bottom = if (isBottomBarRoute && isBarsVisible) 80.dp else 24.dp
                    )
            )
        }
    }
}
}