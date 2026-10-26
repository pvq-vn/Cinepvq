package com.pvq.cinepvq.data.player

import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.net.URLDecoder

class VideoSourceRepository(private val networkModule: NetworkModule) {

    suspend fun resolveStreams(
        slug: String,
        episode: Int = 1,
        season: Int = 1,
        type: String = "series",
        serverName: String? = null,
        episodeSlug: String? = null,
        fallbackM3u8: String? = null,
        fallbackEmbed: String? = null
    ): List<StreamSource> {
        val streamList = mutableListOf<StreamSource>()

        // 1. Try fetching upstream genuine NguonC embed directly from NguonC API
        val upstreamNguoncEmbed = fetchNguonCEmbed(slug, episode, episodeSlug)
        val effectiveNguoncEmbed = if (fallbackEmbed?.contains("nguonc") == true || fallbackEmbed?.contains("streamc") == true) fallbackEmbed else upstreamNguoncEmbed

        // 2. Try fetching upstream genuine VSMOV embed directly from VSMOV API
        val upstreamVsmovEmbed = fetchVsmovEmbed(slug, episode, episodeSlug, serverName)
        val effectiveVsmovEmbed = if (fallbackEmbed?.contains("vsmov") == true) fallbackEmbed else upstreamVsmovEmbed

        // 3. Try Cinepvq Multi-Source Resolver endpoint
        try {
            val res = networkModule.cinepvqApi.resolveVideoSources(
                slug = slug,
                episode = episode,
                season = season,
                type = type,
                serverName = serverName,
                episodeSlug = episodeSlug,
                nguoncEmbedUrl = effectiveNguoncEmbed
            )
            if (res.isSuccessful && res.body()?.sources?.isNotEmpty() == true) {
                res.body()!!.sources.forEach { s ->
                    if (s.isAvailable && s.url.isNotBlank()) {
                        val isIframe = s.type.equals("iframe", ignoreCase = true) ||
                                s.type.equals("embed", ignoreCase = true) ||
                                s.sourceId.lowercase().contains("nguonc") ||
                                s.sourceId.lowercase().contains("vsmov") ||
                                s.url.contains("/player/") ||
                                s.url.contains("embed")
                        val streamType = when {
                            !s.isAvailable -> StreamType.UNAVAILABLE
                            isIframe -> StreamType.EMBED
                            s.type.equals("hls", ignoreCase = true) -> StreamType.HLS_DIRECT
                            s.url.contains(".m3u8") -> StreamType.HLS_DIRECT
                            else -> StreamType.EMBED
                        }
                        val (cleanName, cleanDisplay) = cleanSourceName(s.sourceId, s.name, s.displayName, s.serverName ?: serverName, s.url)
                        val p = when (cleanName) {
                            "K20" -> 1
                            "KKphim1" -> 2
                            "VSMOV" -> 3
                            "NguonC" -> 4
                            else -> s.priority
                        }
                        streamList.add(
                            StreamSource(
                                sourceId = s.sourceId,
                                name = cleanName,
                                displayName = cleanDisplay,
                                type = streamType,
                                url = s.url,
                                priority = p,
                                quality = s.quality,
                                serverName = s.serverName,
                                isAvailable = s.isAvailable
                            )
                        )
                    }
                }
            }
        } catch (_: Exception) {}

        // 4. Ensure genuine VSMOV embed is present (ONLY if URL is genuinely from vsmov / streamvsmov)
        val hasVsmov = streamList.any { it.sourceId.lowercase().contains("vsmov") || it.url.contains("vsmov") || it.name == "VSMOV" }
        if (!hasVsmov && !effectiveVsmovEmbed.isNullOrBlank() && (effectiveVsmovEmbed.contains("vsmov") || effectiveVsmovEmbed.contains("streamvsmov"))) {
            val isIframe = effectiveVsmovEmbed.contains("embed") || effectiveVsmovEmbed.contains("/player/") || effectiveVsmovEmbed.contains("/video/")
            val (cleanName, cleanDisplay) = cleanSourceName("vsmov", "VSMOV", "VSMOV", serverName, effectiveVsmovEmbed)
            streamList.add(
                StreamSource(
                    sourceId = "vsmov",
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = if (isIframe) StreamType.EMBED else StreamType.HLS_DIRECT,
                    url = effectiveVsmovEmbed,
                    priority = 3,
                    quality = "HD",
                    serverName = serverName ?: "VSMOV",
                    isAvailable = true
                )
            )
        }

        // 5. Ensure genuine NguonC embed is present if resolved from NguonC upstream
        val hasNguonc = streamList.any { it.sourceId.lowercase().contains("nguonc") || it.url.contains("streamc") || it.url.contains("nguonc") || it.name == "NguonC" }
        if (!hasNguonc && !effectiveNguoncEmbed.isNullOrBlank() && (effectiveNguoncEmbed.contains("streamc") || effectiveNguoncEmbed.contains("nguonc"))) {
            val isIframe = effectiveNguoncEmbed.contains("embed") || effectiveNguoncEmbed.contains("/player/")
            val (cleanName, cleanDisplay) = cleanSourceName("nguonc", "NguonC", "NguonC", serverName, effectiveNguoncEmbed)
            streamList.add(
                StreamSource(
                    sourceId = "nguonc",
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = if (isIframe) StreamType.EMBED else StreamType.HLS_DIRECT,
                    url = effectiveNguoncEmbed,
                    priority = 4,
                    quality = "FHD",
                    serverName = serverName ?: "NguonC",
                    isAvailable = true
                )
            )
        }

        // 6. Direct KKPhim M3U8 for the selected server (always include if available)
        val serverKey = serverName?.replace(" ", "_") ?: "default"
        val directSourceId = "kkphim_direct_$serverKey"
        val cleanM3u8 = extractDirectM3u8(fallbackM3u8) ?: extractDirectM3u8(fallbackEmbed)
        val alreadyHasDirectKkphim = streamList.any { (it.name == "KKphim1" && it.type == StreamType.HLS_DIRECT) || it.url == cleanM3u8 }
        if (!alreadyHasDirectKkphim && !cleanM3u8.isNullOrBlank()) {
            val (cleanName, cleanDisplay) = cleanSourceName(directSourceId, "KKphim1", "KKphim1", serverName, cleanM3u8)
            streamList.add(
                StreamSource(
                    sourceId = directSourceId,
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = StreamType.HLS_DIRECT,
                    url = cleanM3u8,
                    priority = 2,
                    quality = "FHD",
                    serverName = serverName ?: "HLS",
                    isAvailable = true
                )
            )
        }

        // 7. KKPhim embed backup (ONLY include if NO direct KKphim stream is available)
        val hasDirectKkphim = streamList.any { it.name == "KKphim1" && it.type == StreamType.HLS_DIRECT }
        val alreadyHasEmbedUrl = streamList.any { it.url == fallbackEmbed }
        if (!hasDirectKkphim && !alreadyHasEmbedUrl && !fallbackEmbed.isNullOrBlank() && fallbackEmbed != cleanM3u8) {
            val isKkphimEmbed = fallbackEmbed.contains("phimapi") || fallbackEmbed.contains("kkphim") || fallbackEmbed.contains("ophim")
            val fallbackSourceId = "kkphim_embed_$serverKey"
            val fallbackName = if (isKkphimEmbed) "KKphim1" else "Server Dự Phòng"
            val (cleanName, cleanDisplay) = cleanSourceName(fallbackSourceId, fallbackName, "$fallbackName (Embed)", serverName, fallbackEmbed)
            streamList.add(
                StreamSource(
                    sourceId = fallbackSourceId,
                    name = cleanName,
                    displayName = cleanDisplay,
                    type = StreamType.EMBED,
                    url = fallbackEmbed,
                    priority = 5,
                    quality = "HD",
                    serverName = serverName ?: "KKphim",
                    isAvailable = true
                )
            )
        }

        // Deduplicate: Distinct by (providerName + streamType) and URL, allowing at most 1 Direct and 1 Embed per provider
        val distinctSources = mutableListOf<StreamSource>()
        val seenKeys = mutableSetOf<String>()
        val seenUrls = mutableSetOf<String>()

        // Sort by priority first so HLS Direct KKphim1 is kept over Embed KKphim1
        val sortedCandidates = streamList.sortedWith(
            compareBy<StreamSource> { it.priority }
                .thenBy { if (it.type == StreamType.HLS_DIRECT) 0 else 1 }
        )

        for (s in sortedCandidates) {
            val key = "${s.name}_${s.type}"
            if (!seenKeys.contains(key) && !seenUrls.contains(s.url)) {
                seenKeys.add(key)
                seenUrls.add(s.url)
                distinctSources.add(s)
            }
        }

        return distinctSources.sortedBy { it.priority }
    }

    companion object {
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
                        if (u.contains("vsmov") || u.contains("streamvsmov")) "VSMOV"
                        else if (u.contains("nguonc") || u.contains("streamc")) "NguonC"
                        else "KKphim1"
                    } else cleaned
                }
            }

            val finalDisplay = when {
                baseName == "K20" -> if (audioLabel != null) "K20 Direct ($audioLabel)" else "K20 Direct"
                baseName == "VSMOV" -> if (audioLabel != null) "VSMOV ($audioLabel)" else "VSMOV"
                baseName == "NguonC" -> if (audioLabel != null) "NguonC ($audioLabel)" else "NguonC"
                baseName == "KKphim1" -> {
                    val isEmbed = u.contains("/player/") || u.contains("embed") || sid.contains("embed") || rName.contains("embed") || rDisp.contains("embed")
                    if (isEmbed) {
                        if (audioLabel != null) "KKphim1 (Embed $audioLabel)" else "KKphim1 (Embed)"
                    } else {
                        if (audioLabel != null) "KKphim1 Direct ($audioLabel)" else "KKphim1 Direct"
                    }
                }
                else -> if (audioLabel != null && !baseName.contains(audioLabel, ignoreCase = true)) {
                    "$baseName ($audioLabel)"
                } else baseName
            }

            return Pair(baseName, finalDisplay)
        }
    }

    private suspend fun fetchVsmovEmbed(slug: String, episodeNumber: Int, episodeSlug: String?, serverName: String?): String? = withContext(Dispatchers.IO) {
        try {
            val req = okhttp3.Request.Builder()
                .url("https://vsmov.com/api/phim/$slug")
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36")
                .build()
            val res = networkModule.okHttpClient.newCall(req).execute()
            if (!res.isSuccessful) return@withContext null
            val body = res.body?.string() ?: return@withContext null
            val root = networkModule.json.parseToJsonElement(body).jsonObject
            val episodesArray = root["episodes"]?.jsonArray ?: return@withContext null

            for (groupElem in episodesArray) {
                val groupObj = groupElem.jsonObject
                val serverData = groupObj["server_data"]?.jsonArray ?: continue
                for (itemElem in serverData) {
                    val itemObj = itemElem.jsonObject
                    val name = itemObj["name"]?.jsonPrimitive?.contentOrNull ?: ""
                    val itemSlug = itemObj["slug"]?.jsonPrimitive?.contentOrNull ?: ""
                    val embed = itemObj["link_embed"]?.jsonPrimitive?.contentOrNull
                        ?: itemObj["link_m3u8"]?.jsonPrimitive?.contentOrNull ?: ""

                    val matchesEp = name == episodeNumber.toString() ||
                            (episodeSlug != null && itemSlug.equals(episodeSlug, ignoreCase = true)) ||
                            itemSlug.equals("tap-$episodeNumber", ignoreCase = true) ||
                            (name.lowercase().contains("full") && episodeNumber == 1)
                    if (matchesEp && embed.isNotBlank()) {
                        return@withContext embed
                    }
                }
            }
        } catch (_: Exception) {}
        null
    }

    private suspend fun fetchNguonCEmbed(slug: String, episodeNumber: Int, episodeSlug: String?): String? = withContext(Dispatchers.IO) {
        try {
            val req = okhttp3.Request.Builder()
                .url("https://phim.nguonc.com/api/film/$slug")
                .header("User-Agent", "Mozilla/5.0")
                .build()
            val res = networkModule.okHttpClient.newCall(req).execute()
            if (!res.isSuccessful) return@withContext null
            val body = res.body?.string() ?: return@withContext null
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

    private fun extractDirectM3u8(url: String?): String? {
        if (url.isNullOrBlank()) return null
        if (url.contains(".m3u8") && !url.contains("/player/")) return url
        if (url.contains("url=")) {
            val extracted = url.substringAfter("url=").substringBefore("&")
            val decoded = try { URLDecoder.decode(extracted, "UTF-8") } catch (_: Exception) { extracted }
            if (decoded.contains(".m3u8")) return decoded
        }
        return null
    }
}
