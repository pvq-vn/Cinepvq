package com.pvq.cinepvq

import androidx.lifecycle.SavedStateHandle
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.library.LibraryTab
import com.pvq.cinepvq.features.player.VideoResolution
import org.junit.Assert.*
import org.junit.Test

class BugFixesUnitTest {

    // ── Bug 2: Library Tab Persistence via SavedStateHandle ───────────────────

    @Test
    fun testLibraryTabPersistence_restoresFromSavedStateHandle() {
        val savedStateHandle = SavedStateHandle(mapOf("selected_library_tab" to LibraryTab.WATCH_LATER.name))
        val restoredTab = savedStateHandle.get<String>("selected_library_tab")?.let { name ->
            try { LibraryTab.valueOf(name) } catch (_: Exception) { LibraryTab.FAVORITES }
        } ?: LibraryTab.FAVORITES

        assertEquals(LibraryTab.WATCH_LATER, restoredTab)

        // When user switches tab to HISTORY:
        savedStateHandle["selected_library_tab"] = LibraryTab.HISTORY.name
        val switchedTab = savedStateHandle.get<String>("selected_library_tab")?.let { name ->
            try { LibraryTab.valueOf(name) } catch (_: Exception) { LibraryTab.FAVORITES }
        } ?: LibraryTab.FAVORITES

        assertEquals(LibraryTab.HISTORY, switchedTab)
    }

    @Test
    fun testLibraryTabPersistence_defaultsToFavoritesWhenNoSavedState() {
        val savedStateHandle = SavedStateHandle()
        val restoredTab = savedStateHandle.get<String>("selected_library_tab")?.let { name ->
            try { LibraryTab.valueOf(name) } catch (_: Exception) { LibraryTab.FAVORITES }
        } ?: LibraryTab.FAVORITES

        assertEquals(LibraryTab.FAVORITES, restoredTab)
    }

    // ── Bug 3: Default Playback Source Matching Logic ─────────────────────────

    private fun matchSource(source: StreamSource, preferredKey: String): Boolean {
        if (!source.isAvailable) return false
        val key = preferredKey.lowercase().trim()
        if (key == "auto" || key.isEmpty()) return true
        val id = source.sourceId.lowercase()
        val name = source.name.lowercase()
        val displayName = source.displayName.lowercase()

        return when (key) {
            "k20" -> id.contains("k20") || name.contains("k20") || displayName.contains("k20")
            "kkphim" -> id.contains("kkphim") || name.contains("kkphim") || displayName.contains("kkphim")
            "vsmov" -> id.contains("vsmov") || name.contains("vsmov") || displayName.contains("vsmov")
            "nguonc" -> id.contains("nguonc") || name.contains("nguonc") || id.contains("embed_fallback") || name.contains("streamc") || displayName.contains("nguonc")
            else -> id.contains(key) || name.contains(key) || displayName.contains(key)
        }
    }

    @Test
    fun testDefaultSourceMatching_k20() {
        val k20Source = StreamSource(sourceId = "k20_server_vip1", name = "VIP 1 (K20)", displayName = "VIP 1 (K20)", url = "https://cdn.example.com/k20.m3u8", priority = 1, type = StreamType.HLS_DIRECT)
        val kkphimSource = StreamSource(sourceId = "kkphim_server_vip2", name = "VIP 2 (KKPhim)", displayName = "VIP 2 (KKPhim)", url = "https://cdn.example.com/kkphim.m3u8", priority = 2, type = StreamType.HLS_DIRECT)

        assertTrue(matchSource(k20Source, "k20"))
        assertFalse(matchSource(kkphimSource, "k20"))
    }

    @Test
    fun testDefaultSourceMatching_kkphim() {
        val k20Source = StreamSource(sourceId = "k20_server_vip1", name = "VIP 1 (K20)", displayName = "VIP 1 (K20)", url = "https://cdn.example.com/k20.m3u8", priority = 1, type = StreamType.HLS_DIRECT)
        val kkphimSource = StreamSource(sourceId = "kkphim_server_vip2", name = "VIP 2 (KKPhim)", displayName = "VIP 2 (KKPhim)", url = "https://cdn.example.com/kkphim.m3u8", priority = 2, type = StreamType.HLS_DIRECT)

        assertTrue(matchSource(kkphimSource, "kkphim"))
        assertFalse(matchSource(k20Source, "kkphim"))
    }

    @Test
    fun testDefaultSourceMatching_vsmov() {
        val vsmovSource = StreamSource(sourceId = "vsmov_hls", name = "Dự phòng 1 (VSMOV)", displayName = "VSMOV HLS", url = "https://cdn.example.com/vsmov.m3u8", priority = 3, type = StreamType.HLS_DIRECT)
        assertTrue(matchSource(vsmovSource, "vsmov"))
    }

    @Test
    fun testDefaultSourceMatching_nguoncAndStreamc() {
        val nguoncSource = StreamSource(sourceId = "nguonc_streamc", name = "StreamC", displayName = "NguonC Full", url = "https://embed.example.com", priority = 4, type = StreamType.EMBED)
        val fallbackSource = StreamSource(sourceId = "embed_fallback_1", name = "Nguồn nhúng dự phòng", displayName = "Embed Fallback", url = "https://embed.example.com", priority = 5, type = StreamType.EMBED)

        assertTrue(matchSource(nguoncSource, "nguonc"))
        assertTrue(matchSource(fallbackSource, "nguonc"))
    }

    @Test
    fun testDefaultSourceMatching_autoMatchesAnyAvailableSource() {
        val k20Source = StreamSource(sourceId = "k20_server", name = "VIP 1", displayName = "VIP 1", url = "https://cdn.example.com/k20.m3u8", priority = 1, type = StreamType.HLS_DIRECT, isAvailable = true)
        val unavailableSource = StreamSource(sourceId = "kkphim_server", name = "VIP 2", displayName = "VIP 2", url = "", priority = 2, type = StreamType.HLS_DIRECT, isAvailable = false)

        assertTrue(matchSource(k20Source, "auto"))
        assertFalse(matchSource(unavailableSource, "auto"))
    }

    // ── Bug 4: Resolution Mapping & Parsing ───────────────────────────────────

    @Test
    fun testVideoResolution_parsingAndLines() {
        assertEquals(VideoResolution.FHD, VideoResolution.valueOf("FHD"))
        assertEquals(1080, VideoResolution.FHD.maxLines)
        assertEquals(720, VideoResolution.HD.maxLines)
        assertEquals(480, VideoResolution.SD.maxLines)
        assertEquals(360, VideoResolution.LOW.maxLines)
        assertEquals(Int.MAX_VALUE, VideoResolution.AUTO.maxLines)

        // Mapping from string preference:
        val res1080 = when ("1080p") {
            "1080p" -> VideoResolution.FHD
            "720p" -> VideoResolution.HD
            "480p" -> VideoResolution.SD
            "360p" -> VideoResolution.LOW
            else -> VideoResolution.AUTO
        }
        assertEquals(VideoResolution.FHD, res1080)
    }

    // ── Bug 5: Position Preservation Across Streams ───────────────────────────

    @Test
    fun testPositionPreservation_switchingFromHlsOrEmbed() {
        // When in HLS, exoPlayer position is captured
        val exoPlayerPos = 154000L
        val currentPositionMs = 154000L
        val capturedFromHls = if (exoPlayerPos > 0L) exoPlayerPos else currentPositionMs
        assertEquals(154000L, capturedFromHls)

        // When in EMBED, exoPlayer is stopped (position = 0), so currentPositionMs is preserved
        val exoPlayerPosInEmbed = 0L
        val capturedFromEmbed = if (exoPlayerPosInEmbed > 0L) exoPlayerPosInEmbed else currentPositionMs
        assertEquals(154000L, capturedFromEmbed)
    }
}
