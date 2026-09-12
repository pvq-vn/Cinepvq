package com.pvq.cinepvq.features.navigation

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
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

@Composable
fun CinepvqBottomNavBar(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Only show on primary bottom nav screens
    val visibleRoutes = bottomNavItems.map { it.route }
    if (currentRoute !in visibleRoutes) return

    NavigationBar(
        modifier = modifier,
        containerColor = CinepvqSurface,
        contentColor = CinepvqTextSecondary,
        tonalElevation = 8.dp
    ) {
        bottomNavItems.forEach { item ->
            val selected = currentRoute == item.route
            NavigationBarItem(
                icon = {
                    Icon(
                        imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                        contentDescription = item.title,
                        modifier = Modifier.size(22.dp)
                    )
                },
                label = {
                    Text(
                        text = item.title,
                        fontSize = 11.sp
                    )
                },
                selected = selected,
                onClick = {
                    if (currentRoute != item.route) {
                        navController.navigate(item.route) {
                            popUpTo(Screen.Home.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = CinepvqPrimary,
                    selectedTextColor = CinepvqPrimary,
                    unselectedIconColor = CinepvqTextMuted,
                    unselectedTextColor = CinepvqTextMuted,
                    indicatorColor = CinepvqPrimary.copy(alpha = 0.15f)
                )
            )
        }
    }
}
