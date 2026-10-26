package com.pvq.cinepvq.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val CinepvqDarkColorScheme = darkColorScheme(
    primary = CinepvqPrimary,
    onPrimary = CinepvqTextPrimary,
    primaryContainer = CinepvqPrimaryContainer,
    onPrimaryContainer = CinepvqPrimaryLight,
    secondary = CinepvqPrimaryLight,
    onSecondary = CinepvqBackground,
    background = CinepvqBackground,
    onBackground = CinepvqTextPrimary,
    surface = CinepvqSurface,
    onSurface = CinepvqTextPrimary,
    surfaceVariant = CinepvqSurfaceVariant,
    onSurfaceVariant = CinepvqTextSecondary,
    outline = CinepvqBorder,
    outlineVariant = CinepvqBorderSubtle,
    error = CinepvqRed,
    onError = CinepvqTextPrimary
)

@Composable
fun CinepvqTheme(
    darkTheme: Boolean = true, // Default to Cinematic Dark Mode
    content: @Composable () -> Unit
) {
    val colorScheme = CinepvqDarkColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = android.graphics.Color.TRANSPARENT
                window.navigationBarColor = android.graphics.Color.TRANSPARENT
                val insetsController = WindowCompat.getInsetsController(window, view)
                insetsController.isAppearanceLightStatusBars = false
                insetsController.isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}