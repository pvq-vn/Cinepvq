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

import android.content.pm.ActivityInfo
import android.os.Build
import android.view.WindowManager

class MainActivity : ComponentActivity() {
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
    }
}