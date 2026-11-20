package com.pvq.cinepvq.data.player

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import okhttp3.Call
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.URI
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * Pure Kotlin HLS Ad-Stripper, Manifest Resolver & Streaming PNG-Disguised MPEG-TS Unwrapper.
 * - Strips injected KKPhim1 commercial ad blocks (`/v9/<hash>/segment_0001.ts` inside
 *   `#EXT-X-DISCONTINUITY`) while preserving real movie segments including `convertv9/`.
 * - Extracts fresh inline HLS manifests from PhimHDCSS FHDC (`tiktok.phimhdc.com/embed/...`).
 * - Stream-unwraps fake PNG/image headers on MPEG-TS segments (VSMOV 478B, PhimHDCSS FHDC 76B)
 *   on the fly using a pooled HTTP/2 OkHttpClient so segments start playing with minimal TTFB!
 */
object HlsAdAndPngProcessor {

    data class AdStripResult(
        val cleaned: String,
        val removedSegments: Int,
        val removedSeconds: Double
    )

    private data class SegmentEntry(
        val extinfLine: String,
        val duration: Double,
        val uri: String,
        val extraTags: List<String>
    )

    private class ContinuitySection(
        val leadingTags: MutableList<String> = mutableListOf(),
        val segments: MutableList<SegmentEntry> = mutableListOf(),
        var hasKeyNone: Boolean = false
    )

    private val KNOWN_AD_PATH_RE = Regex(
        "(?:^|/)(?:v\\d+/[a-f0-9]{16,}/segment_\\d+\\.ts|ads?/|quangcao|promo/|preroll|midroll)",
        RegexOption.IGNORE_CASE
    )
    private val SEQUENTIAL_SEG_RE = Regex(
        "(?:^|/)segment_\\d+\\.(?:ts|png|jpg|jpeg|webp)$",
        RegexOption.IGNORE_CASE
    )
    private val RANDOM_ALNUM_TS_RE = Regex("^[A-Za-z0-9_-]{5,16}\\.ts(?:\\?.*)?$")
    private val CONVERT_WATERMARK_RE = Regex(
        "^convertv\\d+/[A-Za-z0-9_-]{5,16}\\.ts(?:\\?.*)?$",
        RegexOption.IGNORE_CASE
    )
    private val URI_ATTR_RE = Regex("""URI="([^"]+)"""")

    fun resolveUrlSafe(uri: String, baseUrl: String): String {
        return try {
            URI(baseUrl).resolve(uri).toString()
        } catch (_: Exception) {
            uri
        }
    }

    private fun getHostSafe(url: String): String {
        return try {
            URI(url).host?.lowercase() ?: ""
        } catch (_: Exception) {
            ""
        }
    }

    fun stripAdsFromM3u8(manifestText: String, mediaUrl: String): AdStripResult {
        val normalized = manifestText.replace("\r\n", "\n")
        if (!normalized.contains("#EXTINF:")) {
            return AdStripResult(normalized, 0, 0.0)
        }

        val rawLines = normalized.split("\n")
        val headerLines = mutableListOf<String>()
        val footerLines = mutableListOf<String>()
        val sections = mutableListOf<ContinuitySection>()

        var bodyStart = rawLines.size
        for (i in rawLines.indices) {
            val trimmed = rawLines[i].trim()
            if (trimmed.startsWith("#EXTINF:") ||
                trimmed == "#EXT-X-DISCONTINUITY" ||
                trimmed.startsWith("#EXT-X-KEY:")
            ) {
                bodyStart = i
                break
            }
            if (trimmed.isNotEmpty() && !trimmed.startsWith("#HDC-")) {
                headerLines.add(trimmed)
            }
        }

        var current = ContinuitySection()
        var pendingExtraTags = mutableListOf<String>()

        var i = bodyStart
        while (i < rawLines.size) {
            val line = rawLines[i].trim()
            if (line.isEmpty()) {
                i++
                continue
            }
            if (line == "#EXT-X-ENDLIST") {
                footerLines.add(line)
                i++
                continue
            }
            if (line == "#EXT-X-DISCONTINUITY") {
                if (current.segments.isNotEmpty() || current.leadingTags.isNotEmpty()) {
                    sections.add(current)
                    current = ContinuitySection()
                }
                pendingExtraTags = mutableListOf()
                i++
                continue
            }
            if (line.startsWith("#EXT-X-KEY:")) {
                if (line.contains("METHOD=NONE", ignoreCase = true)) {
                    current.hasKeyNone = true
                }
                if (current.segments.isEmpty()) {
                    current.leadingTags.add(line)
                } else {
                    pendingExtraTags.add(line)
                }
                i++
                continue
            }
            if (line.startsWith("#EXTINF:")) {
                val dur = line.substring(8).substringBefore(",").trim().toDoubleOrNull() ?: 0.0
                var uri = ""
                var j = i + 1
                while (j < rawLines.size) {
                    val candidate = rawLines[j].trim()
                    if (candidate.isEmpty()) {
                        j++
                        continue
                    }
                    if (candidate.startsWith("#")) {
                        if (!candidate.startsWith("#HDC-")) {
                            pendingExtraTags.add(candidate)
                        }
                        j++
                        continue
                    }
                    uri = candidate
                    break
                }
                if (uri.isNotEmpty()) {
                    current.segments.add(
                        SegmentEntry(
                            extinfLine = line,
                            duration = dur,
                            uri = uri,
                            extraTags = pendingExtraTags.toList()
                        )
                    )
                    pendingExtraTags = mutableListOf()
                    i = j + 1
                    continue
                }
            } else if (line.startsWith("#") && !line.startsWith("#HDC-")) {
                if (current.segments.isEmpty()) {
                    current.leadingTags.add(line)
                } else {
                    pendingExtraTags.add(line)
                }
            }
            i++
        }

        if (current.segments.isNotEmpty() || current.leadingTags.isNotEmpty()) {
            sections.add(current)
        }

        val baseHost = getHostSafe(mediaUrl)
        var totalSegments = 0
        var randomAlnumCount = 0
        for (sec in sections) {
            for (seg in sec.segments) {
                totalSegments++
                if (RANDOM_ALNUM_TS_RE.matches(seg.uri)) {
                    randomAlnumCount++
                }
            }
        }
        val mainUsesRandomAlnum = totalSegments >= 20 && randomAlnumCount.toDouble() / totalSegments > 0.65

        var removedSegments = 0
        var removedSeconds = 0.0
        val keptSections = mutableListOf<ContinuitySection>()

        sections.forEachIndexed { idx, sec ->
            if (sec.segments.isEmpty()) return@forEachIndexed

            // Strictly preserve real movie watermarked scenes (`convertv9/...`)
            if (sec.segments.all { CONVERT_WATERMARK_RE.matches(it.uri) }) {
                keptSections.add(sec)
                return@forEachIndexed
            }

            val sectionDuration = sec.segments.sumOf { it.duration }
            val isShortSection = sec.segments.size <= 25 &&
                sectionDuration <= 110.0 &&
                totalSegments > sec.segments.size * 3

            var isAdSection = false
            if (isShortSection) {
                val hasKnownAdPath = sec.segments.all { KNOWN_AD_PATH_RE.containsMatchIn(it.uri) }
                val allRootRelative = sec.segments.all { it.uri.startsWith("/") }
                val allSequentialSeg = sec.segments.all { SEQUENTIAL_SEG_RE.containsMatchIn(it.uri) }
                val allDifferentHost = sec.segments.all { s ->
                    if (!s.uri.startsWith("http://", ignoreCase = true) &&
                        !s.uri.startsWith("https://", ignoreCase = true)
                    ) {
                        false
                    } else {
                        val h = getHostSafe(s.uri)
                        h.isNotEmpty() && baseHost.isNotEmpty() && h != baseHost
                    }
                }

                isAdSection = when {
                    hasKnownAdPath -> true
                    mainUsesRandomAlnum && allSequentialSeg -> true
                    mainUsesRandomAlnum && allRootRelative && sec.hasKeyNone -> true
                    mainUsesRandomAlnum && allDifferentHost && idx > 0 -> true
                    else -> false
                }
            }

            if (isAdSection) {
                removedSegments += sec.segments.size
                removedSeconds += sectionDuration
            } else {
                keptSections.add(sec)
            }
        }

        val out = StringBuilder()
        for (h in headerLines) out.append(h).append('\n')
        keptSections.forEachIndexed { idx, sec ->
            if (idx > 0) out.append("#EXT-X-DISCONTINUITY\n")
            for (tag in sec.leadingTags) out.append(tag).append('\n')
            for (seg in sec.segments) {
                for (extra in seg.extraTags) out.append(extra).append('\n')
                out.append(seg.extinfLine).append('\n')
                out.append(seg.uri).append('\n')
            }
        }
        for (f in footerLines) out.append(f).append('\n')
        if (!footerLines.contains("#EXT-X-ENDLIST") && normalized.contains("#EXT-X-ENDLIST")) {
            out.append("#EXT-X-ENDLIST\n")
        }

        return AdStripResult(
            cleaned = out.toString(),
            removedSegments = removedSegments,
            removedSeconds = kotlin.math.round(removedSeconds * 10.0) / 10.0
        )
    }

    fun resolveManifestUrls(manifestText: String, baseUrl: String): String {
        val lines = manifestText.replace("\r\n", "\n").split("\n")
        val out = StringBuilder(manifestText.length + 512)
        for (raw in lines) {
            val trimmed = raw.trim()
            if (trimmed.isEmpty() || trimmed.startsWith("#HDC-")) continue
            if (trimmed.startsWith("#")) {
                if (trimmed.contains("URI=\"")) {
                    val replaced = URI_ATTR_RE.replace(trimmed) { mr ->
                        val rel = mr.groupValues[1]
                        """URI="${resolveUrlSafe(rel, baseUrl)}""""
                    }
                    out.append(replaced).append('\n')
                } else {
                    out.append(trimmed).append('\n')
                }
            } else {
                out.append(resolveUrlSafe(trimmed, baseUrl)).append('\n')
            }
        }
        return out.toString()
    }

    fun extractPhimHdcssManifestFromHtml(html: String): String? {
        val regex = Regex(""""manifest"\s*:\s*"(#EXTM3U(?:\\.|[^"\\])*)"""")
        val match = regex.find(html) ?: return null
        val escaped = match.groupValues[1]
        val unescaped = StringBuilder(escaped.length)
        var i = 0
        while (i < escaped.length) {
            val c = escaped[i]
            if (c == '\\' && i + 1 < escaped.length) {
                when (val next = escaped[i + 1]) {
                    'n' -> { unescaped.append('\n'); i += 2 }
                    'r' -> { unescaped.append('\r'); i += 2 }
                    't' -> { unescaped.append('\t'); i += 2 }
                    '"' -> { unescaped.append('"'); i += 2 }
                    '\\' -> { unescaped.append('\\'); i += 2 }
                    '/' -> { unescaped.append('/'); i += 2 }
                    'u' -> {
                        if (i + 5 < escaped.length) {
                            val code = escaped.substring(i + 2, i + 6).toIntOrNull(16)
                            if (code != null) {
                                unescaped.append(code.toChar())
                                i += 6
                            } else {
                                unescaped.append(c); i++
                            }
                        } else {
                            unescaped.append(c); i++
                        }
                    }
                    else -> { unescaped.append(next); i += 2 }
                }
            } else {
                unescaped.append(c)
                i++
            }
        }
        val result = unescaped.toString()
        return if (result.contains("#EXTM3U")) result else null
    }

    /**
     * If a master HLS manifest contains exactly ONE `#EXT-X-STREAM-INF` variant
     * and no separate `#EXT-X-MEDIA:` audio/subtitle renditions, returns the resolved
     * child media playlist URL so SmartHlsDataSource can flatten it in 1 round-trip!
     */
    fun extractSingleVariantUrl(manifestText: String, baseUrl: String): String? {
        val normalized = manifestText.replace("\r\n", "\n")
        if (normalized.contains("#EXTINF:") || normalized.contains("#EXT-X-MEDIA:")) {
            return null
        }
        val lines = normalized.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        val variants = mutableListOf<String>()
        var i = 0
        while (i < lines.size) {
            if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
                var j = i + 1
                while (j < lines.size) {
                    if (!lines[j].startsWith("#")) {
                        variants.add(resolveUrlSafe(lines[j], baseUrl))
                        i = j
                        break
                    }
                    j++
                }
            }
            i++
        }
        return if (variants.size == 1) variants[0] else null
    }

    /**
     * Finds the starting MPEG-TS packet offset (0x47 sync byte repeated at +188 and +376)
     * inside an initial header buffer, returning 0 if already MPEG-TS or not a disguised image.
     */
    fun findTsSyncOffsetInHeader(buf: ByteArray, validLen: Int = buf.size): Int {
        if (validLen < 377) return 0

        if ((buf[0].toInt() and 0xFF) == 0x47 &&
            (buf[188].toInt() and 0xFF) == 0x47 &&
            (buf[376].toInt() and 0xFF) == 0x47
        ) {
            return 0
        }

        val b0 = buf[0].toInt() and 0xFF
        val b1 = buf[1].toInt() and 0xFF
        val b2 = buf[2].toInt() and 0xFF
        val b3 = buf[3].toInt() and 0xFF

        val isPng = b0 == 0x89 && b1 == 0x50 && b2 == 0x4E && b3 == 0x47
        val isGif = b0 == 0x47 && b1 == 0x49 && b2 == 0x46
        val isJpg = b0 == 0xFF && b1 == 0xD8
        val isWebp = b0 == 0x52 && b1 == 0x49 && b2 == 0x46 && b3 == 0x46

        if (!isPng && !isGif && !isJpg && !isWebp) {
            return 0
        }

        val maxScan = min(validLen - 377, 8192)
        for (i in 1..maxScan) {
            if ((buf[i].toInt() and 0xFF) == 0x47 &&
                (buf[i + 188].toInt() and 0xFF) == 0x47 &&
                (buf[i + 376].toInt() and 0xFF) == 0x47
            ) {
                return i
            }
        }
        return 0
    }

    /**
     * Unwraps multi-chunk PNG `stEg` containers (used by PhimHDCSS FHDC / ibyteimg):
     * extracts every `stEg` chunk payload (skipping the 12-byte custom header) into
     * a continuous 188-byte-aligned MPEG-TS byte array. Returns null if no `stEg` chunk exists.
     */
    fun unwrapStegPngChunks(buf: ByteArray): ByteArray? {
        if (buf.size < 24) return null
        val isPng = (buf[0].toInt() and 0xFF) == 0x89 &&
            (buf[1].toInt() and 0xFF) == 0x50 &&
            (buf[2].toInt() and 0xFF) == 0x4E &&
            (buf[3].toInt() and 0xFF) == 0x47 &&
            (buf[4].toInt() and 0xFF) == 0x0D &&
            (buf[5].toInt() and 0xFF) == 0x0A &&
            (buf[6].toInt() and 0xFF) == 0x1A &&
            (buf[7].toInt() and 0xFF) == 0x0A
        if (!isPng) return null

        val parts = mutableListOf<Pair<Int, Int>>()
        var pos = 8
        while (pos + 12 <= buf.size) {
            val len = (((buf[pos].toInt() and 0xFF) shl 24) or
                ((buf[pos + 1].toInt() and 0xFF) shl 16) or
                ((buf[pos + 2].toInt() and 0xFF) shl 8) or
                (buf[pos + 3].toInt() and 0xFF)).toLong()
            val b4 = buf[pos + 4].toInt() and 0xFF
            val b5 = buf[pos + 5].toInt() and 0xFF
            val b6 = buf[pos + 6].toInt() and 0xFF
            val b7 = buf[pos + 7].toInt() and 0xFF
            val isAscii = isAsciiLetter(b4) && isAsciiLetter(b5) && isAsciiLetter(b6) && isAsciiLetter(b7)
            if (!isAscii || len < 0 || pos + 12L + len > buf.size) break

            val chunkLen = len.toInt()
            // "stEg" = 0x73, 0x74, 0x45, 0x67
            if (b4 == 0x73 && b5 == 0x74 && b6 == 0x45 && b7 == 0x67 && chunkLen > 12) {
                parts.add((pos + 20) to (chunkLen - 12))
            }
            pos += 12 + chunkLen
            // "IEND" = 0x49, 0x45, 0x4E, 0x44
            if (b4 == 0x49 && b5 == 0x45 && b6 == 0x4E && b7 == 0x44) break
        }
        if (parts.isEmpty()) return null

        val total = parts.sumOf { it.second }
        val aligned = total - (total % 188)
        if (aligned <= 0) return null
        val out = ByteArray(aligned)
        var outOffset = 0
        for ((srcOff, srcLen) in parts) {
            val toCopy = min(srcLen, aligned - outOffset)
            if (toCopy <= 0) break
            System.arraycopy(buf, srcOff, out, outOffset, toCopy)
            outOffset += toCopy
        }
        return out
    }

    /**
     * Peeks an initial header probe buffer to detect whether this PNG stream uses `stEg` chunks.
     * Returns Pair(payloadStartOffset, firstChunkRemainingBytes) or null if not a `stEg` PNG.
     */
    fun detectFirstStegChunk(buf: ByteArray, validLen: Int): Pair<Int, Int>? {
        if (validLen < 80) return null
        val isPng = (buf[0].toInt() and 0xFF) == 0x89 &&
            (buf[1].toInt() and 0xFF) == 0x50 &&
            (buf[2].toInt() and 0xFF) == 0x4E &&
            (buf[3].toInt() and 0xFF) == 0x47
        if (!isPng) return null

        var pos = 8
        while (pos + 20 <= validLen) {
            val len = (((buf[pos].toInt() and 0xFF) shl 24) or
                ((buf[pos + 1].toInt() and 0xFF) shl 16) or
                ((buf[pos + 2].toInt() and 0xFF) shl 8) or
                (buf[pos + 3].toInt() and 0xFF)).toLong()
            val b4 = buf[pos + 4].toInt() and 0xFF
            val b5 = buf[pos + 5].toInt() and 0xFF
            val b6 = buf[pos + 6].toInt() and 0xFF
            val b7 = buf[pos + 7].toInt() and 0xFF
            val isAscii = isAsciiLetter(b4) && isAsciiLetter(b5) && isAsciiLetter(b6) && isAsciiLetter(b7)
            if (!isAscii || len < 0) break

            val chunkLen = len.toInt()
            if (b4 == 0x73 && b5 == 0x74 && b6 == 0x45 && b7 == 0x67 && chunkLen > 12) {
                val payloadStart = pos + 20
                if (payloadStart <= validLen) {
                    return payloadStart to (chunkLen - 12)
                }
                return null
            }
            if (pos + 12L + chunkLen > validLen) break
            pos += 12 + chunkLen
            if (b4 == 0x49 && b5 == 0x45 && b6 == 0x4E && b7 == 0x44) break
        }
        return null
    }

    private fun isAsciiLetter(b: Int): Boolean = (b in 65..90) || (b in 97..122)

    /**
     * Unwraps PNG-disguised MPEG-TS (both multi-chunk PNG `stEg` containers and single-header PNGs).
     */
    fun stripPngPrefixFromTs(buf: ByteArray): ByteArray {
        unwrapStegPngChunks(buf)?.let { return it }

        val tsOffset = findTsSyncOffsetInHeader(buf, buf.size)
        if (tsOffset <= 0) return buf

        val remaining = buf.size - tsOffset
        val alignedLen = remaining - (remaining % 188)
        if (alignedLen <= 0) return buf
        return buf.copyOfRange(tsOffset, tsOffset + alignedLen)
    }
}

@UnstableApi
class SmartHlsDataSourceFactory(
    private val defaultHeaders: Map<String, String> = emptyMap(),
    private val stripAds: Boolean = true,
    private val stripPng: Boolean = false,
    private val okHttpClient: OkHttpClient = SHARED_MEDIA_OKHTTP_CLIENT
) : DataSource.Factory {

    companion object {
        private const val DEFAULT_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        val SHARED_MEDIA_OKHTTP_CLIENT: OkHttpClient by lazy {
            OkHttpClient.Builder()
                .connectionPool(ConnectionPool(16, 5, TimeUnit.MINUTES))
                .connectTimeout(12, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .writeTimeout(12, TimeUnit.SECONDS)
                .followRedirects(true)
                .followSslRedirects(true)
                .retryOnConnectionFailure(true)
                .build()
        }

        private const val MANIFEST_CACHE_TTL_MS = 3 * 60 * 1000L
        private const val MAX_MANIFEST_CACHE = 150
        private val manifestCache = java.util.concurrent.ConcurrentHashMap<String, Pair<ByteArray, Long>>()

        internal fun getCachedManifest(key: String): ByteArray? {
            val hit = manifestCache[key] ?: return null
            if (hit.second > System.currentTimeMillis()) return hit.first
            manifestCache.remove(key)
            return null
        }

        internal fun putCachedManifest(key: String, bytes: ByteArray) {
            if (manifestCache.size >= MAX_MANIFEST_CACHE) {
                manifestCache.clear()
            }
            manifestCache[key] = bytes to (System.currentTimeMillis() + MANIFEST_CACHE_TTL_MS)
        }
    }

    override fun createDataSource(): DataSource {
        return SmartHlsDataSource(
            client = okHttpClient,
            defaultHeaders = defaultHeaders,
            defaultUserAgent = defaultHeaders["User-Agent"] ?: DEFAULT_UA,
            stripAds = stripAds,
            stripPng = stripPng
        )
    }
}

@UnstableApi
private class SmartHlsDataSource(
    private val client: OkHttpClient,
    private val defaultHeaders: Map<String, String>,
    private val defaultUserAgent: String,
    private val stripAds: Boolean,
    private val stripPng: Boolean
) : DataSource {

    private val transferListeners = mutableListOf<TransferListener>()
    private var activeDataSpec: DataSpec? = null
    private var activeCall: Call? = null
    private var activeResponse: Response? = null
    private var activeStream: InputStream? = null

    // Mode A: Small text manifest buffer (M3U8 / FHDC embed HTML)
    private var bufferedBytes: ByteArray? = null
    private var readOffset: Int = 0
    private var bytesRemaining: Int = 0

    // Mode B: Low-latency streaming prefix buffer for PNG-TS header unwrap & stEg chunk streaming
    private var streamPrefixBytes: ByteArray? = null
    private var streamPrefixOffset: Int = 0
    private var streamPrefixRemaining: Int = 0
    private var isStegStream: Boolean = false
    private var stegRemainingInChunk: Int = 0
    private var stegEof: Boolean = false

    private var currentUri: Uri? = null
    private var responseHeaders: Map<String, List<String>> = emptyMap()
    private var opened: Boolean = false

    override fun addTransferListener(transferListener: TransferListener) {
        if (!transferListeners.contains(transferListener)) {
            transferListeners.add(transferListener)
        }
    }

    override fun open(dataSpec: DataSpec): Long {
        closeInternal()
        activeDataSpec = dataSpec
        currentUri = dataSpec.uri
        transferListeners.forEach { it.onTransferInitializing(this, dataSpec, true) }

        val url = dataSpec.uri.toString()
        val lower = url.lowercase()

        val isPhimHdcssEmbed = lower.contains("phimhdc.com/embed/")
        val isManifestUrl = lower.contains(".m3u8") || lower.contains("/m3u8") ||
            lower.contains("hls-proxy")
        val isPotentialPngSegment = stripPng && !isManifestUrl && !isPhimHdcssEmbed && (
            lower.contains(".png") ||
                lower.contains(".jpg") ||
                lower.contains(".jpeg") ||
                lower.contains(".webp") ||
                lower.contains(".gif") ||
                lower.contains("ibyteimg.com") ||
                lower.contains("tiktokcdn.com") ||
                lower.contains("streamvsmov.com")
            )

        val needsTextRewrite = isPhimHdcssEmbed || isManifestUrl

        // Fast 0ms in-memory manifest cache hit (skips full RTT on seek / revisit / source return)
        val manifestCacheKey = if (needsTextRewrite) "$url|$stripAds|$stripPng" else null
        if (manifestCacheKey != null) {
            val cached = SmartHlsDataSourceFactory.getCachedManifest(manifestCacheKey)
            if (cached != null) {
                val startPos = dataSpec.position.toInt().coerceIn(0, cached.size)
                val avail = cached.size - startPos
                val requestedLen = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
                    min(avail, dataSpec.length.toInt().coerceAtLeast(0))
                } else {
                    avail
                }
                bufferedBytes = cached
                readOffset = startPos
                bytesRemaining = requestedLen
                opened = true
                transferListeners.forEach { it.onTransferStart(this, dataSpec, true) }
                return requestedLen.toLong()
            }
        }

        val reqBuilder = Request.Builder()
            .url(url)
            .header("User-Agent", defaultUserAgent)
            .header("Accept", "*/*")

        defaultHeaders.forEach { (k, v) ->
            if (!k.equals("User-Agent", ignoreCase = true) && v.isNotBlank()) {
                reqBuilder.header(k, v)
            }
        }
        dataSpec.httpRequestHeaders.forEach { (k, v) ->
            reqBuilder.header(k, v)
        }

        // Apply HTTP Range header for direct passthrough streams (never for full-text manifest rewrite or PNG header probe)
        if (!needsTextRewrite && !isPotentialPngSegment) {
            if (dataSpec.position > 0L || dataSpec.length != C.LENGTH_UNSET.toLong()) {
                val rangeStart = dataSpec.position
                val rangeValue = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
                    "bytes=$rangeStart-${rangeStart + dataSpec.length - 1}"
                } else {
                    "bytes=$rangeStart-"
                }
                reqBuilder.header("Range", rangeValue)
            }
        }

        val call = client.newCall(reqBuilder.build())
        activeCall = call
        val response = call.execute()
        activeResponse = response

        if (!response.isSuccessful) {
            val code = response.code
            closeInternal()
            throw IOException("HTTP $code while loading $url")
        }

        currentUri = Uri.parse(response.request.url.toString())
        responseHeaders = response.headers.toMultimap()
        val body = response.body ?: run {
            closeInternal()
            throw IOException("Empty response body for $url")
        }

        val finalUrl = currentUri?.toString() ?: url

        // ── Mode A: Tiny Manifest / FHDC Embed HTML (buffered once, ~10-60KB) ──
        if (needsTextRewrite) {
            val rawBytes = body.bytes()
            response.close()
            activeResponse = null
            activeCall = null

            val processed: ByteArray = when {
                isPhimHdcssEmbed -> {
                    val html = rawBytes.toString(Charsets.UTF_8)
                    val manifest = HlsAdAndPngProcessor.extractPhimHdcssManifestFromHtml(html)
                        ?: throw IOException("PhimHDCSS FHDC manifest not found")
                    HlsAdAndPngProcessor.resolveManifestUrls(manifest, finalUrl).toByteArray(Charsets.UTF_8)
                }
                looksLikeM3u8(rawBytes) -> {
                    var text = rawBytes.toString(Charsets.UTF_8)
                    var resolvedBase = finalUrl

                    // Single-Variant Master Flattening: collapse master -> single media playlist in 1 ExoPlayer prepare!
                    val singleChildUrl = HlsAdAndPngProcessor.extractSingleVariantUrl(text, resolvedBase)
                    if (singleChildUrl != null) {
                        try {
                            val childReq = Request.Builder()
                                .url(singleChildUrl)
                                .header("User-Agent", defaultUserAgent)
                                .header("Accept", "*/*")
                                .apply {
                                    defaultHeaders.forEach { (k, v) ->
                                        if (!k.equals("User-Agent", ignoreCase = true) && v.isNotBlank()) {
                                            header(k, v)
                                        }
                                    }
                                }
                                .build()
                            client.newCall(childReq).execute().use { childRes ->
                                if (childRes.isSuccessful) {
                                    val childText = childRes.body?.string()
                                    if (!childText.isNullOrBlank() && childText.contains("#EXTM3U") && childText.contains("#EXTINF:")) {
                                        text = childText
                                        resolvedBase = childRes.request.url.toString()
                                    }
                                }
                            }
                        } catch (_: Exception) {}
                    }

                    val cleaned = if (stripAds) {
                        HlsAdAndPngProcessor.stripAdsFromM3u8(text, resolvedBase).cleaned
                    } else {
                        text
                    }
                    HlsAdAndPngProcessor.resolveManifestUrls(cleaned, resolvedBase).toByteArray(Charsets.UTF_8)
                }
                stripPng -> HlsAdAndPngProcessor.stripPngPrefixFromTs(rawBytes)
                else -> rawBytes
            }

            if (manifestCacheKey != null && processed.isNotEmpty()) {
                SmartHlsDataSourceFactory.putCachedManifest(manifestCacheKey, processed)
            }

            val startPos = dataSpec.position.toInt().coerceIn(0, processed.size)
            val avail = processed.size - startPos
            val requestedLen = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
                min(avail, dataSpec.length.toInt().coerceAtLeast(0))
            } else {
                avail
            }

            bufferedBytes = processed
            readOffset = startPos
            bytesRemaining = requestedLen
            opened = true
            transferListeners.forEach { it.onTransferStart(this, dataSpec, true) }
            return requestedLen.toLong()
        }

        // ── Mode B: Streaming PNG-Header Unwrap (only peeks <= 8KB, ZERO full-segment stall!) ──
        val inputStream = body.byteStream()
        activeStream = inputStream
        val contentLen = body.contentLength()

        if (isPotentialPngSegment) {
            val headerProbe = ByteArray(8192)
            var filled = 0
            while (filled < 2048) {
                val n = inputStream.read(headerProbe, filled, headerProbe.size - filled)
                if (n <= 0) break
                filled += n
                val earlySteg = HlsAdAndPngProcessor.detectFirstStegChunk(headerProbe, filled)
                if (earlySteg != null) break
                if (filled >= 1024 && HlsAdAndPngProcessor.findTsSyncOffsetInHeader(headerProbe, filled) > 0) {
                    break
                }
            }

            val stegInfo = HlsAdAndPngProcessor.detectFirstStegChunk(headerProbe, filled)
            if (stegInfo != null) {
                isStegStream = true
                stegEof = false
                val (payloadStart, chunkPayloadLen) = stegInfo
                stegRemainingInChunk = chunkPayloadLen
                if (payloadStart < filled) {
                    streamPrefixBytes = headerProbe
                    streamPrefixOffset = payloadStart
                    streamPrefixRemaining = filled - payloadStart
                }
            } else {
                isStegStream = false
                val tsOffset = HlsAdAndPngProcessor.findTsSyncOffsetInHeader(headerProbe, filled)
                if (tsOffset > 0 && tsOffset < filled) {
                    streamPrefixBytes = headerProbe
                    streamPrefixOffset = tsOffset
                    streamPrefixRemaining = filled - tsOffset
                } else if (filled > 0) {
                    streamPrefixBytes = headerProbe
                    streamPrefixOffset = 0
                    streamPrefixRemaining = filled
                }
            }
            opened = true
            transferListeners.forEach { it.onTransferStart(this, dataSpec, true) }
            return C.LENGTH_UNSET.toLong()
        }

        // ── Mode C: Direct Pooled HTTP/2 Streaming Passthrough (KKPhim1 / K20 / ChoPhim .ts) ──
        opened = true
        transferListeners.forEach { it.onTransferStart(this, dataSpec, true) }
        return if (contentLen >= 0L) contentLen else C.LENGTH_UNSET.toLong()
    }

    private fun looksLikeM3u8(bytes: ByteArray): Boolean {
        if (bytes.size < 7) return false
        val prefix = bytes.copyOfRange(0, min(bytes.size, 32)).toString(Charsets.UTF_8).trimStart()
        return prefix.startsWith("#EXTM3U")
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0

        // Mode A: In-memory rewritten manifest
        val local = bufferedBytes
        if (local != null) {
            if (bytesRemaining <= 0) return C.RESULT_END_OF_INPUT
            val toCopy = min(length, bytesRemaining)
            System.arraycopy(local, readOffset, buffer, offset, toCopy)
            readOffset += toCopy
            bytesRemaining -= toCopy
            activeDataSpec?.let { spec ->
                transferListeners.forEach { it.onBytesTransferred(this, spec, true, toCopy) }
            }
            return toCopy
        }

        // Mode B streaming stEg chunk unwrapper (PhimHDCSS FHDC: strips 4B CRC + next chunk headers every 1 MiB)
        if (isStegStream) {
            if (stegEof) return C.RESULT_END_OF_INPUT
            while (stegRemainingInChunk <= 0) {
                if (!advanceToNextStegChunk()) {
                    stegEof = true
                    return C.RESULT_END_OF_INPUT
                }
            }
            val maxWant = min(length, stegRemainingInChunk)
            val prefix = streamPrefixBytes
            val got = if (prefix != null && streamPrefixRemaining > 0) {
                val n = min(maxWant, streamPrefixRemaining)
                System.arraycopy(prefix, streamPrefixOffset, buffer, offset, n)
                streamPrefixOffset += n
                streamPrefixRemaining -= n
                if (streamPrefixRemaining == 0) streamPrefixBytes = null
                n
            } else {
                val stream = activeStream ?: return C.RESULT_END_OF_INPUT
                val n = stream.read(buffer, offset, maxWant)
                if (n == -1) {
                    stegEof = true
                    return C.RESULT_END_OF_INPUT
                }
                n
            }
            if (got > 0) {
                stegRemainingInChunk -= got
                activeDataSpec?.let { spec ->
                    transferListeners.forEach { it.onBytesTransferred(this, spec, true, got) }
                }
            }
            return got
        }

        // Mode B prefix drain (post-PNG header bytes)
        val prefix = streamPrefixBytes
        if (prefix != null && streamPrefixRemaining > 0) {
            val toCopy = min(length, streamPrefixRemaining)
            System.arraycopy(prefix, streamPrefixOffset, buffer, offset, toCopy)
            streamPrefixOffset += toCopy
            streamPrefixRemaining -= toCopy
            if (streamPrefixRemaining == 0) {
                streamPrefixBytes = null
            }
            activeDataSpec?.let { spec ->
                transferListeners.forEach { it.onBytesTransferred(this, spec, true, toCopy) }
            }
            return toCopy
        }

        // Mode B/C: Live OkHttp stream read
        val stream = activeStream ?: return C.RESULT_END_OF_INPUT
        val readBytes = stream.read(buffer, offset, length)
        if (readBytes == -1) return C.RESULT_END_OF_INPUT
        if (readBytes > 0) {
            activeDataSpec?.let { spec ->
                transferListeners.forEach { it.onBytesTransferred(this, spec, true, readBytes) }
            }
        }
        return readBytes
    }

    private fun readRawExact(dst: ByteArray, dstLen: Int): Boolean {
        var filled = 0
        while (filled < dstLen) {
            val prefix = streamPrefixBytes
            if (prefix != null && streamPrefixRemaining > 0) {
                val n = min(dstLen - filled, streamPrefixRemaining)
                System.arraycopy(prefix, streamPrefixOffset, dst, filled, n)
                streamPrefixOffset += n
                streamPrefixRemaining -= n
                if (streamPrefixRemaining == 0) streamPrefixBytes = null
                filled += n
            } else {
                val stream = activeStream ?: return false
                val n = stream.read(dst, filled, dstLen - filled)
                if (n <= 0) return false
                filled += n
            }
        }
        return true
    }

    private fun skipRawExact(bytesToSkip: Int): Boolean {
        var remaining = bytesToSkip
        val scratch = ByteArray(min(maxOf(bytesToSkip, 1), 4096))
        while (remaining > 0) {
            val prefix = streamPrefixBytes
            if (prefix != null && streamPrefixRemaining > 0) {
                val n = min(remaining, streamPrefixRemaining)
                streamPrefixOffset += n
                streamPrefixRemaining -= n
                if (streamPrefixRemaining == 0) streamPrefixBytes = null
                remaining -= n
            } else {
                val stream = activeStream ?: return false
                val n = stream.read(scratch, 0, min(remaining, scratch.size))
                if (n <= 0) return false
                remaining -= n
            }
        }
        return true
    }

    private fun advanceToNextStegChunk(): Boolean {
        val hdr = ByteArray(8)
        while (true) {
            // Skip 4-byte CRC of previous chunk, then read 8-byte [len + type] of next PNG chunk
            if (!skipRawExact(4)) return false
            if (!readRawExact(hdr, 8)) return false
            val len = (((hdr[0].toInt() and 0xFF) shl 24) or
                ((hdr[1].toInt() and 0xFF) shl 16) or
                ((hdr[2].toInt() and 0xFF) shl 8) or
                (hdr[3].toInt() and 0xFF))
            val b4 = hdr[4].toInt() and 0xFF
            val b5 = hdr[5].toInt() and 0xFF
            val b6 = hdr[6].toInt() and 0xFF
            val b7 = hdr[7].toInt() and 0xFF
            // "IEND"
            if (b4 == 0x49 && b5 == 0x45 && b6 == 0x4E && b7 == 0x44) {
                return false
            }
            if (len < 0) return false
            // "stEg"
            if (b4 == 0x73 && b5 == 0x74 && b6 == 0x45 && b7 == 0x67 && len > 12) {
                if (!skipRawExact(12)) return false
                stegRemainingInChunk = len - 12
                return true
            }
            if (!skipRawExact(len)) return false
        }
    }

    override fun getUri(): Uri? = currentUri

    override fun getResponseHeaders(): Map<String, List<String>> = responseHeaders

    private fun closeInternal() {
        bufferedBytes = null
        bytesRemaining = 0
        readOffset = 0
        streamPrefixBytes = null
        streamPrefixOffset = 0
        streamPrefixRemaining = 0
        isStegStream = false
        stegRemainingInChunk = 0
        stegEof = false
        try {
            activeStream?.close()
        } catch (_: Exception) {}
        activeStream = null
        try {
            activeResponse?.close()
        } catch (_: Exception) {}
        activeResponse = null
        try {
            activeCall?.cancel()
        } catch (_: Exception) {}
        activeCall = null
    }

    override fun close() {
        val wasOpened = opened
        val spec = activeDataSpec
        opened = false
        activeDataSpec = null
        closeInternal()
        if (wasOpened && spec != null) {
            transferListeners.forEach { it.onTransferEnd(this, spec, true) }
        }
    }
}
