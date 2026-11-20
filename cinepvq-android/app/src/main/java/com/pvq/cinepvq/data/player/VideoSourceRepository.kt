package com.pvq.cinepvq.data.player

import android.util.Base64
import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import com.pvq.cinepvq.domain.model.SubtitleTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Request
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.text.Normalizer
import java.util.concurrent.ConcurrentHashMap

class VideoSourceRepository(private val networkModule: NetworkModule) {

    private data class CachedEntry(
        val sources: List<StreamSource>,
        val expiresAtMs: Long
    )

    private val streamCache = ConcurrentHashMap<String, CachedEntry>()
    private val phimHdcssDetailCache = ConcurrentHashMap<String, Pair<String, Long>>()

    companion object {
        private const val CACHE_TTL_MS = 15 * 60 * 1000L
        private const val DETAIL_CACHE_TTL_MS = 30 * 60 * 1000L
        private const val DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        fun cleanSourceName(
            sourceId: String,
            rawName: String,
            rawDisplayName: String,
            serverName: String?,
            url: String? = null
        ): Pair<String, String> {
            val sid = sourceId.lowercase()
            val rName = rawName.lowercase()
            val rDisp = rawDisplayName.lowercase()
            val sName = serverName?.lowercase() ?: ""
            val u = url?.lowercase() ?: ""

            val audioLabel = when {
                rDisp.contains("thuyết minh") || rName.contains("thuyết minh") || sName.contains("thuyết minh") ||
                    rDisp.contains("tm") || rName.contains("tm") || sName.contains("tm") -> "Thuyết Minh"
                rDisp.contains("lồng tiếng") || rName.contains("lồng tiếng") || sName.contains("lồng tiếng") ||
                    rDisp.contains("lt") || rName.contains("lt") || sName.contains("lt") -> "Lồng Tiếng"
                rDisp.contains("vietsub") || rName.contains("vietsub") || sName.contains("vietsub") -> "Vietsub"
                else -> null
            }

            val baseName = when {
                sid.contains("k20") || rName.contains("k20") || rDisp.contains("k20") || u.contains("k20") -> "K20"
                sid.contains("vsmov") || rName.contains("vsmov") || rDisp.contains("vsmov") || u.contains("vsmov") || u.contains("streamvsmov") -> "VSMOV"
                sid.contains("phimhdcss") || rName.contains("phimhdcss") || rDisp.contains("phimhdcss") || u.contains("phimhdc") -> "PhimHDCSS"
                sid.contains("chophim") || rName.contains("chophim") || rDisp.contains("chophim") || u.contains("chophim") -> "ChoPhim"
                sid.contains("nguonc") || rName.contains("nguonc") || rDisp.contains("nguonc") || rName.contains("streamc") || rDisp.contains("streamc") || u.contains("nguonc") || u.contains("streamc") -> "NguonC"
                sid.contains("kkphim") || rName.contains("kkphim") || rDisp.contains("kkphim") || u.contains("kkphim") || u.contains("phimapi") || u.contains("phim1280") -> "KKphim1"
                else -> {
                    val cleaned = rawDisplayName
                        .replace("Server Dự Phòng", "", ignoreCase = true)
                        .replace("Server Trực Tiếp", "", ignoreCase = true)
                        .replace("Direct HLS", "", ignoreCase = true)
                        .replace("Direct", "", ignoreCase = true)
                        .replace("Embed", "", ignoreCase = true)
                        .replace("()", "")
                        .trim()
                    if (cleaned.isBlank()) {
                        when {
                            u.contains("vsmov") || u.contains("streamvsmov") -> "VSMOV"
                            u.contains("phimhdc") -> "PhimHDCSS"
                            u.contains("chophim") -> "ChoPhim"
                            u.contains("nguonc") || u.contains("streamc") -> "NguonC"
                            else -> "KKphim1"
                        }
                    } else cleaned
                }
            }

            val finalDisplay = when (baseName) {
                "K20" -> if (audioLabel != null) "K20 Direct ($audioLabel)" else "K20 Direct"
                "VSMOV" -> if (audioLabel != null) "VSMOV Native ($audioLabel)" else "VSMOV Native"
                "PhimHDCSS" -> "PhimHDCSS (FHDC)"
                "ChoPhim" -> if (audioLabel != null) "ChoPhim ($audioLabel)" else "ChoPhim"
                "NguonC" -> if (audioLabel != null) "NguonC ($audioLabel)" else "NguonC"
                "KKphim1" -> {
                    val isEmbed = (u.contains("/player/") || sid.contains("embed")) && !u.contains(".m3u8")
                    if (isEmbed) {
                        if (audioLabel != null) "KKphim1 (Embed $audioLabel)" else "KKphim1 (Embed)"
                    } else {
                        if (audioLabel != null) "KKphim1 ($audioLabel • Cắt QC)" else "KKphim1 (Cắt QC)"
                    }
                }
                else -> if (audioLabel != null && !baseName.contains(audioLabel, ignoreCase = true)) {
                    "$baseName ($audioLabel)"
                } else baseName
            }

            return Pair(baseName, finalDisplay)
        }

        fun extractDirectM3u8(url: String?): String? {
            if (url.isNullOrBlank()) return null
            if (url.contains(".m3u8") && !url.contains("/player/")) return url.trim()
            if (url.contains("url=")) {
                val extracted = url.substringAfter("url=").substringBefore("&")
                val decoded = try {
                    URLDecoder.decode(extracted, "UTF-8")
                } catch (_: Exception) {
                    extracted
                }
                if (decoded.contains(".m3u8")) return decoded.trim()
            }
            return null
        }

        fun buildInstantKkphimSource(
            m3u8Url: String,
            serverName: String?
        ): StreamSource {
            val serverKey = serverName?.replace(" ", "_") ?: "default"
            val sourceId = "kkphim_direct_$serverKey"
            val (cleanName, cleanDisplay) = cleanSourceName(sourceId, "KKphim1", "KKphim1", serverName, m3u8Url)
            return StreamSource(
                sourceId = sourceId,
                name = cleanName,
                displayName = cleanDisplay,
                type = StreamType.HLS_DIRECT,
                url = m3u8Url,
                rawUrl = m3u8Url,
                priority = 5,
                quality = "FHD",
                serverName = serverName ?: "KKphim1",
                isAvailable = true,
                adFree = true
            )
        }
    }

    private fun cacheKey(
        slug: String,
        episode: Int,
        episodeSlug: String?,
        serverName: String?
    ): String = "${slug.lowercase()}|$episode|${episodeSlug?.lowercase() ?: ""}|${serverName?.lowercase() ?: ""}"

    fun getCachedStreams(
        slug: String,
        episode: Int = 1,
        episodeSlug: String? = null,
        serverName: String? = null
    ): List<StreamSource>? {
        val entry = streamCache[cacheKey(slug, episode, episodeSlug, serverName)] ?: return null
        return if (entry.expiresAtMs > System.currentTimeMillis()) entry.sources else null
    }

    suspend fun prefetchStreams(
        slug: String,
        title: String? = null,
        episode: Int = 1,
        season: Int = 1,
        type: String = "series",
        serverName: String? = null,
        episodeSlug: String? = null,
        fallbackM3u8: String? = null,
        fallbackEmbed: String? = null
    ) {
        if (getCachedStreams(slug, episode, episodeSlug, serverName) != null) return
        try {
            resolveStreams(
                slug = slug,
                title = title,
                episode = episode,
                season = season,
                type = type,
                serverName = serverName,
                episodeSlug = episodeSlug,
                fallbackM3u8 = fallbackM3u8,
                fallbackEmbed = fallbackEmbed
            )
        } catch (_: Exception) {}
    }

    suspend fun resolveStreams(
        slug: String,
        title: String? = null,
        episode: Int = 1,
        season: Int = 1,
        type: String = "series",
        serverName: String? = null,
        episodeSlug: String? = null,
        fallbackM3u8: String? = null,
        fallbackEmbed: String? = null,
        forceRefresh: Boolean = false
    ): List<StreamSource> = coroutineScope {
        val key = cacheKey(slug, episode, episodeSlug, serverName)
        if (!forceRefresh) {
            getCachedStreams(slug, episode, episodeSlug, serverName)?.let { return@coroutineScope it }
        }

        val cleanM3u8 = extractDirectM3u8(fallbackM3u8) ?: extractDirectM3u8(fallbackEmbed)
        val initialNguoncEmbed = if (fallbackEmbed?.contains("nguonc") == true || fallbackEmbed?.contains("streamc") == true) {
            fallbackEmbed
        } else null

        // Run backend resolver AND on-device native extractors in PARALLEL (cuts latency from ~8s to ~1.5-3s!)
        val backendDeferred = async {
            withTimeoutOrNull(4500L) {
                fetchFromBackendResolver(
                    slug = slug,
                    title = title,
                    episode = episode,
                    season = season,
                    type = type,
                    serverName = serverName,
                    episodeSlug = episodeSlug,
                    knownHlsUrl = cleanM3u8,
                    nguoncEmbedUrl = initialNguoncEmbed
                )
            } ?: emptyList()
        }
        val vsmovDeferred = async {
            withTimeoutOrNull(4000L) {
                fetchVsmovDirectHls(slug, episode, episodeSlug, serverName)
            }
        }
        val choPhimDeferred = async {
            withTimeoutOrNull(3500L) {
                fetchChoPhimDirectHls(slug, episode, episodeSlug, serverName)
            }
        }
        val phimHdcssDeferred = async {
            withTimeoutOrNull(4500L) {
                fetchPhimHdcssDirectHls(slug, title, episode, serverName)
            }
        }
        val nguoncDeferred = async {
            withTimeoutOrNull(3000L) {
                if (initialNguoncEmbed != null) initialNguoncEmbed
                else fetchNguonCEmbed(slug, episode, episodeSlug)
            }
        }

        val streamList = mutableListOf<StreamSource>()

        // 1. Add backend resolved sources (already includes K20, VSMOV Native, PhimHDCSS, ChoPhim, KKPhim1, NguonC)
        streamList.addAll(backendDeferred.await())

        // 2. Add on-device VSMOV Native HLS if backend didn't provide an HLS VSMOV source
        val vsmovDirect = vsmovDeferred.await()
        val hasVsmovHls = streamList.any { it.name == "VSMOV" && it.type == StreamType.HLS_DIRECT }
        if (!hasVsmovHls && vsmovDirect != null) {
            streamList.removeAll { it.name == "VSMOV" && it.type == StreamType.EMBED }
            streamList.add(vsmovDirect)
        }

        // 3. Add on-device PhimHDCSS Native HLS (FHDC TikTok CDN) if missing
        val phimHdcssDirect = phimHdcssDeferred.await()
        val hasPhimHdcss = streamList.any { it.name == "PhimHDCSS" }
        if (!hasPhimHdcss && phimHdcssDirect != null) {
            streamList.add(phimHdcssDirect)
        }

        // 4. Add on-device ChoPhim Direct HLS if missing
        val choPhimDirect = choPhimDeferred.await()
        val hasChoPhim = streamList.any { it.name == "ChoPhim" }
        if (!hasChoPhim && choPhimDirect != null) {
            streamList.add(choPhimDirect)
        }

        // 5. Direct KKPhim1 M3U8 (on-device SmartHlsDataSource strips embedded ads!)
        val alreadyHasDirectKkphim = streamList.any {
            (it.name == "KKphim1" && it.type == StreamType.HLS_DIRECT) ||
                (cleanM3u8 != null && (it.rawUrl == cleanM3u8 || it.url == cleanM3u8))
        }
        if (!alreadyHasDirectKkphim && !cleanM3u8.isNullOrBlank()) {
            streamList.add(buildInstantKkphimSource(cleanM3u8, serverName))
        }

        // 6. Genuine NguonC iframe backup (Cloudflare Turnstile gated — WebView fallback)
        val effectiveNguoncEmbed = nguoncDeferred.await()
        val hasNguonc = streamList.any { it.name == "NguonC" }
        if (!hasNguonc && !effectiveNguoncEmbed.isNullOrBlank() &&
            (effectiveNguoncEmbed.contains("streamc") || effectiveNguoncEmbed.contains("nguonc"))
        ) {
            val (cleanName, cleanDisplay) = cleanSourceName("nguonc", "NguonC", "NguonC", serverName, effectiveNguoncEmbed)
            streamList.add(
                StreamSource(
                    sourceId = "nguonc",
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = StreamType.EMBED,
                    url = effectiveNguoncEmbed,
                    rawUrl = effectiveNguoncEmbed,
                    priority = 6,
                    quality = "FHD",
                    serverName = serverName ?: "NguonC",
                    isAvailable = true
                )
            )
        }

        // 7. KKPhim embed backup ONLY if NO direct HLS stream exists at all
        val hasAnyDirect = streamList.any { it.type == StreamType.HLS_DIRECT }
        val alreadyHasEmbedUrl = streamList.any { it.url == fallbackEmbed }
        if (!hasAnyDirect && !alreadyHasEmbedUrl && !fallbackEmbed.isNullOrBlank() && fallbackEmbed != cleanM3u8) {
            val serverKey = serverName?.replace(" ", "_") ?: "default"
            val fallbackSourceId = "kkphim_embed_$serverKey"
            val (cleanName, cleanDisplay) = cleanSourceName(fallbackSourceId, "KKphim1", "KKphim1 (Embed)", serverName, fallbackEmbed)
            streamList.add(
                StreamSource(
                    sourceId = fallbackSourceId,
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = StreamType.EMBED,
                    url = fallbackEmbed,
                    priority = 7,
                    quality = "HD",
                    serverName = serverName ?: "KKphim",
                    isAvailable = true
                )
            )
        }

        // Deduplicate & sort strictly: HLS_DIRECT first, then by provider priority
        val sortedCandidates = streamList.sortedWith(
            compareBy<StreamSource> { if (it.type == StreamType.HLS_DIRECT) 0 else 1 }
                .thenBy { it.priority }
        )

        val distinctSources = mutableListOf<StreamSource>()
        val seenKeys = mutableSetOf<String>()
        val seenUrls = mutableSetOf<String>()

        for (s in sortedCandidates) {
            val dedupKey = "${s.name}_${s.type}"
            val effectiveUrl = s.rawUrl?.ifBlank { null } ?: s.url
            if (!seenKeys.contains(dedupKey) && !seenUrls.contains(effectiveUrl)) {
                seenKeys.add(dedupKey)
                seenUrls.add(effectiveUrl)
                distinctSources.add(s)
            }
        }

        if (distinctSources.isNotEmpty()) {
            streamCache[key] = CachedEntry(
                sources = distinctSources,
                expiresAtMs = System.currentTimeMillis() + CACHE_TTL_MS
            )
        }
        distinctSources
    }

    private suspend fun fetchFromBackendResolver(
        slug: String,
        title: String?,
        episode: Int,
        season: Int,
        type: String,
        serverName: String?,
        episodeSlug: String?,
        knownHlsUrl: String?,
        nguoncEmbedUrl: String?
    ): List<StreamSource> = withContext(Dispatchers.IO) {
        val list = mutableListOf<StreamSource>()
        try {
            val res = networkModule.cinepvqApi.resolveVideoSources(
                slug = slug,
                title = title,
                episode = episode,
                season = season,
                type = type,
                serverName = serverName,
                episodeSlug = episodeSlug,
                knownHlsUrl = knownHlsUrl,
                nguoncEmbedUrl = nguoncEmbedUrl
            )
            val baseOrigin = networkModule.cinepvqBaseUrl.trimEnd('/')
            if (res.isSuccessful && res.body()?.sources?.isNotEmpty() == true) {
                res.body()!!.sources.forEach { s ->
                    if (s.isAvailable && s.url.isNotBlank()) {
                        val isHlsDeclared = s.type.equals("hls", ignoreCase = true)
                        val isIframeDeclared = s.type.equals("iframe", ignoreCase = true) ||
                            s.type.equals("embed", ignoreCase = true)

                        val streamType = when {
                            !s.isAvailable -> StreamType.UNAVAILABLE
                            isHlsDeclared -> StreamType.HLS_DIRECT
                            isIframeDeclared -> StreamType.EMBED
                            s.url.contains(".m3u8") -> StreamType.HLS_DIRECT
                            else -> StreamType.EMBED
                        }

                        // Resolve relative web proxy URLs; prefer rawUrl for direct zero-hop ExoPlayer playback!
                        val resolvedProxyUrl = if (s.url.startsWith("/")) "$baseOrigin${s.url}" else s.url
                        val effectiveRawUrl = s.rawUrl?.takeIf { it.startsWith("http") }
                        val resolvedSubtitles = s.subtitles.orEmpty().mapNotNull { sub ->
                            val subRaw = sub.rawUrl?.takeIf { it.startsWith("http") }
                            val subUrl = if (sub.url.startsWith("/")) "$baseOrigin${sub.url}" else sub.url
                            val finalUrl = subRaw ?: subUrl
                            if (finalUrl.isBlank()) null
                            else SubtitleTrack(
                                label = sub.label,
                                lang = sub.lang,
                                url = finalUrl,
                                rawUrl = subRaw
                            )
                        }

                        val (cleanName, cleanDisplay) = cleanSourceName(
                            s.sourceId,
                            s.name,
                            s.displayName,
                            s.serverName ?: serverName,
                            effectiveRawUrl ?: resolvedProxyUrl
                        )

                        val p = when (cleanName) {
                            "K20" -> 1
                            "VSMOV" -> if (streamType == StreamType.HLS_DIRECT) 2 else 6
                            "PhimHDCSS" -> 3
                            "ChoPhim" -> 4
                            "KKphim1" -> 5
                            "NguonC" -> 6
                            else -> s.priority
                        }

                        list.add(
                            StreamSource(
                                sourceId = s.sourceId,
                                name = cleanName,
                                displayName = cleanDisplay,
                                type = streamType,
                                url = effectiveRawUrl ?: resolvedProxyUrl,
                                rawUrl = effectiveRawUrl,
                                priority = p,
                                quality = s.quality,
                                serverName = s.serverName,
                                isAvailable = s.isAvailable,
                                headers = s.headers ?: emptyMap(),
                                subtitles = resolvedSubtitles,
                                stripPng = s.stripPng == true,
                                adFree = s.adFree == true
                            )
                        )
                    }
                }
            }
        } catch (_: Exception) {}
        list
    }

    // ── On-Device Native VSMOV HLS + WebVTT Extractor ────────────────────────

    private suspend fun fetchVsmovDirectHls(
        slug: String,
        episodeNumber: Int,
        episodeSlug: String?,
        serverName: String?
    ): StreamSource? = withContext(Dispatchers.IO) {
        try {
            val apiReq = Request.Builder()
                .url("https://vsmov.com/api/phim/$slug")
                .header("User-Agent", DESKTOP_UA)
                .build()
            val body = networkModule.okHttpClient.newCall(apiReq).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                res.body?.string() ?: return@withContext null
            }

            val root = networkModule.json.parseToJsonElement(body).jsonObject
            val episodesArray = root["episodes"]?.jsonArray ?: return@withContext null

            val reqServer = serverName?.lowercase() ?: ""
            val wantTm = Regex("thuy[eế]t\\s*minh|\\btm\\b").containsMatchIn(reqServer)
            val wantLt = Regex("l[oồ]ng\\s*ti[eế]ng|\\blt\\b").containsMatchIn(reqServer)

            var matchedEmbed: String? = null
            var matchedM3u8: String? = null
            var matchedGroupName = "VSMOV"

            for (groupElem in episodesArray) {
                val groupObj = groupElem.jsonObject
                val gName = groupObj["server_name"]?.jsonPrimitive?.contentOrNull ?: ""
                val gLower = gName.lowercase()
                val gIsTm = Regex("thuy[eế]t\\s*minh|\\btm\\b").containsMatchIn(gLower)
                val gIsLt = Regex("l[oồ]ng\\s*ti[eế]ng|\\blt\\b").containsMatchIn(gLower)
                if (wantTm && !gIsTm) continue
                if (wantLt && !gIsLt) continue
                if (!wantTm && !wantLt && (gIsTm || gIsLt)) continue

                val serverData = groupObj["server_data"]?.jsonArray ?: continue
                for (itemElem in serverData) {
                    val itemObj = itemElem.jsonObject
                    val name = itemObj["name"]?.jsonPrimitive?.contentOrNull ?: ""
                    val itemSlug = itemObj["slug"]?.jsonPrimitive?.contentOrNull ?: ""
                    val digits = name.filter { it.isDigit() }.toIntOrNull()
                        ?: itemSlug.filter { it.isDigit() }.toIntOrNull()

                    val matchesEp = (episodeSlug != null && itemSlug.equals(episodeSlug, ignoreCase = true)) ||
                        digits == episodeNumber ||
                        ((name.lowercase().contains("full") || serverData.size == 1) && episodeNumber == 1)

                    if (matchesEp) {
                        matchedM3u8 = itemObj["link_m3u8"]?.jsonPrimitive?.contentOrNull?.takeIf { it.contains(".m3u8") }
                        matchedEmbed = itemObj["link_embed"]?.jsonPrimitive?.contentOrNull?.takeIf { it.startsWith("http") }
                        matchedGroupName = gName.ifBlank { "VSMOV" }
                        break
                    }
                }
                if (matchedM3u8 != null || matchedEmbed != null) break
            }

            if (matchedM3u8 != null) {
                val (cleanName, cleanDisplay) = cleanSourceName("vsmov", "VSMOV", "VSMOV", matchedGroupName, matchedM3u8)
                return@withContext StreamSource(
                    sourceId = "vsmov",
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = StreamType.HLS_DIRECT,
                    url = matchedM3u8,
                    rawUrl = matchedM3u8,
                    priority = 2,
                    quality = "FHD",
                    serverName = matchedGroupName,
                    isAvailable = true,
                    stripPng = true,
                    adFree = true
                )
            }

            val embedUrl = matchedEmbed ?: return@withContext null
            val embedReq = Request.Builder()
                .url(embedUrl)
                .header("User-Agent", DESKTOP_UA)
                .header("Referer", "https://vsmov.com/")
                .build()
            val html = networkModule.okHttpClient.newCall(embedReq).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                res.body?.string() ?: return@withContext null
            }

            val embedOrigin = try {
                val u = URI(embedUrl)
                "${u.scheme}://${u.host}"
            } catch (_: Exception) {
                "https://v8.streamvsmov.com"
            }

            var masterUrl = ""
            val enableSigned = Regex("""enableSignedUrl\s*:\s*true""", RegexOption.IGNORE_CASE).containsMatchIn(html)
            if (enableSigned) {
                val signedM = Regex("""signedMasterUrl\s*:\s*["']([^"']+)["']""").find(html)
                val rawSigned = signedM?.groupValues?.getOrNull(1)
                if (!rawSigned.isNullOrBlank()) {
                    masterUrl = HlsAdAndPngProcessor.resolveUrlSafe(rawSigned, embedOrigin)
                }
            }
            if (masterUrl.isBlank()) {
                val baseM = Regex("""const\s+baseUrl\s*=\s*["']([^"']+)["']""").find(html)
                val hashM = Regex("""const\s+videoHash\s*=\s*["']([^"']+)["']""").find(html)
                val hash = hashM?.groupValues?.getOrNull(1)
                if (!hash.isNullOrBlank()) {
                    val base = (baseM?.groupValues?.getOrNull(1) ?: embedOrigin).trimEnd('/')
                    masterUrl = "$base/stream/$hash/master.m3u8"
                }
            }
            if (masterUrl.isBlank()) {
                masterUrl = Regex("""https?://[^"'\s<>]+\.m3u8[^"'\s<>]*""").find(html)?.value ?: ""
            }
            if (masterUrl.isBlank()) return@withContext null

            val subtitles = mutableListOf<SubtitleTrack>()
            val subArrayMatch = Regex("""subtitles\s*:\s*(\[[\s\S]*?\])\s*,""").find(html)
            if (subArrayMatch != null) {
                try {
                    val arr = networkModule.json.parseToJsonElement(subArrayMatch.groupValues[1]).jsonArray
                    for (subEl in arr) {
                        val obj = subEl.jsonObject
                        val rawSubUrl = obj["url"]?.jsonPrimitive?.contentOrNull ?: continue
                        val code = obj["code"]?.jsonPrimitive?.contentOrNull ?: "vi"
                        val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: code
                        val absSub = HlsAdAndPngProcessor.resolveUrlSafe(rawSubUrl, embedOrigin)
                        val lang = if (code.lowercase().startsWith("vie") || code.lowercase() == "vi") "vi"
                        else code.lowercase().take(2)
                        val label = when (lang) {
                            "vi" -> "Tiếng Việt"
                            "en" -> "English"
                            "zh" -> "中文"
                            else -> name
                        }
                        subtitles.add(SubtitleTrack(label = label, lang = lang, url = absSub, rawUrl = absSub))
                    }
                } catch (_: Exception) {}
            }

            val (cleanName, cleanDisplay) = cleanSourceName("vsmov", "VSMOV", "VSMOV", matchedGroupName, masterUrl)
            StreamSource(
                sourceId = "vsmov",
                name = cleanName,
                displayName = cleanDisplay,
                type = StreamType.HLS_DIRECT,
                url = masterUrl,
                rawUrl = masterUrl,
                priority = 2,
                quality = "FHD",
                serverName = matchedGroupName,
                isAvailable = true,
                headers = mapOf("Referer" to embedUrl, "Origin" to embedOrigin),
                subtitles = subtitles,
                stripPng = true,
                adFree = true
            )
        } catch (_: Exception) {
            null
        }
    }

    // ── On-Device ChoPhim Direct HLS Extractor ───────────────────────────────

    private suspend fun fetchChoPhimDirectHls(
        slug: String,
        episodeNumber: Int,
        episodeSlug: String?,
        serverName: String?
    ): StreamSource? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("https://chophim.wtf/xem/${slug.trim().lowercase()}")
                .header("User-Agent", DESKTOP_UA)
                .header("Referer", "https://chophim.wtf/")
                .build()
            val html = networkModule.okHttpClient.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                res.body?.string() ?: return@withContext null
            }

            val unescaped = html
                .replace("\\\"", "\"")
                .replace("\\/", "/")
                .replace("\\u0026", "&")

            val reqServer = serverName?.lowercase() ?: ""
            val wantTm = Regex("thuy[eế]t\\s*minh|\\btm\\b").containsMatchIn(reqServer)
            val wantLt = Regex("l[oồ]ng\\s*ti[eế]ng|\\blt\\b").containsMatchIn(reqServer)

            val serverRe = Regex(""""server_name"\s*:\s*"([^"]+)"\s*,\s*"server_data"\s*:\s*\[([\s\S]*?)\]""")
            val itemRe = Regex("""\{[^{}]*"name"\s*:\s*"([^"]*)"[^{}]*"slug"\s*:\s*"([^"]*)"[^{}]*\}""")
            val m3u8Re = Regex(""""link_m3u8"\s*:\s*"(https?://[^"]+\.m3u8[^"]*)"""")

            for (sm in serverRe.findAll(unescaped)) {
                val gName = sm.groupValues[1]
                val gLower = gName.lowercase()
                val gIsTm = Regex("thuy[eế]t\\s*minh|\\btm\\b").containsMatchIn(gLower)
                val gIsLt = Regex("l[oồ]ng\\s*ti[eế]ng|\\blt\\b").containsMatchIn(gLower)
                if (wantTm && !gIsTm) continue
                if (wantLt && !gIsLt) continue
                if (!wantTm && !wantLt && (gIsTm || gIsLt)) continue

                val dataBlock = sm.groupValues[2]
                val items = itemRe.findAll(dataBlock).toList()
                for (im in items) {
                    val objStr = im.value
                    val epName = im.groupValues[1]
                    val epSlug = im.groupValues[2]
                    val digits = epName.filter { it.isDigit() }.toIntOrNull()
                        ?: epSlug.filter { it.isDigit() }.toIntOrNull()

                    val matchesEp = (episodeSlug != null && epSlug.equals(episodeSlug, ignoreCase = true)) ||
                        digits == episodeNumber ||
                        ((epName.lowercase().contains("full") || items.size == 1) && episodeNumber == 1)

                    if (matchesEp) {
                        val m3u8 = m3u8Re.find(objStr)?.groupValues?.getOrNull(1)
                        if (!m3u8.isNullOrBlank()) {
                            val (cleanName, cleanDisplay) = cleanSourceName("chophim", "ChoPhim", "ChoPhim", gName, m3u8)
                            return@withContext StreamSource(
                                sourceId = "chophim",
                                name = cleanName,
                                displayName = cleanDisplay,
                                type = StreamType.HLS_DIRECT,
                                url = m3u8,
                                rawUrl = m3u8,
                                priority = 4,
                                quality = "FHD",
                                serverName = gName,
                                isAvailable = true,
                                adFree = true
                            )
                        }
                    }
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }

    // ── On-Device PhimHDCSS (FHDC ByteImg CDN) Native HLS Extractor ──────────

    private fun normalizeAsciiSlug(s: String): String {
        val decomposed = Normalizer.normalize(s.lowercase(), Normalizer.Form.NFD)
        return decomposed
            .replace(Regex("[\\u0300-\\u036f]"), "")
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
    }

    private suspend fun fetchPhimHdcssDirectHls(
        slug: String,
        title: String?,
        episodeNumber: Int,
        serverName: String?
    ): StreamSource? = withContext(Dispatchers.IO) {
        try {
            val reqServer = serverName?.lowercase() ?: ""
            if (Regex("thuy[eế]t\\s*minh|\\btm\\b|l[oồ]ng\\s*ti[eế]ng").containsMatchIn(reqServer)) {
                return@withContext null
            }

            val detailCacheKey = slug.lowercase()
            var detailUrl = phimHdcssDetailCache[detailCacheKey]?.takeIf {
                it.second > System.currentTimeMillis()
            }?.first

            if (detailUrl == null) {
                val query = (title?.takeIf { it.isNotBlank() } ?: slug.replace("-", " ")).trim()
                val searchUrl = "https://phimhdcss.com/?search=${URLEncoder.encode(query, "UTF-8")}"
                val searchHtml = networkModule.okHttpClient.newCall(
                    Request.Builder().url(searchUrl).header("User-Agent", DESKTOP_UA).build()
                ).execute().use { res ->
                    if (!res.isSuccessful) return@withContext null
                    res.body?.string() ?: return@withContext null
                }

                val matches = Regex("""href="(https://phimhdcss\.com/([a-z0-9-]+)-(\d+))"""", RegexOption.IGNORE_CASE)
                    .findAll(searchHtml)
                    .map { it.groupValues[1] to it.groupValues[2].lowercase() }
                    .distinctBy { it.first }
                    .toList()

                val targetSlug = normalizeAsciiSlug(slug)
                val titleSlug = title?.let { normalizeAsciiSlug(it) } ?: ""

                detailUrl = (
                    matches.firstOrNull { it.second == targetSlug }
                        ?: matches.firstOrNull { titleSlug.isNotEmpty() && it.second == titleSlug }
                        ?: matches.firstOrNull {
                            it.second.startsWith(targetSlug) || targetSlug.startsWith(it.second) ||
                                (titleSlug.isNotEmpty() && (it.second.startsWith(titleSlug) || titleSlug.startsWith(it.second)))
                        }
                    )?.first ?: return@withContext null

                phimHdcssDetailCache[detailCacheKey] = detailUrl to (System.currentTimeMillis() + DETAIL_CACHE_TTL_MS)
            }

            val detailHtml = networkModule.okHttpClient.newCall(
                Request.Builder()
                    .url(detailUrl)
                    .header("User-Agent", DESKTOP_UA)
                    .header("Referer", "https://phimhdcss.com/")
                    .build()
            ).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                res.body?.string() ?: return@withContext null
            }

            val epLinks = Regex("""href="(https://phimhdcss\.com/[a-z0-9-]+/(?:tap-[^"'\s]+|full[^"'\s]*))"""", RegexOption.IGNORE_CASE)
                .findAll(detailHtml)
                .map { it.groupValues[1] }
                .distinct()
                .toList()
            if (epLinks.isEmpty()) return@withContext null

            val epRe = Regex("""/tap-0*$episodeNumber-\d+$""", RegexOption.IGNORE_CASE)
            val matchedEpUrl = epLinks.firstOrNull { epRe.containsMatchIn(it) }
                ?: if (episodeNumber == 1) {
                    epLinks.firstOrNull { Regex("""/(?:full|tap-0*1)(?:-\d+)?$""", RegexOption.IGNORE_CASE).containsMatchIn(it) }
                        ?: epLinks.firstOrNull()
                } else null
            if (matchedEpUrl == null) return@withContext null

            val watchHtml = networkModule.okHttpClient.newCall(
                Request.Builder()
                    .url(matchedEpUrl)
                    .header("User-Agent", DESKTOP_UA)
                    .header("Referer", detailUrl)
                    .build()
            ).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                res.body?.string() ?: return@withContext null
            }

            val salt = Regex("""const\s+_0xS\s*=\s*"([^"]+)"""").find(watchHtml)?.groupValues?.getOrNull(1)
                ?: return@withContext null
            val realB64 = Regex("""var\s+realObj\s*=\s*JSON\.parse\(atob\("([^"]+)"\)\)""").find(watchHtml)?.groupValues?.getOrNull(1)
                ?: return@withContext null

            val realJson = String(Base64.decode(realB64, Base64.DEFAULT), Charsets.UTF_8)
            val realObj = networkModule.json.parseToJsonElement(realJson).jsonObject

            val decodedServers = mutableListOf<Pair<String, String>>()
            for ((id, elem) in realObj) {
                val arr = try { elem.jsonArray } catch (_: Exception) { continue }
                val joined = arr.joinToString("") { it.jsonPrimitive.contentOrNull ?: "" }
                val reversed = joined.reversed().replace(salt, "")
                val decodedUrl = try {
                    String(Base64.decode(reversed, Base64.DEFAULT), Charsets.UTF_8).trim()
                } catch (_: Exception) {
                    continue
                }
                if (decodedUrl.startsWith("http")) {
                    decodedServers.add(id to decodedUrl)
                }
            }

            // Priority 1: FHDC (`tiktok.phimhdc.com/embed/...`) -> played directly via SmartHlsDataSource!
            val fhdc = decodedServers.firstOrNull { it.second.contains("phimhdc.com/embed/") }
            if (fhdc != null) {
                return@withContext StreamSource(
                    sourceId = "phimhdcss",
                    name = "PhimHDCSS",
                    displayName = "PhimHDCSS (FHDC)",
                    type = StreamType.HLS_DIRECT,
                    url = fhdc.second,
                    rawUrl = fhdc.second,
                    priority = 3,
                    quality = "FHD",
                    serverName = "PhimHDCSS • FHDC",
                    isAvailable = true,
                    headers = mapOf("Referer" to "https://phimhdcss.com/"),
                    stripPng = true,
                    adFree = true
                )
            }

            // Priority 2: HD direct m3u8
            val hd = decodedServers.firstOrNull {
                it.second.contains(".m3u8") && !it.second.contains("streamxemphimhd")
            }
            if (hd != null) {
                var m3u8 = hd.second
                if (m3u8.contains("link=")) {
                    val inner = m3u8.substringAfter("link=").substringBefore("&")
                    val dec = try { URLDecoder.decode(inner, "UTF-8") } catch (_: Exception) { inner }
                    if (dec.contains(".m3u8")) m3u8 = dec
                }
                return@withContext StreamSource(
                    sourceId = "phimhdcss",
                    name = "PhimHDCSS",
                    displayName = "PhimHDCSS (HD)",
                    type = StreamType.HLS_DIRECT,
                    url = m3u8,
                    rawUrl = m3u8,
                    priority = 3,
                    quality = "FHD",
                    serverName = "PhimHDCSS • HD",
                    isAvailable = true,
                    adFree = true
                )
            }

            null
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun fetchNguonCEmbed(slug: String, episodeNumber: Int, episodeSlug: String?): String? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("https://phim.nguonc.com/api/film/$slug")
                .header("User-Agent", DESKTOP_UA)
                .build()
            val body = networkModule.okHttpClient.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                res.body?.string() ?: return@withContext null
            }
            val root = networkModule.json.parseToJsonElement(body).jsonObject
            val movieObj = root["movie"]?.jsonObject ?: return@withContext null
            val episodesArray = movieObj["episodes"]?.jsonArray ?: return@withContext null

            for (serverElem in episodesArray) {
                val serverObj = serverElem.jsonObject
                val itemsArray = serverObj["items"]?.jsonArray ?: continue
                for (itemElem in itemsArray) {
                    val itemObj = itemElem.jsonObject
                    val name = itemObj["name"]?.jsonPrimitive?.contentOrNull ?: ""
                    val itemSlug = itemObj["slug"]?.jsonPrimitive?.contentOrNull ?: ""
                    val embed = itemObj["embed"]?.jsonPrimitive?.contentOrNull ?: ""

                    val matchesEp = name == episodeNumber.toString() ||
                        (episodeSlug != null && itemSlug == episodeSlug) ||
                        itemSlug == "tap-$episodeNumber"
                    if (matchesEp && embed.isNotBlank()) {
                        return@withContext embed
                    }
                }
            }
        } catch (_: Exception) {}
        null
    }
}
