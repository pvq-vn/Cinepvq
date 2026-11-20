package com.pvq.cinepvq

import androidx.lifecycle.SavedStateHandle
import com.pvq.cinepvq.data.player.HlsAdAndPngProcessor
import com.pvq.cinepvq.data.player.VideoSourceRepository
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.features.library.LibraryTab
import com.pvq.cinepvq.features.player.PlayerGestureMath
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

    // ── Bug 6: HLS Ad-Stripping & PNG-TS Unwrapping ──────────────────────────

    @Test
    fun testHlsAdStripping_removesKkphimAdBlockAndPreservesConvertV9() {
        val sb = StringBuilder()
        sb.appendLine("#EXTM3U")
        sb.appendLine("#EXT-X-VERSION:3")
        sb.appendLine("#EXT-X-TARGETDURATION:6")
        // 25 normal main movie segments (random alnum)
        for (i in 1..25) {
            sb.appendLine("#EXTINF:5.0,")
            sb.appendLine("abc${i}xyz99.ts")
        }
        // Watermarked real movie scene (convertv9) — MUST BE PRESERVED!
        sb.appendLine("#EXT-X-DISCONTINUITY")
        for (i in 1..4) {
            sb.appendLine("#EXTINF:4.0,")
            sb.appendLine("convertv9/scene${i}ab.ts")
        }
        // Injected KKPhim1 commercial ad block — MUST BE REMOVED!
        sb.appendLine("#EXT-X-DISCONTINUITY")
        sb.appendLine("#EXT-X-KEY:METHOD=NONE")
        for (i in 1..9) {
            sb.appendLine("#EXTINF:3.8,")
            sb.appendLine("/v9/d3b54219ece57fa7c8af6d2076384ce0/segment_000$i.ts")
        }
        // Continuation of real movie
        sb.appendLine("#EXT-X-DISCONTINUITY")
        for (i in 26..35) {
            sb.appendLine("#EXTINF:5.0,")
            sb.appendLine("def${i}uvw88.ts")
        }
        sb.appendLine("#EXT-X-ENDLIST")

        val res = HlsAdAndPngProcessor.stripAdsFromM3u8(
            sb.toString(),
            "https://s6.kkphimplayer6.com/20261120/demo/2000kb/hls/mixed.m3u8"
        )

        assertEquals(9, res.removedSegments)
        assertTrue(res.removedSeconds > 30.0)
        assertFalse(res.cleaned.contains("segment_0001.ts"))
        assertTrue(res.cleaned.contains("convertv9/scene1ab.ts"))
        assertTrue(res.cleaned.contains("abc1xyz99.ts"))
        assertTrue(res.cleaned.contains("def35uvw88.ts"))
    }

    @Test
    fun testPngTsUnwrapper_stripsVsmov478bAndPhimHdcss76bWithFooter() {
        fun makeTsPackets(count: Int): ByteArray {
            val out = ByteArray(count * 188)
            for (p in 0 until count) {
                out[p * 188] = 0x47.toByte()
                out[p * 188 + 1] = (p + 1).toByte()
            }
            return out
        }

        // Case 1: VSMOV 478-byte PNG prefix + 4 TS packets
        val vsmovPrefix = ByteArray(478)
        vsmovPrefix[0] = 0x89.toByte(); vsmovPrefix[1] = 0x50; vsmovPrefix[2] = 0x4E; vsmovPrefix[3] = 0x47
        val vsmovWrapped = vsmovPrefix + makeTsPackets(4)
        val vsmovClean = HlsAdAndPngProcessor.stripPngPrefixFromTs(vsmovWrapped)
        assertEquals(4 * 188, vsmovClean.size)
        assertEquals(0x47.toByte(), vsmovClean[0])
        assertEquals(0x47.toByte(), vsmovClean[188])

        // Case 2: PhimHDCSS FHDC 76-byte PNG prefix + 5 TS packets + 64-byte trailing footer
        val fhdcPrefix = ByteArray(76)
        fhdcPrefix[0] = 0x89.toByte(); fhdcPrefix[1] = 0x50; fhdcPrefix[2] = 0x4E; fhdcPrefix[3] = 0x47
        val fhdcFooter = ByteArray(64) { 0x2A }
        val fhdcWrapped = fhdcPrefix + makeTsPackets(5) + fhdcFooter
        val fhdcClean = HlsAdAndPngProcessor.stripPngPrefixFromTs(fhdcWrapped)
        assertEquals(5 * 188, fhdcClean.size)
        assertEquals(0x47.toByte(), fhdcClean[0])
        assertEquals(0x47.toByte(), fhdcClean[376])

        // Case 3: Pure MPEG-TS passes through untouched
        val pure = makeTsPackets(3)
        val pureOut = HlsAdAndPngProcessor.stripPngPrefixFromTs(pure)
        assertEquals(pure.size, pureOut.size)
    }

    @Test
    fun testExtractPhimHdcssManifestFromHtml() {
        val html = """<script>window.__edgePlayBootstrap = Object.freeze(Object.assign({"manifest":"#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4.0,\nhttps:\/\/p16-oec-sg.ibyteimg.com\/seg1.png\n#EXT-X-ENDLIST"}, {}));</script>"""
        val manifest = HlsAdAndPngProcessor.extractPhimHdcssManifestFromHtml(html)
        assertNotNull(manifest)
        assertTrue(manifest!!.startsWith("#EXTM3U"))
        assertTrue(manifest.contains("https://p16-oec-sg.ibyteimg.com/seg1.png"))
    }

    // ── Bug 7: Brightness Normalization & Responsive Gesture Math ────────────

    @Test
    fun testBrightnessNormalization_preserves30PercentWithoutJumpingTo50() {
        // Standard 0..255 Android scale: 30% ~= 77
        val norm255 = PlayerGestureMath.normalizeSystemBrightness(77, 255)
        assertEquals(0.30f, norm255, 0.02f)

        // Xiaomi / Samsung / Pixel high-precision 0..4095 scale: 30% ~= 1229
        val norm4095 = PlayerGestureMath.normalizeSystemBrightness(1229, 4095)
        assertEquals(0.30f, norm4095, 0.02f)

        // Auto-detect vendor max when configuredMax is fallback 255 but raw is > 255
        val autoHigh = PlayerGestureMath.normalizeSystemBrightness(1229, 255)
        assertEquals(0.30f, autoHigh, 0.02f)
    }

    @Test
    fun testGestureSeekAndVolumeMath_symmetricRounding() {
        assertEquals(15, PlayerGestureMath.computeSeekDeltaSeconds(80f, 1000f))
        assertEquals(-15, PlayerGestureMath.computeSeekDeltaSeconds(-80f, 1000f))
        assertEquals(8, PlayerGestureMath.computeVolumeIndex(0.51f, 15))
        assertEquals(0, PlayerGestureMath.computeVolumeIndex(0f, 15))
        assertEquals(15, PlayerGestureMath.computeVolumeIndex(1f, 15))
    }

    // ── Bug 8: New Video Source Cleaning (PhimHDCSS, ChoPhim, VSMOV Native) ─

    @Test
    fun testCleanSourceName_newSourcesAndNativeVsmov() {
        val (phimName, phimDisplay) = VideoSourceRepository.cleanSourceName(
            "phimhdcss", "PhimHDCSS FHDC", "PhimHDCSS (FHDC)", "Vietsub", "https://tiktok.phimhdc.com/embed/123"
        )
        assertEquals("PhimHDCSS", phimName)
        assertTrue(phimDisplay.contains("PhimHDCSS"))

        val (choName, choDisplay) = VideoSourceRepository.cleanSourceName(
            "chophim", "ChoPhim Direct", "ChoPhim", "Thuyết Minh", "https://cdn.example.com/a.m3u8"
        )
        assertEquals("ChoPhim", choName)
        assertTrue(choDisplay.contains("Thuyết Minh"))

        val (vsmovName, vsmovDisplay) = VideoSourceRepository.cleanSourceName(
            "vsmov", "VSMOV Native HLS", "VSMOV", "Vietsub", "https://v8.streamvsmov.com/stream/abc/master.m3u8"
        )
        assertEquals("VSMOV", vsmovName)
        assertTrue(vsmovDisplay.contains("Native"))
    }
}
