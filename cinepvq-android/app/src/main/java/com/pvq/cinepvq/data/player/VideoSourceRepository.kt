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
        val effectiveNguoncEmbed = upstreamNguoncEmbed ?: fallbackEmbed

        // 2. Try Cinepvq Multi-Source Resolver endpoint
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
                                s.url.contains("/player/") ||
                                s.url.contains("embed")
                        val streamType = when {
                            !s.isAvailable -> StreamType.UNAVAILABLE
                            isIframe -> StreamType.EMBED
                            s.type.equals("hls", ignoreCase = true) -> StreamType.HLS_DIRECT
                            s.url.contains(".m3u8") -> StreamType.HLS_DIRECT
                            else -> StreamType.EMBED
                        }
                        streamList.add(
                            StreamSource(
                                sourceId = s.sourceId,
                                name = s.name,
                                displayName = s.displayName,
                                type = streamType,
                                url = s.url,
                                priority = s.priority,
                                quality = s.quality,
                                serverName = s.serverName,
                                isAvailable = s.isAvailable
                            )
                        )
                    }
                }
            }
        } catch (_: Exception) {}

        // 3. Ensure genuine NguonC embed is present if resolved from NguonC upstream
        val hasNguonc = streamList.any { it.sourceId.lowercase().contains("nguonc") }
        if (!hasNguonc && !effectiveNguoncEmbed.isNullOrBlank()) {
            val isIframe = effectiveNguoncEmbed.contains("embed") || effectiveNguoncEmbed.contains("/player/")
            streamList.add(
                StreamSource(
                    sourceId = "nguonc",
                    name = "Server Dự Phòng (NguonC)",
                    displayName = "NguonC (StreamC)",
                    type = if (isIframe) StreamType.EMBED else StreamType.HLS_DIRECT,
                    url = effectiveNguoncEmbed,
                    priority = 4,
                    quality = "FHD",
                    serverName = "NguonC",
                    isAvailable = true
                )
            )
        }

        // 4. Direct KKPhim M3U8 for the selected server (always include if available)
        val serverKey = serverName?.replace(" ", "_") ?: "default"
        val directSourceId = "kkphim_direct_$serverKey"
        val cleanM3u8 = extractDirectM3u8(fallbackM3u8) ?: extractDirectM3u8(fallbackEmbed)
        val alreadyHasUrl = streamList.any { it.url == cleanM3u8 }
        if (!alreadyHasUrl && !cleanM3u8.isNullOrBlank()) {
            streamList.add(
                0, // Top priority for the explicitly selected server
                StreamSource(
                    sourceId = directSourceId,
                    name = "KKPhim Direct (${serverName ?: "HLS"})",
                    displayName = "Server Trực Tiếp (${serverName ?: "HLS"})",
                    type = StreamType.HLS_DIRECT,
                    url = cleanM3u8,
                    priority = 1,
                    quality = "FHD",
                    serverName = serverName ?: "HLS",
                    isAvailable = true
                )
            )
        }

        // 5. Embed URL backup (include if available and not duplicate)
        val hasEmbed = streamList.any { it.sourceId.startsWith("embed_fallback") || it.url == fallbackEmbed }
        if (!hasEmbed && !fallbackEmbed.isNullOrBlank() && fallbackEmbed != cleanM3u8) {
            streamList.add(
                StreamSource(
                    sourceId = "embed_fallback_$serverKey",
                    name = "Server Dự Phòng (Embed)",
                    displayName = "Server Dự Phòng (${serverName ?: "Embed"})",
                    type = StreamType.EMBED,
                    url = fallbackEmbed,
                    priority = 5,
                    quality = "HD",
                    serverName = serverName ?: "Embed",
                    isAvailable = true
                )
            )
        }

        return streamList.sortedBy { it.priority }
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
