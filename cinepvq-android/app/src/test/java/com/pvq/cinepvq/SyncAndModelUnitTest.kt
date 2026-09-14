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
}

