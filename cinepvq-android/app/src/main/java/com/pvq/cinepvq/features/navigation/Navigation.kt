package com.pvq.cinepvq.features.navigation

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.pvq.cinepvq.ui.theme.*

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Search : Screen("search")
    object Favorites : Screen("favorites")
    object History : Screen("history")
    object Profile : Screen("profile")
    object Auth : Screen("auth")
    object Detail : Screen("detail/{slug}") {
        fun createRoute(slug: String) = "detail/$slug"
    }
    object Player : Screen("player/{slug}/{episodeSlug}?serverName={serverName}&embedUrl={embedUrl}") {
        fun createRoute(slug: String, episodeSlug: String, serverName: String? = null, embedUrl: String? = null): String {
            val encodedServer = java.net.URLEncoder.encode(serverName ?: "", "UTF-8")
            val encodedEmbed = java.net.URLEncoder.encode(embedUrl ?: "", "UTF-8")
            return "player/$slug/$episodeSlug?serverName=$encodedServer&embedUrl=$encodedEmbed"
        }
    }
}

data class BottomNavItem(
    val title: String,
    val route: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem("Khám phá", Screen.Home.route, Icons.Filled.Home, Icons.Outlined.Home),
    BottomNavItem("Tìm kiếm", Screen.Search.route, Icons.Filled.Search, Icons.Outlined.Search),
    BottomNavItem("Yêu thích", Screen.Favorites.route, Icons.Filled.Favorite, Icons.Outlined.FavoriteBorder),
    BottomNavItem("Lịch sử", Screen.History.route, Icons.Filled.History, Icons.Outlined.History),
    BottomNavItem("Cá nhân", Screen.Profile.route, Icons.Filled.Person, Icons.Outlined.Person)
)

/**
 * Robust navigation for top-level tabs.
 * - Navigating to Home uses popBackStack to return directly to the persistent Home screen
 *   without duplicating destinations or re-entering old restored screens.
 * - Navigating to other tabs saves and restores their respective state cleanly.
 */
fun NavController.navigateToTab(targetRoute: String) {
    val currentRoute = currentBackStackEntry?.destination?.route
    if (currentRoute == targetRoute) return

    if (targetRoute == Screen.Home.route) {
        val popped = popBackStack(Screen.Home.route, inclusive = false)
        if (!popped) {
            navigate(Screen.Home.route) {
                popUpTo(graph.findStartDestination().id) {
                    inclusive = false
                }
                launchSingleTop = true
            }
        }
    } else {
        navigate(targetRoute) {
            popUpTo(graph.findStartDestination().id) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }
}

@Composable
fun CinepvqBottomNavBar(
    navController: NavController,
    modifier: Modifier = Modifier,
    isVisible: Boolean = true
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Only show on primary bottom nav screens
    val visibleRoutes = bottomNavItems.map { it.route }
    if (currentRoute !in visibleRoutes) return

    val density = LocalDensity.current
    val navBarBottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val barContentHeight = 56.dp
    val barTotalHeight = barContentHeight + navBarBottomInset

    // Smooth auto-hide animations
    val animatedOffsetY by animateDpAsState(
        targetValue = if (isVisible) 0.dp else barTotalHeight + 40.dp,
        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing),
        label = "bottomBarTranslationY"
    )
    val animatedAlpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing),
        label = "bottomBarAlpha"
    )

    Surface(
        modifier = modifier
            .graphicsLayer {
                translationY = with(density) { animatedOffsetY.toPx() }
                alpha = animatedAlpha
            }
            .fillMaxWidth()
            .height(barTotalHeight)
            .border(width = 0.8.dp, color = CinepvqBorderSubtle),
        color = CinepvqSurface.copy(alpha = 0.98f),
        contentColor = CinepvqTextSecondary,
        tonalElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barContentHeight)
                .padding(bottom = 0.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            bottomNavItems.forEach { item ->
                val selected = currentRoute == item.route
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable(
                            enabled = isVisible,
                            interactionSource = remember { MutableInteractionSource() },
                            indication = ripple(bounded = false, radius = 24.dp),
                            onClick = {
                                navController.navigateToTab(item.route)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                        contentDescription = item.title,
                        modifier = Modifier.size(24.dp),
                        tint = if (selected) CinepvqPrimaryLight else CinepvqTextMuted
                    )
                }
            }
        }
    }
}

