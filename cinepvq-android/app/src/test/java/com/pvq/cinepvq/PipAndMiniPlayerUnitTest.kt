package com.pvq.cinepvq

import com.pvq.cinepvq.data.player.PlayerPresentationState
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.MovieDetail
import org.junit.Assert.*
import org.junit.Test

class PipAndMiniPlayerUnitTest {

    // ── 1. Presentation State Transitions ────────────────────────────────────

    class PresentationStateHolder(
        var presentationState: PlayerPresentationState = PlayerPresentationState.HIDDEN
    ) {
        var previousPresentationState: PlayerPresentationState = PlayerPresentationState.FULL_PORTRAIT
            private set
        var pipPreviousPresentationState: PlayerPresentationState = PlayerPresentationState.FULL_PORTRAIT
            private set

        fun minimize() {
            if (presentationState == PlayerPresentationState.FULL_PORTRAIT ||
                presentationState == PlayerPresentationState.FULL_LANDSCAPE
            ) {
                previousPresentationState = presentationState
            }
            presentationState = PlayerPresentationState.MINI_IN_APP
        }

        fun expand(): PlayerPresentationState {
            val target = previousPresentationState
            presentationState = target
            return target
        }

        fun enterPip() {
            if (presentationState != PlayerPresentationState.SYSTEM_PIP) {
                pipPreviousPresentationState = presentationState
                presentationState = PlayerPresentationState.SYSTEM_PIP
            }
        }

        fun restoreFromPip(): PlayerPresentationState {
            val target = pipPreviousPresentationState
            presentationState = target
            return target
        }

        fun closePlayback() {
            presentationState = PlayerPresentationState.HIDDEN
            previousPresentationState = PlayerPresentationState.FULL_PORTRAIT
            pipPreviousPresentationState = PlayerPresentationState.FULL_PORTRAIT
        }
    }

    @Test
    fun testPortraitToMiniToExpand_restoresPortrait() {
        val holder = PresentationStateHolder(PlayerPresentationState.FULL_PORTRAIT)

        holder.minimize()
        assertEquals(PlayerPresentationState.MINI_IN_APP, holder.presentationState)
        assertEquals(PlayerPresentationState.FULL_PORTRAIT, holder.previousPresentationState)

        val restored = holder.expand()
        assertEquals(PlayerPresentationState.FULL_PORTRAIT, restored)
        assertEquals(PlayerPresentationState.FULL_PORTRAIT, holder.presentationState)
    }

    @Test
    fun testLandscapeToMiniToExpand_restoresLandscape() {
        val holder = PresentationStateHolder(PlayerPresentationState.FULL_LANDSCAPE)

        holder.minimize()
        assertEquals(PlayerPresentationState.MINI_IN_APP, holder.presentationState)
        assertEquals(PlayerPresentationState.FULL_LANDSCAPE, holder.previousPresentationState)

        val restored = holder.expand()
        assertEquals(PlayerPresentationState.FULL_LANDSCAPE, restored)
        assertEquals(PlayerPresentationState.FULL_LANDSCAPE, holder.presentationState)
    }

    @Test
    fun testPortraitToPipToExpand_restoresPortrait() {
        val holder = PresentationStateHolder(PlayerPresentationState.FULL_PORTRAIT)

        holder.enterPip()
        assertEquals(PlayerPresentationState.SYSTEM_PIP, holder.presentationState)
        assertEquals(PlayerPresentationState.FULL_PORTRAIT, holder.pipPreviousPresentationState)

        val restored = holder.restoreFromPip()
        assertEquals(PlayerPresentationState.FULL_PORTRAIT, restored)
        assertEquals(PlayerPresentationState.FULL_PORTRAIT, holder.presentationState)
    }

    @Test
    fun testLandscapeToPipToExpand_restoresLandscape() {
        val holder = PresentationStateHolder(PlayerPresentationState.FULL_LANDSCAPE)

        holder.enterPip()
        assertEquals(PlayerPresentationState.SYSTEM_PIP, holder.presentationState)
        assertEquals(PlayerPresentationState.FULL_LANDSCAPE, holder.pipPreviousPresentationState)

        val restored = holder.restoreFromPip()
        assertEquals(PlayerPresentationState.FULL_LANDSCAPE, restored)
        assertEquals(PlayerPresentationState.FULL_LANDSCAPE, holder.presentationState)
    }

    @Test
    fun testMiniToPipToExpand_restoresMiniInApp() {
        val holder = PresentationStateHolder(PlayerPresentationState.FULL_PORTRAIT)

        holder.minimize()
        assertEquals(PlayerPresentationState.MINI_IN_APP, holder.presentationState)

        holder.enterPip()
        assertEquals(PlayerPresentationState.SYSTEM_PIP, holder.presentationState)
        assertEquals(PlayerPresentationState.MINI_IN_APP, holder.pipPreviousPresentationState)

        val restored = holder.restoreFromPip()
        assertEquals(PlayerPresentationState.MINI_IN_APP, restored)
        assertEquals(PlayerPresentationState.MINI_IN_APP, holder.presentationState)
    }

    @Test
    fun testPipClose_transitionsToHidden() {
        val holder = PresentationStateHolder(PlayerPresentationState.FULL_LANDSCAPE)
        holder.enterPip()
        assertEquals(PlayerPresentationState.SYSTEM_PIP, holder.presentationState)

        holder.closePlayback()
        assertEquals(PlayerPresentationState.HIDDEN, holder.presentationState)
    }

    // ── 2. System PiP Eligibility Determination ──────────────────────────────

    private fun checkPipEligibility(
        hasActivePlayback: Boolean,
        isPlaying: Boolean,
        presentationState: PlayerPresentationState,
        isScreenOn: Boolean = true
    ): Boolean {
        val isEligiblePresentation = presentationState in listOf(
            PlayerPresentationState.FULL_PORTRAIT,
            PlayerPresentationState.FULL_LANDSCAPE,
            PlayerPresentationState.MINI_IN_APP
        )
        return hasActivePlayback && isPlaying && isEligiblePresentation && isScreenOn
    }

    @Test
    fun testPipEligibility_portraitPlay_entersPip() {
        assertTrue(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.FULL_PORTRAIT))
    }

    @Test
    fun testPipEligibility_portraitPause_doesNotEnterPip() {
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = false, presentationState = PlayerPresentationState.FULL_PORTRAIT))
    }

    @Test
    fun testPipEligibility_landscapePlay_entersPip() {
        assertTrue(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.FULL_LANDSCAPE))
    }

    @Test
    fun testPipEligibility_landscapePause_doesNotEnterPip() {
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = false, presentationState = PlayerPresentationState.FULL_LANDSCAPE))
    }

    @Test
    fun testPipEligibility_miniPlay_entersPip() {
        assertTrue(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.MINI_IN_APP))
    }

    @Test
    fun testPipEligibility_miniPause_doesNotEnterPip() {
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = false, presentationState = PlayerPresentationState.MINI_IN_APP))
    }

    @Test
    fun testPipEligibility_screenOff_neverEntersPip() {
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.FULL_PORTRAIT, isScreenOn = false))
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.FULL_LANDSCAPE, isScreenOn = false))
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.MINI_IN_APP, isScreenOn = false))
    }

    @Test
    fun testPipEligibility_stoppedOrHidden_doesNotEnterPip() {
        assertFalse(checkPipEligibility(hasActivePlayback = false, isPlaying = true, presentationState = PlayerPresentationState.HIDDEN))
        assertFalse(checkPipEligibility(hasActivePlayback = true, isPlaying = true, presentationState = PlayerPresentationState.HIDDEN))
    }

    // ── 3. Downward Drag Threshold Calculations ──────────────────────────────

    @Test
    fun testDownwardDragGesture_thresholdComparison() {
        val dragThresholdPx = 300f // 120dp at 2.5x density

        val smallDrag = 150f
        val shouldMinimizeSmall = smallDrag > dragThresholdPx
        assertFalse(shouldMinimizeSmall)

        val largeDrag = 350f
        val shouldMinimizeLarge = largeDrag > dragThresholdPx
        assertTrue(shouldMinimizeLarge)

        // Drag fraction and scale calculations
        val dragFractionSmall = (smallDrag / (dragThresholdPx * 2.5f)).coerceIn(0f, 1f)
        val scaleSmall = 1f - (dragFractionSmall * 0.22f)
        assertTrue(scaleSmall in 0.78f..1.0f)
        assertEquals(0.956f, scaleSmall, 0.01f)
    }

    // ── 4. Episode Navigation in PiP & Mini Player ────────────────────────────

    private fun findNextEpisode(episodes: List<EpisodeItem>, currentSlug: String): EpisodeItem? {
        val idx = episodes.indexOfFirst { it.slug == currentSlug }
        return if (idx != -1 && idx < episodes.size - 1) episodes[idx + 1] else null
    }

    private fun findPrevEpisode(episodes: List<EpisodeItem>, currentSlug: String): EpisodeItem? {
        val idx = episodes.indexOfFirst { it.slug == currentSlug }
        return if (idx > 0) episodes[idx - 1] else null
    }

    @Test
    fun testEpisodeNavigation_firstEpisode() {
        val eps = listOf(
            EpisodeItem(name = "Tập 1", slug = "tap-1", embed = "url1"),
            EpisodeItem(name = "Tập 2", slug = "tap-2", embed = "url2"),
            EpisodeItem(name = "Tập 3", slug = "tap-3", embed = "url3")
        )

        val prev = findPrevEpisode(eps, "tap-1")
        val next = findNextEpisode(eps, "tap-1")

        assertNull(prev)
        assertNotNull(next)
        assertEquals("tap-2", next?.slug)
    }

    @Test
    fun testEpisodeNavigation_middleEpisode() {
        val eps = listOf(
            EpisodeItem(name = "Tập 1", slug = "tap-1", embed = "url1"),
            EpisodeItem(name = "Tập 2", slug = "tap-2", embed = "url2"),
            EpisodeItem(name = "Tập 3", slug = "tap-3", embed = "url3")
        )

        val prev = findPrevEpisode(eps, "tap-2")
        val next = findNextEpisode(eps, "tap-2")

        assertNotNull(prev)
        assertNotNull(next)
        assertEquals("tap-1", prev?.slug)
        assertEquals("tap-3", next?.slug)
    }

    @Test
    fun testEpisodeNavigation_lastEpisode() {
        val eps = listOf(
            EpisodeItem(name = "Tập 1", slug = "tap-1", embed = "url1"),
            EpisodeItem(name = "Tập 2", slug = "tap-2", embed = "url2"),
            EpisodeItem(name = "Tập 3", slug = "tap-3", embed = "url3")
        )

        val prev = findPrevEpisode(eps, "tap-3")
        val next = findNextEpisode(eps, "tap-3")

        assertNotNull(prev)
        assertNull(next)
        assertEquals("tap-2", prev?.slug)
    }
}
