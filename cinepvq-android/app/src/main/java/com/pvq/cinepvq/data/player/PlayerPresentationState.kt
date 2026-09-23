package com.pvq.cinepvq.data.player

/**
 * Represents the 5 distinct presentation states of the video player in Cinepvq:
 * - HIDDEN: No active player UI displayed (stopped or dismissed).
 * - FULL_PORTRAIT: Full player displayed in portrait orientation (includes WatchScreen details below).
 * - FULL_LANDSCAPE: Fullscreen landscape player occupying the entire screen.
 * - MINI_IN_APP: Floating in-app picture-in-picture / mini-player over existing navigation content.
 * - SYSTEM_PIP: Android OS System Picture-in-Picture window when the app is backgrounded.
 */
enum class PlayerPresentationState {
    HIDDEN,
    FULL_PORTRAIT,
    FULL_LANDSCAPE,
    MINI_IN_APP,
    SYSTEM_PIP
}
