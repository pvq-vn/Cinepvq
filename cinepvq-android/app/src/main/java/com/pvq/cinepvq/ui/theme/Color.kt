package com.pvq.cinepvq.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// Cinepvq Dark Cinematic Palette (Matching cinepvq-web Zinc & Violet design)
val CinepvqBackground = Color(0xFF09090B)       // Zinc 950
val CinepvqSurface = Color(0xFF18181B)          // Zinc 900
val CinepvqSurfaceVariant = Color(0xFF27272A)   // Zinc 800
val CinepvqSurfaceElevated = Color(0xFF202024)  // Elevated Card surface
val CinepvqBorder = Color(0xFF3F3F46)           // Zinc 700
val CinepvqBorderSubtle = Color(0xFF27272A)     // Zinc 800

val CinepvqPrimary = Color(0xFF8B5CF6)          // Violet 500
val CinepvqPrimaryDark = Color(0xFF7C3AED)      // Violet 600
val CinepvqPrimaryLight = Color(0xFFA78BFA)     // Violet 400
val CinepvqPrimaryContainer = Color(0xFF2E1065) // Violet 950

val CinepvqTextPrimary = Color(0xFFFAFAFA)      // Zinc 50
val CinepvqTextSecondary = Color(0xFFA1A1AA)    // Zinc 400
val CinepvqTextMuted = Color(0xFF71717A)        // Zinc 500

val CinepvqGold = Color(0xFFFBBF24)             // Amber 400 (Rating & Trending Rank)
val CinepvqAmber = Color(0xFFFBBF24)            // Amber 400 alias
val CinepvqRed = Color(0xFFF43F5E)              // Rose 500 (Favorites Heart)
val CinepvqGreen = Color(0xFF10B981)            // Emerald 500 (Success)
val CinepvqBadge = Color(0x338B5CF6)            // Semi-transparent Violet badge
val CinepvqBorderViolet = Color(0x338B5CF6)     // Violet subtle border (20% opacity)
val CinepvqCardBorder = Color(0x1FFFFFFF)       // 12% white stroke for crisp dark cards

// Brand Gradients
val CinepvqBrandGradient = Brush.horizontalGradient(
    colors = listOf(Color(0xFF8B5CF6), Color(0xFF6366F1), Color(0xFFA855F7))
)

val CinepvqHeroOverlayGradient = Brush.verticalGradient(
    colors = listOf(
        Color(0x0009090B),
        Color(0x8009090B),
        Color(0xEB09090B),
        Color(0xFF09090B)
    )
)

val CinepvqCardOverlayGradient = Brush.verticalGradient(
    colors = listOf(
        Color.Transparent,
        Color(0x40000000),
        Color(0xDF000000)
    )
)