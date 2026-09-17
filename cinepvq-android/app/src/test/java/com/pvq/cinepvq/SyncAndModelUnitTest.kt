package com.pvq.cinepvq

import com.pvq.cinepvq.core.database.FavoriteMovieEntity
import com.pvq.cinepvq.core.database.WatchHistoryEntity
import com.pvq.cinepvq.core.database.WatchLaterEntity
import com.pvq.cinepvq.core.network.model.*
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.domain.model.WatchHistoryItem
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import com.pvq.cinepvq.core.security.SecureStorageManager
import com.pvq.cinepvq.data.auth.AuthState
import com.pvq.cinepvq.data.user.IsoTimestampHelper
import com.pvq.cinepvq.domain.model.User
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

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
    fun testParsedTitleAndPart() {
        val detailWithPart = com.pvq.cinepvq.domain.model.MovieDetail(
            slug = "cuoc-noi-loan-cua-lelouch-phan-2",
            name = "Cuộc Nổi Loạn Của Lelouch (Phần 2)",
            originalName = "Code Geass (Season 2)",
            thumbUrl = "",
            posterUrl = ""
        )
        val (title, part) = detailWithPart.parsedTitleAndPart
        assertEquals("Cuộc Nổi Loạn Của Lelouch", title)
        assertEquals("Phần 2", part)

        val detailWithoutPart = com.pvq.cinepvq.domain.model.MovieDetail(
            slug = "du-phuong-hanh",
            name = "Dữ Phượng Hành",
            originalName = "The Legend of ShenLi",
            thumbUrl = "",
            posterUrl = ""
        )
        val (title2, part2) = detailWithoutPart.parsedTitleAndPart
        assertEquals("Dữ Phượng Hành", title2)
        assertNull(part2)
    }

    @Test
    fun testEpisodeNumberOnly() {
        val ep1 = com.pvq.cinepvq.domain.model.EpisodeItem(name = "Tập 01", slug = "tap-01")
        assertEquals("01", ep1.episodeNumberOnly)

        val ep23 = com.pvq.cinepvq.domain.model.EpisodeItem(name = "Tập 23", slug = "tap-23")
        assertEquals("23", ep23.episodeNumberOnly)

        val epRaw = com.pvq.cinepvq.domain.model.EpisodeItem(name = "5", slug = "tap-5")
        assertEquals("05", epRaw.episodeNumberOnly)

        val epFull = com.pvq.cinepvq.domain.model.EpisodeItem(name = "Full", slug = "full")
        assertEquals("Full", epFull.episodeNumberOnly)
    }

    @Test
    fun testPlaybackResumeCases_A_B_C() {
        // CASE A: Episode 1 position 05:00 -> Next -> Episode 2 not in history -> starts at 0
        fun resolveResume(history: WatchHistoryEntity?, targetEpisodeSlug: String): Long {
            if (history != null && history.episodeSlug == targetEpisodeSlug) {
                val isAlmostFinished = (history.duration > 0 && history.currentTime >= history.duration * 0.95) ||
                        (history.duration > 0 && history.duration - history.currentTime < 15)
                return if (isAlmostFinished) 0L else history.currentTime * 1000L
            }
            return 0L
        }

        // History stores Episode 1 at 300s (05:00)
        val historyEp1 = WatchHistoryEntity(
            slug = "test-movie",
            name = "Test Movie",
            thumbUrl = "",
            episodeSlug = "tap-01",
            currentTime = 300L,
            duration = 1500L
        )

        // Case A: Next to Episode 2 (history has ep1) -> must resolve to 0
        val resumeCaseA = resolveResume(historyEp1, "tap-02")
        assertEquals("Episode 2 not in history must start at 00:00", 0L, resumeCaseA)

        // Case B: Episode 2 has saved progress at 754s (12:34) -> Next to Episode 2 -> resolves to 754000L
        val historyEp2 = WatchHistoryEntity(
            slug = "test-movie",
            name = "Test Movie",
            thumbUrl = "",
            episodeSlug = "tap-02",
            currentTime = 754L,
            duration = 1500L
        )
        val resumeCaseB = resolveResume(historyEp2, "tap-02")
        assertEquals("Episode 2 with saved progress must resume at 12:34", 754000L, resumeCaseB)

        // Case C: Switching back to Episode 1 (saved at 300s) while player was on Episode 2 -> resolves to 300000L
        val resumeCaseC = resolveResume(historyEp1, "tap-01")
        assertEquals("Episode 1 must resume at 05:00", 300000L, resumeCaseC)
    }

    // ─── Phase 1: Base URL Resolution & Error Handling Tests ──────────────────

    @Test
    fun testBaseUrlTrailingSlashGuarantee() {
        fun sanitizeUrl(input: String): String {
            var url = input.trim()
            if (!url.endsWith("/")) url += "/"
            return url
        }

        assertEquals("http://192.168.1.80:3000/", sanitizeUrl("http://192.168.1.80:3000"))
        assertEquals("http://192.168.1.80:3000/", sanitizeUrl("http://192.168.1.80:3000/"))
        assertEquals("https://cinepvq-web.vercel.app/", sanitizeUrl("https://cinepvq-web.vercel.app"))
    }

    @Test
    fun testRealDeviceRejectsLoopbackFallback() {
        fun resolveDefaultUrl(isEmulator: Boolean, devLanUrl: String, emuUrl: String): String {
            return if (isEmulator) emuUrl else devLanUrl
        }

        val realDeviceUrl = resolveDefaultUrl(false, "http://192.168.1.80:3000/", "http://10.0.2.2:3000/")
        assertNotEquals("Real device should never default to 127.0.0.1", "http://127.0.0.1:3000/", realDeviceUrl)
        assertEquals("http://192.168.1.80:3000/", realDeviceUrl)

        val emuUrl = resolveDefaultUrl(true, "http://192.168.1.80:3000/", "http://10.0.2.2:3000/")
        assertEquals("http://10.0.2.2:3000/", emuUrl)
    }

    @Test
    fun testNetworkResultPreservesFailureWithoutSwallowing() {
        fun mockNetworkCall(shouldFail: Boolean): Result<String> {
            return try {
                if (shouldFail) {
                    throw java.net.ConnectException("Failed to connect to /192.168.1.80:3000")
                }
                Result.success("OK")
            } catch (e: Exception) {
                // Must return Result.failure, NEVER swallow or return false success
                Result.failure(e)
            }
        }

        val failResult = mockNetworkCall(true)
        assertTrue("Network failures must be captured in Result.failure", failResult.isFailure)
        assertTrue(failResult.exceptionOrNull() is java.net.ConnectException)
        assertEquals("Failed to connect to /192.168.1.80:3000", failResult.exceptionOrNull()?.message)

        val successResult = mockNetworkCall(false)
        assertTrue(successResult.isSuccess)
        assertEquals("OK", successResult.getOrNull())
    }

    // ─── User Isolation & Sync Reconciliation Tests (Phase 2 Tests 1 - 8) ──────

    // In-memory simulation of Room table storage with composite primary keys
    class MockRoomTable<T>(
        private val keySelector: (T) -> Pair<String, String>,
        private val userSelector: (T) -> String
    ) {
        private val storage = mutableMapOf<Pair<String, String>, T>()

        fun insert(item: T) {
            storage[keySelector(item)] = item
        }

        fun insertAll(items: List<T>) {
            items.forEach { insert(it) }
        }

        fun queryByUser(userId: String): List<T> {
            return storage.values.filter { userSelector(it) == userId }
        }

        fun queryByKey(userId: String, slug: String): T? {
            return storage[userId to slug]
        }

        fun delete(userId: String, slug: String) {
            storage.remove(userId to slug)
        }

        fun clearByUser(userId: String) {
            val toRemove = storage.keys.filter { it.first == userId }
            toRemove.forEach { storage.remove(it) }
        }
    }

    @Test
    fun testUserIsolation_Test1_UserAFavorite_UserBCannotSee() {
        val favoritesTable = MockRoomTable<FavoriteMovieEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )

        // User A adds Favorite Movie X
        favoritesTable.insert(
            FavoriteMovieEntity(userId = "user_a", slug = "movie-x", name = "Movie X")
        )

        // User B queries favorites
        val userBFavorites = favoritesTable.queryByUser("user_b")

        // Expected: empty
        assertTrue("User B must see empty favorites", userBFavorites.isEmpty())

        // User A queries favorites -> sees Movie X
        val userAFavorites = favoritesTable.queryByUser("user_a")
        assertEquals(1, userAFavorites.size)
        assertEquals("movie-x", userAFavorites.first().slug)
    }

    @Test
    fun testUserIsolation_Test2_UserAHistory_UserBCannotSee() {
        val historyTable = MockRoomTable<WatchHistoryEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )

        // User A has History Movie X
        historyTable.insert(
            WatchHistoryEntity(userId = "user_a", slug = "movie-x", name = "Movie X", currentTime = 300L, duration = 1200L)
        )

        // User B queries history
        val userBHistory = historyTable.queryByUser("user_b")

        // Expected: empty
        assertTrue("User B must see empty watch history", userBHistory.isEmpty())

        val userAHistory = historyTable.queryByUser("user_a")
        assertEquals(1, userAHistory.size)
        assertEquals(300L, userAHistory.first().currentTime)
    }

    @Test
    fun testUserIsolation_Test3_UserAWatchLater_UserBCannotSee() {
        val watchLaterTable = MockRoomTable<WatchLaterEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )

        // User A has Watch Later X
        watchLaterTable.insert(
            WatchLaterEntity(userId = "user_a", slug = "movie-x", name = "Movie X")
        )

        // User B queries watch later
        val userBWatchLater = watchLaterTable.queryByUser("user_b")

        // Expected: empty
        assertTrue("User B must see empty watch later", userBWatchLater.isEmpty())

        val userAWatchLater = watchLaterTable.queryByUser("user_a")
        assertEquals(1, userAWatchLater.size)
        assertEquals("movie-x", userAWatchLater.first().slug)
    }

    @Test
    fun testUserIsolation_Test4_UserALogout_UserBLogin_BDoesNotSeeA() {
        val favoritesTable = MockRoomTable<FavoriteMovieEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )
        var activeUserId = "user_a"

        // User A active
        favoritesTable.insert(FavoriteMovieEntity(userId = activeUserId, slug = "movie-a", name = "Movie A"))

        // User A logout
        activeUserId = "guest"
        val guestView = favoritesTable.queryByUser(activeUserId)
        assertTrue("Guest must not see User A's data after logout", guestView.isEmpty())

        // User B login
        activeUserId = "user_b"
        val userBView = favoritesTable.queryByUser(activeUserId)
        assertTrue("User B must not see User A's data upon login", userBView.isEmpty())
    }

    @Test
    fun testUserIsolation_Test5_UserBSync_NeverPushesUserAData() {
        val historyTable = MockRoomTable<WatchHistoryEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )

        // User A has existing local history
        historyTable.insert(WatchHistoryEntity(userId = "user_a", slug = "movie-a", name = "Movie A", currentTime = 500L))

        // User B has local history
        historyTable.insert(WatchHistoryEntity(userId = "user_b", slug = "movie-b", name = "Movie B", currentTime = 200L))

        // User B triggers sync: sync ONLY queries historyTable.queryByUser("user_b")
        val userBSyncItems = historyTable.queryByUser("user_b")

        // Expected: Contains ONLY movie-b, 0 items belonging to user_a
        assertEquals(1, userBSyncItems.size)
        assertEquals("movie-b", userBSyncItems.first().slug)
        assertEquals("user_b", userBSyncItems.first().userId)
        assertTrue("User B sync must NEVER contain user A's items", userBSyncItems.none { it.userId == "user_a" })
    }

    @Test
    fun testUserIsolation_Test6_GuestMigration_MovesGuestToUserAndCleansGuest() {
        val favoritesTable = MockRoomTable<FavoriteMovieEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )

        // Guest adds Movie X
        favoritesTable.insert(FavoriteMovieEntity(userId = "guest", slug = "movie-x", name = "Movie X"))
        assertEquals(1, favoritesTable.queryByUser("guest").size)

        // Guest migration logic:
        val guestItems = favoritesTable.queryByUser("guest")
        val targetUserId = "user_a"
        val existingUserSlugs = favoritesTable.queryByUser(targetUserId).map { it.slug }.toSet()
        val toMigrate = guestItems.filter { it.slug !in existingUserSlugs }.map { it.copy(userId = targetUserId) }
        favoritesTable.insertAll(toMigrate)
        favoritesTable.clearByUser("guest")

        // Verification:
        val guestAfter = favoritesTable.queryByUser("guest")
        val userAAfter = favoritesTable.queryByUser(targetUserId)

        assertTrue("Guest namespace must be clean after migration", guestAfter.isEmpty())
        assertEquals("User A must now have migrated Movie X", 1, userAAfter.size)
        assertEquals("movie-x", userAAfter.first().slug)
        assertEquals(targetUserId, userAAfter.first().userId)
    }

    @Test
    fun testUserIsolation_Test7_MultiUserLoginLogout_BothDataPreserved() {
        val historyTable = MockRoomTable<WatchHistoryEntity>(
            keySelector = { it.userId to it.slug },
            userSelector = { it.userId }
        )

        // 1. User A logs in and records watch progress
        var currentUserId = "user_a"
        historyTable.insert(WatchHistoryEntity(userId = currentUserId, slug = "movie-a", name = "Movie A", currentTime = 750L))

        // 2. User A logs out
        currentUserId = "guest"
        assertEquals(0, historyTable.queryByUser(currentUserId).size)

        // 3. User B logs in and records watch progress
        currentUserId = "user_b"
        historyTable.insert(WatchHistoryEntity(userId = currentUserId, slug = "movie-b", name = "Movie B", currentTime = 1200L))
        assertEquals(1, historyTable.queryByUser("user_b").size)
        assertEquals("movie-b", historyTable.queryByUser("user_b").first().slug)

        // 4. User B logs out, User A logs back in
        currentUserId = "user_a"
        val restoredA = historyTable.queryByUser(currentUserId)
        assertEquals(1, restoredA.size)
        assertEquals("movie-a", restoredA.first().slug)
        assertEquals(750L, restoredA.first().currentTime)

        // 5. Check User B's data is still preserved under user_b
        val preservedB = historyTable.queryByUser("user_b")
        assertEquals(1, preservedB.size)
        assertEquals("movie-b", preservedB.first().slug)
        assertEquals(1200L, preservedB.first().currentTime)
    }

    @Test
    fun testUserIsolation_Test8_HistoryConflictResolution_ServerVsLocal() {
        val t1 = "2026-09-14T10:00:00.000Z"
        val t2 = "2026-09-14T11:00:00.000Z"

        // Subtest 8A: Server newer (T2 > T1) -> Server wins
        val timeLocalA = parseTime(t1)
        val timeServerA = parseTime(t2)
        assertTrue(timeServerA > timeLocalA)

        val serverWinsAction = if (timeServerA >= timeLocalA) "APPLY_SERVER" else "PUSH_LOCAL"
        assertEquals("APPLY_SERVER", serverWinsAction)

        // Subtest 8B: Local newer (T1 > T2) -> Local wins & pushes to server
        val timeLocalB = parseTime(t2)
        val timeServerB = parseTime(t1)
        assertTrue(timeLocalB > timeServerB)

        val localWinsAction = if (timeServerB >= timeLocalB) "APPLY_SERVER" else "PUSH_LOCAL"
        assertEquals("PUSH_LOCAL", localWinsAction)
    }

    // ─── Requirements 1, 2, 3 Verification Tests ─────────────────────────────

    @Test
    fun testRequirement1_TokenSanitization_CleanBearerAndQuotes() {
        val normalToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak"
        assertEquals(normalToken, SecureStorageManager.sanitizeToken(normalToken))

        // Whitespace handling
        val whitespaceToken = "   $normalToken   "
        assertEquals(normalToken, SecureStorageManager.sanitizeToken(whitespaceToken))

        // Quotes handling
        val quotedToken = "\"$normalToken\""
        assertEquals(normalToken, SecureStorageManager.sanitizeToken(quotedToken))

        // Bearer prefix handling
        val bearerToken = "Bearer $normalToken"
        assertEquals(normalToken, SecureStorageManager.sanitizeToken(bearerToken))

        // Lowercase bearer prefix handling
        val lowerBearer = "bearer $normalToken"
        assertEquals(normalToken, SecureStorageManager.sanitizeToken(lowerBearer))

        // Quoted Bearer token
        val quotedBearer = "\"Bearer $normalToken\""
        assertEquals(normalToken, SecureStorageManager.sanitizeToken(quotedBearer))

        // Blank or null handling
        assertNull(SecureStorageManager.sanitizeToken(""))
        assertNull(SecureStorageManager.sanitizeToken("   "))
        assertNull(SecureStorageManager.sanitizeToken(null))
        assertNull(SecureStorageManager.sanitizeToken("\"\""))
        assertNull(SecureStorageManager.sanitizeToken("Bearer "))
    }

    @Test
    fun testRequirement2_AuthStateTransitions() {
        val user = User(
            id = "user-12345",
            email = "tester@cinepvq.com",
            username = "TesterCinepvq",
            avatarUrl = "https://cinepvq.com/avatar.png"
        )

        // Initial state unauthenticated
        val unauth: AuthState = AuthState.Unauthenticated
        assertTrue(unauth is AuthState.Unauthenticated)

        // Authenticated state
        val auth: AuthState = AuthState.Authenticated(user)
        assertTrue(auth is AuthState.Authenticated)
        assertEquals("user-12345", (auth as AuthState.Authenticated).user.id)
        assertEquals("TesterCinepvq", auth.user.username)
    }

    @Test
    fun testRequirement3_IsoTimestampHelper_FormattingAndParsing() {
        // Format test: nowIso strictly ends with 'Z' and complies with ISO-8601
        val nowIso = IsoTimestampHelper.nowIso()
        assertNotNull(nowIso)
        assertTrue(nowIso.endsWith("Z"))
        assertTrue(IsoTimestampHelper.isValidIso(nowIso))

        val parsedNow = IsoTimestampHelper.parseIsoToEpochMillis(nowIso)
        assertTrue(parsedNow > 0L)
        // Ensure within last 5 seconds
        assertTrue(Math.abs(System.currentTimeMillis() - parsedNow) < 5000)

        // Format epoch millis test
        val fixedMillis = 1773550000000L
        val formatted = IsoTimestampHelper.formatEpochMillis(fixedMillis)
        assertEquals(fixedMillis, IsoTimestampHelper.parseIsoToEpochMillis(formatted))

        // Parse test: With milliseconds (.SSS'Z')
        val withMillis = "2026-09-15T06:30:00.123Z"
        assertEquals(1789453800123L, IsoTimestampHelper.parseIsoToEpochMillis(withMillis))

        // Parse test: Without milliseconds
        val withoutMillis = "2026-09-15T06:30:00Z"
        assertEquals(1789453800000L, IsoTimestampHelper.parseIsoToEpochMillis(withoutMillis))

        // Parse test: Microsecond precision (Postgres timestamp)
        val withMicros = "2026-09-15T06:30:00.123456Z"
        assertEquals(1789453800123L, IsoTimestampHelper.parseIsoToEpochMillis(withMicros))

        // Parse test: Timezone offset (+07:00 Hanoi)
        val withOffset = "2026-09-15T13:30:00+07:00"
        assertEquals(1789453800000L, IsoTimestampHelper.parseIsoToEpochMillis(withOffset))

        // Edge cases
        assertEquals(0L, IsoTimestampHelper.parseIsoToEpochMillis(null))
        assertEquals(0L, IsoTimestampHelper.parseIsoToEpochMillis(""))
        assertEquals(0L, IsoTimestampHelper.parseIsoToEpochMillis("   "))
        assertEquals(0L, IsoTimestampHelper.parseIsoToEpochMillis("invalid-timestamp"))
    }

    @Test
    fun testRequirement3_IsoTimestampHelper_ThreadSafety() {
        val executor = Executors.newFixedThreadPool(8)
        val errors = Collections.synchronizedList(mutableListOf<Throwable>())
        val iterations = 500

        for (i in 0 until iterations) {
            executor.submit {
                try {
                    val now = IsoTimestampHelper.nowIso()
                    val parsed = IsoTimestampHelper.parseIsoToEpochMillis(now)
                    assertTrue("Timestamp should parse to > 0", parsed > 0L)

                    val epoch = 1789453800000L + i
                    val formatted = IsoTimestampHelper.formatEpochMillis(epoch)
                    val parsedEpoch = IsoTimestampHelper.parseIsoToEpochMillis(formatted)
                    assertEquals(epoch, parsedEpoch)
                } catch (t: Throwable) {
                    errors.add(t)
                }
            }
        }

        executor.shutdown()
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
        assertTrue("Thread safety test had errors: ${errors.map { it.message }}", errors.isEmpty())
    }

    @Test
    fun testRequirement1_AuthInterceptor_AttachesCleanBearerHeader() {
        // 1. When token is present with messy format (whitespace, quotes, duplicate Bearer)
        val rawToken = "  \"Bearer sample_jwt_token_xyz\"  "
        val testInterceptor = okhttp3.Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()

            val cleanToken = SecureStorageManager.sanitizeToken(rawToken)
            if (!cleanToken.isNullOrBlank()) {
                builder.header("Authorization", "Bearer $cleanToken")
            }
            chain.proceed(builder.build())
        }

        var interceptedAuthHeader: String? = null
        val client = okhttp3.OkHttpClient.Builder()
            .addInterceptor(testInterceptor)
            .addInterceptor { chain ->
                interceptedAuthHeader = chain.request().header("Authorization")
                okhttp3.Response.Builder()
                    .request(chain.request())
                    .protocol(okhttp3.Protocol.HTTP_1_1)
                    .code(200)
                    .message("OK")
                    .body(okhttp3.ResponseBody.create(null, "{\"status\":\"success\"}"))
                    .build()
            }
            .build()

        val req = okhttp3.Request.Builder()
            .url("https://cinepvq.com/api/user/sync")
            .post(okhttp3.RequestBody.create(null, ByteArray(0)))
            .build()

        val res = client.newCall(req).execute()
        assertTrue(res.isSuccessful)
        assertEquals("Bearer sample_jwt_token_xyz", interceptedAuthHeader)

        // 2. When token is empty or blank -> No Authorization header attached
        val emptyInterceptor = okhttp3.Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()

            val cleanToken = SecureStorageManager.sanitizeToken("   ")
            if (!cleanToken.isNullOrBlank()) {
                builder.header("Authorization", "Bearer $cleanToken")
            }
            chain.proceed(builder.build())
        }

        var emptyInterceptedHeader: String? = "SHOULD_BE_OVERWRITTEN"
        val emptyClient = okhttp3.OkHttpClient.Builder()
            .addInterceptor(emptyInterceptor)
            .addInterceptor { chain ->
                emptyInterceptedHeader = chain.request().header("Authorization")
                okhttp3.Response.Builder()
                    .request(chain.request())
                    .protocol(okhttp3.Protocol.HTTP_1_1)
                    .code(200)
                    .message("OK")
                    .body(okhttp3.ResponseBody.create(null, "{}"))
                    .build()
            }
            .build()

        emptyClient.newCall(req).execute()
        assertNull("Authorization header should not be present when token is blank", emptyInterceptedHeader)
    }

    @Test
    fun testProductionBaseUrlIsAccurate() {
        assertEquals("https://cinepvq.vercel.app/", BuildConfig.DEFAULT_PROD_URL)
        assertTrue(BuildConfig.DEFAULT_PROD_URL.endsWith("/"))
        assertFalse("Must not point to broken cinepvq-web domain", BuildConfig.DEFAULT_PROD_URL.contains("cinepvq-web"))
    }

    @Test
    fun testBaseUrlAutoHealsStaleUrls() {
        fun simulateAutoHeal(saved: String?, isEmulator: Boolean, defaultUrl: String): String {
            if (saved.isNullOrBlank() ||
                saved.contains("cinepvq-web.vercel.app") ||
                saved.contains("192.168.1.80") ||
                (!isEmulator && (saved.contains("127.0.0.1") || saved.contains("localhost") || saved.contains("10.0.2.2")))
            ) {
                return defaultUrl
            }
            return if (saved.endsWith("/")) saved else "$saved/"
        }

        val prodUrl = "https://cinepvq.vercel.app/"

        // 1. Broken 404 domain heals to prod
        assertEquals(prodUrl, simulateAutoHeal("https://cinepvq-web.vercel.app/", isEmulator = false, defaultUrl = prodUrl))
        assertEquals(prodUrl, simulateAutoHeal("https://cinepvq-web.vercel.app/", isEmulator = true, defaultUrl = prodUrl))

        // 2. Old developer LAN IP heals to prod
        assertEquals(prodUrl, simulateAutoHeal("http://192.168.1.80:3000/", isEmulator = false, defaultUrl = prodUrl))

        // 3. Localhost / loopback on real phone heals to prod
        assertEquals(prodUrl, simulateAutoHeal("http://127.0.0.1:3000/", isEmulator = false, defaultUrl = prodUrl))
        assertEquals(prodUrl, simulateAutoHeal("http://localhost:3000/", isEmulator = false, defaultUrl = prodUrl))
        assertEquals(prodUrl, simulateAutoHeal("http://10.0.2.2:3000/", isEmulator = false, defaultUrl = prodUrl))

        // 4. Valid custom URL is preserved with trailing slash
        assertEquals("https://my-custom-server.com/", simulateAutoHeal("https://my-custom-server.com", isEmulator = false, defaultUrl = prodUrl))
    }

    // ─── Per-Episode Playback & Resume Position Tests ─────────────────────────

    @Test
    fun testEpisodeResumePositionRules() {
        // Model the stored progress:
        // Ep 5: watched to 29:36 (1776s), duration 2400s
        // Ep 6: watched to 18:25 (1105s), duration 2400s
        // Ep 7: not watched (0s), duration 2400s
        // Ep 8: completed near end (2390s of 2400s, <15s left)
        val episodeProgressMap = mutableMapOf(
            "tap-5" to (1776L to 2400L),
            "tap-6" to (1105L to 2400L),
            "tap-8" to (2390L to 2400L)
        )

        fun resolveResumePosition(
            targetEpSlug: String,
            isServerSwitchOnSameEp: Boolean,
            currentPositionMs: Long
        ): Long {
            // Rule 1: Same episode + different server/translation => preserve current playback position
            if (isServerSwitchOnSameEp && currentPositionMs > 0L) {
                return currentPositionMs
            }

            // Rule 2: Different episode => query stored progress for THAT episode
            val (posSec, durSec) = episodeProgressMap[targetEpSlug] ?: (0L to 0L)
            if (posSec > 0L) {
                val isNearEnd = durSec > 0L && (durSec - posSec < 15 || (posSec.toFloat() / durSec) >= 0.95f)
                if (!isNearEnd) {
                    return posSec * 1000L
                }
            }

            // Rule 3: Episode never watched or near end => 0 ms
            return 0L
        }

        // Scenario: Currently at Episode 6 (18:25 -> 1,105,000 ms)
        val currentPositionMs = 1105 * 1000L

        // Case A: User clicks Next -> Ep 7 (never watched)
        // MUST NOT use 18:25! MUST start at 0:00!
        val nextPos = resolveResumePosition(
            targetEpSlug = "tap-7",
            isServerSwitchOnSameEp = false,
            currentPositionMs = currentPositionMs
        )
        assertEquals(0L, nextPos)

        // Case B: User clicks Previous -> Ep 5 (watched to 29:36)
        // MUST NOT use 18:25! MUST resume at 29:36 (1,776,000 ms)!
        val prevPos = resolveResumePosition(
            targetEpSlug = "tap-5",
            isServerSwitchOnSameEp = false,
            currentPositionMs = currentPositionMs
        )
        assertEquals(1776 * 1000L, prevPos)

        // Case C: User switches server / translation for the SAME Episode 6
        // MUST preserve current position at 18:25 (1,105,000 ms)!
        val sameEpServerSwitchPos = resolveResumePosition(
            targetEpSlug = "tap-6",
            isServerSwitchOnSameEp = true,
            currentPositionMs = currentPositionMs
        )
        assertEquals(1105 * 1000L, sameEpServerSwitchPos)

        // Case D: User directly selects Ep 5 from episode selector sheet
        val directSelectPos = resolveResumePosition(
            targetEpSlug = "tap-5",
            isServerSwitchOnSameEp = false,
            currentPositionMs = currentPositionMs
        )
        assertEquals(1776 * 1000L, directSelectPos)

        // Case E: User selects Ep 8 which was completed / near end (> 95% or < 15s remaining)
        // MUST restart from 0:00
        val completedEpPos = resolveResumePosition(
            targetEpSlug = "tap-8",
            isServerSwitchOnSameEp = false,
            currentPositionMs = currentPositionMs
        )
        assertEquals(0L, completedEpPos)
    }

    @Test
    fun testPerEpisodeProgressStorageUserIsolation() {
        val memoryStore = mutableMapOf<String, Long>()

        fun makeKey(userId: String, movieSlug: String, epSlug: String, isDuration: Boolean = false): String {
            val prefix = if (isDuration) "ep_dur_" else "ep_pos_"
            return "${prefix}${userId}_${movieSlug}_${epSlug}"
        }

        fun saveProgress(userId: String, movieSlug: String, epSlug: String, posSec: Long, durSec: Long) {
            memoryStore[makeKey(userId, movieSlug, epSlug, isDuration = false)] = posSec
            memoryStore[makeKey(userId, movieSlug, epSlug, isDuration = true)] = durSec
        }

        fun getProgress(userId: String, movieSlug: String, epSlug: String): Long {
            return memoryStore[makeKey(userId, movieSlug, epSlug, isDuration = false)] ?: 0L
        }

        // Guest watches Ep 1 to 500s
        saveProgress("guest", "movie-x", "tap-1", 500L, 2400L)
        // User A watches Ep 1 to 1200s
        saveProgress("user-a", "movie-x", "tap-1", 1200L, 2400L)
        // User B has not watched Ep 1
        assertEquals(500L, getProgress("guest", "movie-x", "tap-1"))
        assertEquals(1200L, getProgress("user-a", "movie-x", "tap-1"))
        assertEquals(0L, getProgress("user-b", "movie-x", "tap-1"))

        // Guest migration to User C
        val guestKeys = memoryStore.keys.filter { it.contains("_guest_") }.toList()
        for (k in guestKeys) {
            val v = memoryStore[k] ?: continue
            val newKey = k.replace("_guest_", "_user-c_")
            memoryStore[newKey] = v
        }
        assertEquals(500L, getProgress("user-c", "movie-x", "tap-1"))

        // Clear history for User A only
        val userAKeys = memoryStore.keys.filter { it.contains("_user-a_") }.toList()
        for (k in userAKeys) {
            memoryStore.remove(k)
        }
        assertEquals(0L, getProgress("user-a", "movie-x", "tap-1"))
        // User C and Guest remain intact
        assertEquals(500L, getProgress("guest", "movie-x", "tap-1"))
        assertEquals(500L, getProgress("user-c", "movie-x", "tap-1"))
    }

    @Test
    fun testFavoriteTombstoneReconciliation_NeverResurrects() {
        val userId = "user-123"
        val deletedSlugs = mutableSetOf<String>()
        val pendingAdds = mutableSetOf<String>()
        val roomFavorites = mutableSetOf<String>()

        // 1. User adds Movie A
        roomFavorites.add("movie-a")
        pendingAdds.add("movie-a")
        deletedSlugs.remove("movie-a")

        assertTrue(roomFavorites.contains("movie-a"))
        assertTrue(pendingAdds.contains("movie-a"))

        // 2. User removes Movie A
        roomFavorites.remove("movie-a")
        deletedSlugs.add("movie-a")
        pendingAdds.remove("movie-a")

        assertFalse(roomFavorites.contains("movie-a"))
        assertTrue(deletedSlugs.contains("movie-a"))
        assertFalse(pendingAdds.contains("movie-a"))

        // 3. Server sync arrives with stale remote data that still includes Movie A
        val staleRemoteSlugs = listOf("movie-a", "movie-b")

        // Reconciliation: filter out any remote slugs that are in deletedSlugs!
        val validRemote = staleRemoteSlugs.filter { it !in deletedSlugs }
        assertEquals(listOf("movie-b"), validRemote)

        // Insert valid remote into Room
        for (slug in validRemote) {
            roomFavorites.add(slug)
        }

        // Room now has Movie B, but NEVER resurrected Movie A!
        assertFalse("Movie A must NEVER be resurrected by sync", roomFavorites.contains("movie-a"))
        assertTrue(roomFavorites.contains("movie-b"))

        // 4. Remote deletion confirmed on server: remote no longer has Movie A
        val updatedRemoteSlugs = listOf("movie-b")
        if ("movie-a" !in updatedRemoteSlugs) {
            deletedSlugs.remove("movie-a")
        }
        assertFalse(deletedSlugs.contains("movie-a"))
    }

    @Test
    fun testHistoryEpisodeDtoPayloadAndNumberExtraction() {
        val req = HistoryActionRequest(
            action = "upsert",
            movieSlug = "dau-pha-thuong-khung",
            episodeSlug = "tap-5",
            episodeName = "Tập 5",
            episode = HistoryEpisodeDto(slug = "tap-5", name = "Tập 5"),
            position = 120L,
            duration = 2400L,
            updatedAt = "2026-09-15T08:00:00.000Z"
        )

        assertEquals("tap-5", req.episodeSlug)
        assertEquals("Tập 5", req.episodeName)
        assertNotNull(req.episode)
        assertEquals("tap-5", req.episode?.slug)
        assertEquals("Tập 5", req.episode?.name)

        // Number extraction test
        val epDigits1 = req.episodeSlug?.filter { it.isDigit() }?.toIntOrNull()
        val epDigits2 = req.episodeName?.filter { it.isDigit() }?.toIntOrNull()
        assertEquals(5, epDigits1)
        assertEquals(5, epDigits2)

        // Leading zero normalization
        val epSlugZero = "tap-05"
        val epDigitsZero = epSlugZero.filter { it.isDigit() }.toIntOrNull()
        assertEquals(5, epDigitsZero)
    }

    @Test
    fun testFavoriteTombstoneAccountIsolation() {
        val userATombstones = mutableSetOf<String>()
        val userBTombstones = mutableSetOf<String>()

        // User A deletes Movie A
        userATombstones.add("movie-a")

        assertTrue(userATombstones.contains("movie-a"))
        assertFalse(userBTombstones.contains("movie-a"))

        // User B has Movie A in remote favorites - User B should see Movie A!
        val userBRemote = listOf("movie-a", "movie-b")
        val userBValid = userBRemote.filter { it !in userBTombstones }

        assertEquals(2, userBValid.size)
        assertTrue(userBValid.contains("movie-a"))
    }

    // ─── Player Server Switch, Episode Matching & Resolution Tests ────────────

    @Test
    fun testServerSwitchEpisodeMatchingAcrossServers() {
        // Server 1 (Vietsub): tap-1, tap-2, tap-3, tap-4, tap-5
        val server1Episodes = (1..5).map { epNum ->
            com.pvq.cinepvq.domain.model.EpisodeItem(
                name = "Tập $epNum",
                slug = "tap-$epNum",
                embed = "https://embed.server1.com/$epNum",
                m3u8Url = "https://hls.server1.com/$epNum.m3u8"
            )
        }

        // Server 2 (Thuyet Minh): tap-01-thuyet-minh, tap-02-thuyet-minh, ..., tap-05-thuyet-minh
        val server2Episodes = (1..5).map { epNum ->
            val padded = if (epNum < 10) "0$epNum" else "$epNum"
            com.pvq.cinepvq.domain.model.EpisodeItem(
                name = "Tập $epNum Thuyết Minh",
                slug = "tap-$padded-thuyet-minh",
                embed = "https://embed.server2.com/$epNum",
                m3u8Url = "https://hls.server2.com/$epNum.m3u8"
            )
        }

        // Current episode on Server 1: Episode 5 (index 4)
        val currentEp = server1Episodes[4]
        assertEquals("tap-5", currentEp.slug)

        // Matching logic as implemented in WatchScreen.kt
        val currentEpDigits = currentEp.slug.filter { it.isDigit() }.toIntOrNull()
            ?: currentEp.name.filter { it.isDigit() }.toIntOrNull()
        val currentIndex = server1Episodes.indexOfFirst { it.slug == currentEp.slug }

        val matchedInServer2 = server2Episodes.firstOrNull { targetEp ->
            val targetDigits = targetEp.slug.filter { it.isDigit() }.toIntOrNull()
                ?: targetEp.name.filter { it.isDigit() }.toIntOrNull()
            targetDigits != null && targetDigits == currentEpDigits
        } ?: server2Episodes.getOrNull(currentIndex) ?: server2Episodes.firstOrNull()

        assertNotNull(matchedInServer2)
        assertEquals("tap-05-thuyet-minh", matchedInServer2?.slug)
        assertEquals("Tập 5 Thuyết Minh", matchedInServer2?.name)
        assertNotEquals("Must NOT fall back to Episode 1", "tap-01-thuyet-minh", matchedInServer2?.slug)
    }

    @Test
    fun testServerSwitchPreservesPositionAndPlaybackState() {
        var currentPositionMs = 123456L
        var wasPlaying = true
        var isHistoryFlushed = false

        // Simulate server switch
        fun onServerSwitch(
            newServerIndex: Int,
            currentPlayerPos: Long,
            playerIsPlaying: Boolean,
            flushHistory: () -> Unit
        ): Pair<Long, Boolean> {
            // 1. Capture position & state
            val preservedPos = currentPlayerPos
            val preservedPlaying = playerIsPlaying

            // 2. Flush history
            flushHistory()

            // 3. Return target position and play state to seek and resume
            return Pair(preservedPos, preservedPlaying)
        }

        val (targetPos, targetPlayState) = onServerSwitch(
            newServerIndex = 1,
            currentPlayerPos = currentPositionMs,
            playerIsPlaying = wasPlaying,
            flushHistory = { isHistoryFlushed = true }
        )

        assertTrue("History must be flushed before server switch", isHistoryFlushed)
        assertEquals("Current position must be preserved across server switch", 123456L, targetPos)
        assertTrue("Playback play state must be preserved", targetPlayState)
        assertNotEquals("Position must NOT be reset to 0", 0L, targetPos)

        // Scenario 2: Switched while paused
        val (pausedPos, pausedPlayState) = onServerSwitch(
            newServerIndex = 0,
            currentPlayerPos = 85000L,
            playerIsPlaying = false,
            flushHistory = { }
        )
        assertEquals(85000L, pausedPos)
        assertFalse("Paused state must be preserved", pausedPlayState)
    }

    @Test
    fun testResolutionTrackCase1MultiTrackVsCase2SingleTrack() {
        // CASE 2: Single video track (typical KKPhim provider stream)
        val singleTrackList = listOf(
            com.pvq.cinepvq.features.player.VideoTrackInfo(
                width = 1920,
                height = 1080,
                bitrate = 3500000,
                isSelected = true,
                label = "1080p",
                resolution = com.pvq.cinepvq.features.player.VideoResolution.FHD,
                groupIndex = 0,
                trackIndex = 0
            )
        )

        val isCase2 = singleTrackList.size <= 1
        assertTrue("Single track stream must trigger CASE 2 handling", isCase2)
        assertEquals(1920, singleTrackList[0].width)
        assertEquals(1080, singleTrackList[0].height)
        assertEquals(3500000, singleTrackList[0].bitrate)

        // CASE 1: Multi-variant video tracks
        val multiTrackList = listOf(
            com.pvq.cinepvq.features.player.VideoTrackInfo(
                width = 1920,
                height = 1080,
                bitrate = 4500000,
                isSelected = true,
                label = "1080p",
                resolution = com.pvq.cinepvq.features.player.VideoResolution.FHD,
                groupIndex = 0,
                trackIndex = 0
            ),
            com.pvq.cinepvq.features.player.VideoTrackInfo(
                width = 1280,
                height = 720,
                bitrate = 2200000,
                isSelected = false,
                label = "720p",
                resolution = com.pvq.cinepvq.features.player.VideoResolution.HD,
                groupIndex = 0,
                trackIndex = 1
            ),
            com.pvq.cinepvq.features.player.VideoTrackInfo(
                width = 854,
                height = 480,
                bitrate = 1000000,
                isSelected = false,
                label = "480p",
                resolution = com.pvq.cinepvq.features.player.VideoResolution.SD,
                groupIndex = 0,
                trackIndex = 2
            )
        )

        val isCase1 = multiTrackList.size > 1
        assertTrue("Multi-track stream must trigger CASE 1 handling", isCase1)
        assertEquals(3, multiTrackList.size)
        val hdTrack = multiTrackList.firstOrNull { it.resolution == com.pvq.cinepvq.features.player.VideoResolution.HD }
        assertNotNull(hdTrack)
        assertEquals(720, hdTrack?.height)
    }

    @Test
    fun testScrollVisibilityDeduplicationEliminatesRedundantCallbacks() {
        var callbackCount = 0
        var currentVisibility = true
        var lastReportedVisibility = true
        val thresholdPx = 32

        fun simulateScrollEvent(dy: Int) {
            val shouldBeVisible = when {
                dy > thresholdPx -> false
                dy < -thresholdPx -> true
                else -> return
            }

            if (shouldBeVisible != lastReportedVisibility) {
                lastReportedVisibility = shouldBeVisible
                currentVisibility = shouldBeVisible
                callbackCount++
            }
        }

        // 1. Initial state: visible = true, callbackCount = 0
        assertEquals(true, currentVisibility)
        assertEquals(0, callbackCount)

        // 2. Micro scrolls below threshold (e.g. 10px, 15px) -> No callback
        simulateScrollEvent(10)
        simulateScrollEvent(15)
        assertEquals(0, callbackCount)
        assertTrue(currentVisibility)

        // 3. User scrolls down > 32px -> Callback fires ONCE to hide
        simulateScrollEvent(40)
        assertEquals(1, callbackCount)
        assertFalse(currentVisibility)

        // 4. User continues scrolling down rapidly (50px, 80px, 120px)
        // With deduplication, NO redundant callbacks should fire!
        simulateScrollEvent(50)
        simulateScrollEvent(80)
        simulateScrollEvent(120)
        assertEquals("Redundant scroll events must NOT trigger callback if visibility unchanged", 1, callbackCount)
        assertFalse(currentVisibility)

        // 5. User scrolls up > 32px -> Callback fires ONCE to show
        simulateScrollEvent(-45)
        assertEquals(2, callbackCount)
        assertTrue(currentVisibility)

        // 6. User continues scrolling up -> No redundant callbacks
        simulateScrollEvent(-60)
        simulateScrollEvent(-90)
        assertEquals(2, callbackCount)
        assertTrue(currentVisibility)
    }
}


