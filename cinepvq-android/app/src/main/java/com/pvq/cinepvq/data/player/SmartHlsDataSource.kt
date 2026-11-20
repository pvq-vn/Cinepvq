package com.pvq.cinepvq.data.player

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.TransferListener
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URI
import kotlin.math.min

/**
 * Pure Kotlin HLS Ad-Stripper, Manifest Resolver & PNG-Disguised MPEG-TS Unwrapper.
 * - Strips injected KKPhim1 commercial ad blocks (`/v9/<hash>/segment_0001.ts` inside
 *   `#EXT-X-DISCONTINUITY`) while preserving real movie segments including `convertv9/`.
 * - Extracts fresh inline HLS manifests from PhimHDCSS FHDC (`tiktok.phimhdc.com/embed/...`).
 * - Unwraps fake PNG/image headers on MPEG-TS segments (VSMOV 478B, PhimHDCSS FHDC 76B).
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
     * Unwraps fake image/PNG header prefix and non-188 trailing footer from disguised MPEG-TS segments.
     */
    fun stripPngPrefixFromTs(buf: ByteArray): ByteArray {
        if (buf.size < 377) return buf

        // Already valid MPEG-TS starting at byte 0
        if ((buf[0].toInt() and 0xFF) == 0x47 &&
            (buf[188].toInt() and 0xFF) == 0x47 &&
            (buf[376].toInt() and 0xFF) == 0x47
        ) {
            return buf
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
            return buf
        }

        val maxScan = min(buf.size - 377, 8192)
        var tsOffset = -1
        for (i in 1..maxScan) {
            if ((buf[i].toInt() and 0xFF) == 0x47 &&
                (buf[i + 188].toInt() and 0xFF) == 0x47 &&
                (buf[i + 376].toInt() and 0xFF) == 0x47
            ) {
                tsOffset = i
                break
            }
        }

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
    private val stripPng: Boolean = false
) : DataSource.Factory {

    private val httpFactory = DefaultHttpDataSource.Factory()
        .setUserAgent(
            defaultHeaders["User-Agent"]
                ?: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        )
        .setAllowCrossProtocolRedirects(true)
        .setConnectTimeoutMs(12_000)
        .setReadTimeoutMs(15_000)
        .apply {
            if (defaultHeaders.isNotEmpty()) {
                setDefaultRequestProperties(defaultHeaders)
            }
        }

    override fun createDataSource(): DataSource {
        return SmartHlsDataSource(
            upstream = httpFactory.createDataSource(),
            stripAds = stripAds,
            stripPng = stripPng
        )
    }
}

@UnstableApi
private class SmartHlsDataSource(
    private val upstream: DataSource,
    private val stripAds: Boolean,
    private val stripPng: Boolean
) : DataSource {

    private var bufferedBytes: ByteArray? = null
    private var readOffset: Int = 0
    private var bytesRemaining: Int = 0
    private var currentUri: Uri? = null
    private var responseHeaders: Map<String, List<String>> = emptyMap()

    override fun addTransferListener(transferListener: TransferListener) {
        upstream.addTransferListener(transferListener)
    }

    override fun open(dataSpec: DataSpec): Long {
        bufferedBytes = null
        readOffset = 0
        bytesRemaining = 0
        currentUri = dataSpec.uri

        val url = dataSpec.uri.toString()
        val lower = url.lowercase()

        val isPhimHdcssEmbed = lower.contains("phimhdc.com/embed/")
        val isManifestUrl = lower.contains(".m3u8") || lower.contains("/m3u8") ||
            lower.contains("hls-proxy")
        val isPotentialPngSegment = stripPng && (
            lower.contains(".png") ||
            lower.contains(".jpg") ||
            lower.contains(".jpeg") ||
            lower.contains(".webp") ||
            lower.contains(".gif") ||
            lower.contains("ibyteimg.com") ||
            lower.contains("streamvsmov.com")
        )

        val shouldBuffer = isPhimHdcssEmbed || isManifestUrl || isPotentialPngSegment

        if (!shouldBuffer) {
            val len = upstream.open(dataSpec)
            currentUri = upstream.uri ?: dataSpec.uri
            responseHeaders = upstream.responseHeaders
            return len
        }

        // Fetch full upstream response without range truncation so we can clean manifest or unwrap PNG-TS
        val fullSpec = dataSpec.buildUpon()
            .setPosition(0L)
            .setLength(C.LENGTH_UNSET.toLong())
            .build()

        val rawBytes = try {
            upstream.open(fullSpec)
            currentUri = upstream.uri ?: dataSpec.uri
            responseHeaders = upstream.responseHeaders
            readAllUpstreamBytes()
        } finally {
            try {
                upstream.close()
            } catch (_: Exception) {}
        }

        val finalUrl = currentUri?.toString() ?: url
        val processed: ByteArray = when {
            isPhimHdcssEmbed -> {
                val html = rawBytes.toString(Charsets.UTF_8)
                val manifest = HlsAdAndPngProcessor.extractPhimHdcssManifestFromHtml(html)
                    ?: throw IOException("PhimHDCSS FHDC manifest not found")
                val resolved = HlsAdAndPngProcessor.resolveManifestUrls(manifest, finalUrl)
                resolved.toByteArray(Charsets.UTF_8)
            }
            looksLikeM3u8(rawBytes) -> {
                val text = rawBytes.toString(Charsets.UTF_8)
                val cleaned = if (stripAds) {
                    HlsAdAndPngProcessor.stripAdsFromM3u8(text, finalUrl).cleaned
                } else {
                    text
                }
                HlsAdAndPngProcessor.resolveManifestUrls(cleaned, finalUrl).toByteArray(Charsets.UTF_8)
            }
            stripPng -> {
                HlsAdAndPngProcessor.stripPngPrefixFromTs(rawBytes)
            }
            else -> rawBytes
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
        return requestedLen.toLong()
    }

    private fun readAllUpstreamBytes(): ByteArray {
        val baos = ByteArrayOutputStream(32 * 1024)
        val chunk = ByteArray(16 * 1024)
        while (true) {
            val n = upstream.read(chunk, 0, chunk.size)
            if (n == C.RESULT_END_OF_INPUT || n <= 0) break
            baos.write(chunk, 0, n)
        }
        return baos.toByteArray()
    }

    private fun looksLikeM3u8(bytes: ByteArray): Boolean {
        if (bytes.size < 7) return false
        val prefix = bytes.copyOfRange(0, min(bytes.size, 32)).toString(Charsets.UTF_8).trimStart()
        return prefix.startsWith("#EXTM3U")
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        val local = bufferedBytes
        if (local == null) {
            return upstream.read(buffer, offset, length)
        }
        if (length == 0) return 0
        if (bytesRemaining <= 0) return C.RESULT_END_OF_INPUT

        val toCopy = min(length, bytesRemaining)
        System.arraycopy(local, readOffset, buffer, offset, toCopy)
        readOffset += toCopy
        bytesRemaining -= toCopy
        return toCopy
    }

    override fun getUri(): Uri? = currentUri

    override fun getResponseHeaders(): Map<String, List<String>> = responseHeaders

    override fun close() {
        bufferedBytes = null
        bytesRemaining = 0
        readOffset = 0
        try {
            upstream.close()
        } catch (_: Exception) {}
    }
}
