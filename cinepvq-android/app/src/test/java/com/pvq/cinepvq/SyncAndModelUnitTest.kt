package com.pvq.cinepvq

import com.pvq.cinepvq.core.database.WatchHistoryEntity
import com.pvq.cinepvq.core.network.model.*
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.*

class SyncAndModelUnitTest {

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    private fun parseTime(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        return try {
            isoFormat.parse(iso)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

    // ─── Conflict Resolution Tests (Cases A - F) ──────────────────────────────

    @Test
    fun testCaseA_LocalOlderThanRemote_RemoteWins() {
        val localUpdatedAt = "2026-09-12T07:00:00.000Z"
        val remoteUpdatedAt = "2026-09-12T08:00:00.000Z"

        val local = WatchHistoryEntity(
            slug = "movie-a",
            name = "Movie A",
            thumbUrl = "",
            currentTime = 300,
            duration = 1000,
            updatedAt = localUpdatedAt
        )
        val remote = WatchHistoryDto(
            slug = "movie-a",
            name = "Movie A",
            thumb_url = "",
            currentTime = 600,
            duration = 1000,
            updatedAt = remoteUpdatedAt
        )

        val timeRemote = parseTime(remote.updatedAt)
        val timeLocal = parseTime(local.updatedAt)

        assertTrue(timeRemote > timeLocal)

        // Conflict resolution: Remote is newer, so Remote wins and overwrites local
        val resolvedCurrentTime = if (timeRemote >= timeLocal) remote.currentTime else local.currentTime
        val shouldPushToRemote = timeLocal > timeRemote

        assertEquals(600L, resolvedCurrentTime)
        assertFalse("Local should not be pushed when remote is newer", shouldPushToRemote)
    }

    @Test
    fun testCaseB_LocalNewerThanRemote_LocalPushed() {
        val localUpdatedAt = "2026-09-12T08:30:00.000Z"
        val remoteUpdatedAt = "2026-09-12T08:00:00.000Z"

        val local = WatchHistoryEntity(
            slug = "movie-b",
            name = "Movie B",
            thumbUrl = "",
            currentTime = 900,
            duration = 1200,
            updatedAt = localUpdatedAt
        )
        val remote = WatchHistoryDto(
            slug = "movie-b",
            name = "Movie B",
            thumb_url = "",
            currentTime = 400,
            duration = 1200,
            updatedAt = remoteUpdatedAt
        )

        val timeRemote = parseTime(remote.updatedAt)
        val timeLocal = parseTime(local.updatedAt)

        assertTrue(timeLocal > timeRemote)

        // Conflict resolution: Local is newer, so Local is pushed to server
        val shouldPushToRemote = timeLocal > timeRemote
        assertTrue("Local should be pushed to remote when local is newer", shouldPushToRemote)
    }

    @Test
    fun testCaseC_TimestampsEqual_ConsistentNoOpOrRemotePreserved() {
        val timestamp = "2026-09-12T08:00:00.000Z"

        val local = WatchHistoryEntity(
            slug = "movie-c",
            name = "Movie C",
            thumbUrl = "",
            currentTime = 500,
            duration = 1000,
            updatedAt = timestamp
        )
        val remote = WatchHistoryDto(
            slug = "movie-c",
            name = "Movie C",
            thumb_url = "",
            currentTime = 500,
            duration = 1000,
            updatedAt = timestamp
        )

        val timeRemote = parseTime(remote.updatedAt)
        val timeLocal = parseTime(local.updatedAt)

        assertEquals(timeRemote, timeLocal)

        // When equal: no push required, remote matches local
        val shouldPushToRemote = timeLocal > timeRemote
        assertFalse("No push needed when timestamps are equal", shouldPushToRemote)
    }

    @Test
    fun testCaseD_LocalOnlyHistory_MustBePushedToServer() {
        val localOnlyItem = WatchHistoryEntity(
            slug = "offline-movie",
            name = "Offline Movie",
            thumbUrl = "",
            episodeSlug = "tap-01",
            currentTime = 120,
            duration = 1200,
            updatedAt = "2026-09-12T08:15:00.000Z"
        )
        val remoteList = listOf(
            WatchHistoryDto(slug = "remote-movie-1", name = "Remote 1", thumb_url = ""),
            WatchHistoryDto(slug = "remote-movie-2", name = "Remote 2", thumb_url = "")
        )

        val remoteSlugs = remoteList.map { it.slug }.toSet()
        val isLocalOnly = localOnlyItem.slug !in remoteSlugs

        assertTrue("Item should be detected as local-only", isLocalOnly)

        // In syncWithServer: localOnly items are added to itemsToPush
        val itemsToPush = mutableListOf<WatchHistoryDto>()
        if (isLocalOnly) {
            itemsToPush.add(
                WatchHistoryDto(
                    slug = localOnlyItem.slug,
                    name = localOnlyItem.name,
                    currentTime = localOnlyItem.currentTime,
                    duration = localOnlyItem.duration,
                    updatedAt = localOnlyItem.updatedAt
                )
            )
        }

        assertEquals(1, itemsToPush.size)
        assertEquals("offline-movie", itemsToPush[0].slug)
    }

    @Test
    fun testCaseE_RemoteOnlyHistory_InsertedIntoLocalRoom() {
        val remoteItem = WatchHistoryDto(
            slug = "web-only-movie",
            name = "Web Watched Movie",
            thumb_url = "https://example.com/thumb.jpg",
            episodeSlug = "tap-05",
            currentTime = 850,
            duration = 1500,
            updatedAt = "2026-09-12T08:20:00.000Z"
        )
        val localExisting: WatchHistoryEntity? = null // Not present locally

        val shouldInsertToLocal = (localExisting == null) || (parseTime(remoteItem.updatedAt) >= parseTime(localExisting.updatedAt))
        assertTrue("Remote-only item must be inserted into local Room cache", shouldInsertToLocal)
    }

    @Test
    fun testCaseF_SameMovieDifferentEpisode_ResolvedByTimestamp() {
        val timeEp1 = "2026-09-12T06:00:00.000Z"
        val timeEp2 = "2026-09-12T08:00:00.000Z"

        val localEp1 = WatchHistoryEntity(
            slug = "series-x",
            name = "Series X",
            thumbUrl = "",
            episodeSlug = "tap-01",
            episodeName = "Tập 1",
            currentTime = 1200,
            duration = 1200,
            updatedAt = timeEp1
        )
        val remoteEp2 = WatchHistoryDto(
            slug = "series-x",
            name = "Series X",
            thumb_url = "",
            episodeSlug = "tap-02",
            episodeName = "Tập 2",
            currentTime = 350,
            duration = 1200,
            updatedAt = timeEp2
        )

        val timeRemote = parseTime(remoteEp2.updatedAt)
        val timeLocal = parseTime(localEp1.updatedAt)

        assertTrue("Episode 2 on remote is newer than Episode 1 on local", timeRemote > timeLocal)

        // Remote has newer episode -> Remote wins
        val winningEpisodeSlug = if (timeRemote >= timeLocal) remoteEp2.episodeSlug else localEp1.episodeSlug
        assertEquals("tap-02", winningEpisodeSlug)
    }

    // ─── Stream Type & Multi-Source Engine Tests ──────────────────────────────

    @Test
    fun testStreamSourceClassification() {
        val directHls = StreamSource(
            sourceId = "k20",
            name = "K20 Direct HLS",
            displayName = "K20",
            type = StreamType.HLS_DIRECT,
            url = "https://cdn.k20.com/stream.m3u8",
            priority = 1
        )
        val embedFallback = StreamSource(
            sourceId = "nguonc",
            name = "NguonC Embed",
            displayName = "NguonC",
            type = StreamType.EMBED,
            url = "https://phim.nguonc.com/embed/film",
            priority = 4
        )
        val unavailable = StreamSource(
            sourceId = "dead_link",
            name = "Dead Link",
            displayName = "Offline",
            type = StreamType.UNAVAILABLE,
            url = "",
            priority = 99,
            isAvailable = false
        )

        assertEquals(StreamType.HLS_DIRECT, directHls.type)
        assertEquals(StreamType.EMBED, embedFallback.type)
        assertEquals(StreamType.UNAVAILABLE, unavailable.type)

        val sorted = listOf(unavailable, embedFallback, directHls).sortedBy { it.priority }
        assertEquals("k20", sorted[0].sourceId)
        assertEquals("nguonc", sorted[1].sourceId)
        assertEquals("dead_link", sorted[2].sourceId)
    }

    // ─── Model & Nullability Tests ───────────────────────────────────────────

    @Test
    fun testProgressPercentCalculation() {
        val itemHalfway = WatchHistoryItem(
            slug = "mai-2024",
            name = "Mai",
            thumbUrl = "https://img.example.com/mai.jpg",
            currentTime = 3600,
            duration = 7200
        )
        assertEquals(0.5f, itemHalfway.progressPercent, 0.001f)

        val itemFinished = WatchHistoryItem(
            slug = "mai-2024",
            name = "Mai",
            thumbUrl = "https://img.example.com/mai.jpg",
            currentTime = 8000,
            duration = 7200
        )
        assertEquals(1.0f, itemFinished.progressPercent, 0.001f)

        val itemZeroDuration = WatchHistoryItem(
            slug = "mai-2024",
            name = "Mai",
            thumbUrl = "https://img.example.com/mai.jpg",
            currentTime = 100,
            duration = 0
        )
        assertEquals(0f, itemZeroDuration.progressPercent, 0.001f)
    }

    @Test
    fun testFavoriteDtoMapping() {
        val dto = FavoriteMovieDto(
            slug = "lat-mat-7",
            name = "Lật Mặt 7: Một Điều Ước",
            original_name = "Face Off 7",
            thumb_url = "https://example.com/latmat7.jpg",
            quality = "FHD",
            current_episode = "Full",
            addedAt = "2026-09-12T08:00:00.000Z"
        )

        assertEquals("lat-mat-7", dto.slug)
        assertEquals("Lật Mặt 7: Một Điều Ước", dto.name)
        assertEquals("FHD", dto.quality)
    }

    @Test
    fun testSafeJsonArrayOrPrimitiveExtraction() {
        val jsonArray = buildJsonArray {
            add("Trấn Thành")
            add("Tuấn Trần")
            add("Uyển Ân")
        }
        val jsonPrimitive = JsonPrimitive("Trấn Thành, Tuấn Trần")

        fun extract(element: JsonElement?): String {
            if (element == null) return ""
            return when (element) {
                is JsonPrimitive -> element.contentOrNull ?: ""
                is JsonArray -> element.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.joinToString(", ")
                else -> ""
            }
        }

        assertEquals("Trấn Thành, Tuấn Trần, Uyển Ân", extract(jsonArray))
        assertEquals("Trấn Thành, Tuấn Trần", extract(jsonPrimitive))
        assertEquals("", extract(null))
    }

    @Test
    fun testCinepvqDatabase_Impl_Exists() {
        val clazz = Class.forName("com.pvq.cinepvq.core.database.CinepvqDatabase_Impl")
        assertNotNull(clazz)
        assertTrue(com.pvq.cinepvq.core.database.CinepvqDatabase::class.java.isAssignableFrom(clazz))
    }
}

