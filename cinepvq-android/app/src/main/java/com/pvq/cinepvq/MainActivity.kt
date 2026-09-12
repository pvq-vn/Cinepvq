package com.pvq.cinepvq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.pvq.cinepvq.features.navigation.CinepvqBottomNavBar
import com.pvq.cinepvq.features.navigation.Screen
import com.pvq.cinepvq.features.player.PlayerScreen
import com.pvq.cinepvq.features.profile.ProfileScreen
import com.pvq.cinepvq.features.search.SearchScreen
import com.pvq.cinepvq.ui.theme.CinepvqBackground
import com.pvq.cinepvq.ui.theme.CinepvqTheme
import java.net.URLDecoder

import android.os.Build
import android.view.WindowManager

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val startRoute = intent.getStringExtra("route") ?: Screen.Home.route
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enableEdgeToEdge()
        setContent {
            CinepvqTheme {
                CinepvqAppRoot(startRoute = startRoute)
            }
        }
    }
}

@Composable
fun CinepvqAppRoot(startRoute: String = Screen.Home.route) {
    val navController = rememberNavController()

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground),
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentRoute = navBackStackEntry?.destination?.route
            val isBottomBarVisible = currentRoute in listOf(
                Screen.Home.route,
                Screen.Search.route,
                Screen.Favorites.route,
                Screen.History.route,
                Screen.Profile.route
            )
            if (isBottomBarVisible) {
                CinepvqBottomNavBar(navController = navController)
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startRoute,
            modifier = Modifier.padding(bottom = innerPadding.calculateBottomPadding())
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
                        // Example: "the-loai/hanh-dong", we can pass it to Search
                        // For now we just navigate to Search
                        navController.navigate(Screen.Search.route)
                    },
                    onSearchClick = {
                        navController.navigate(Screen.Search.route)
                    },
                    onProfileClick = {
                        navController.navigate(Screen.Profile.route)
                    }
                )
            }

            // Search Tab
            composable(Screen.Search.route) {
                SearchScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    }
                )
            }

            // Favorites Tab
            composable(Screen.Favorites.route) {
                FavoritesScreen(
                    onMovieClick = { slug ->
                        navController.navigate(Screen.Detail.createRoute(slug))
                    },
                    onExploreClick = {
                        navController.navigate(Screen.Home.route)
                    }
                )
            }

            // History Tab
            composable(Screen.History.route) {
                HistoryScreen(
                    onResumeMovie = { slug, episodeSlug ->
                        val ep = episodeSlug ?: "tap-1"
                        navController.navigate(Screen.Player.createRoute(slug, ep))
                    },
                    onExploreClick = {
                        navController.navigate(Screen.Home.route)
                    }
                )
            }

            // Profile Tab
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route)
                    }
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
                    }
                )
            }
        }
    }
}