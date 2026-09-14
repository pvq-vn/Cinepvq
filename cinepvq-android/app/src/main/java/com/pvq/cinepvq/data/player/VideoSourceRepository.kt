package com.pvq.cinepvq.data.player

import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.domain.model.StreamSource
import com.pvq.cinepvq.domain.model.StreamType

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

        // 1. Try Cinepvq Multi-Source Resolver endpoint
        try {
            val res = networkModule.cinepvqApi.resolveVideoSources(
                slug = slug,
                episode = episode,
                season = season,
                type = type,
                serverName = serverName,
                episodeSlug = episodeSlug,
                nguoncEmbedUrl = fallbackEmbed
            )
            if (res.isSuccessful && res.body()?.sources?.isNotEmpty() == true) {
                res.body()!!.sources.forEach { s ->
                    if (s.isAvailable && s.url.isNotBlank()) {
                        val streamType = when {
                            !s.isAvailable -> StreamType.UNAVAILABLE
                            s.type.equals("hls", ignoreCase = true) || s.url.contains(".m3u8") -> StreamType.HLS_DIRECT
                            s.type.equals("iframe", ignoreCase = true) -> StreamType.EMBED
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

        // 2. Direct KKPhim M3U8 for the selected server (always include if available)
        val serverKey = serverName?.replace(" ", "_") ?: "default"
        val directSourceId = "kkphim_direct_$serverKey"
        val alreadyHasUrl = streamList.any { it.url == fallbackM3u8 }
        if (!alreadyHasUrl && !fallbackM3u8.isNullOrBlank()) {
            val isM3u8 = fallbackM3u8.contains(".m3u8") || fallbackM3u8.contains("/m3u8")
            streamList.add(
                0, // Top priority for the explicitly selected server
                StreamSource(
                    sourceId = directSourceId,
                    name = "KKPhim Direct (${serverName ?: "HLS"})",
                    displayName = "Server Trực Tiếp (${serverName ?: "HLS"})",
                    type = if (isM3u8) StreamType.HLS_DIRECT else StreamType.EMBED,
                    url = fallbackM3u8,
                    priority = 1,
                    quality = "FHD",
                    serverName = serverName ?: "HLS",
                    isAvailable = true
                )
            )
        }

        // 3. Embed URL backup (include if available and not duplicate of HLS)
        val hasEmbed = streamList.any { it.sourceId == "embed_fallback" || it.url == fallbackEmbed }
        if (!hasEmbed && !fallbackEmbed.isNullOrBlank() && fallbackEmbed != fallbackM3u8) {
            val isM3u8 = fallbackEmbed.contains(".m3u8") || fallbackEmbed.contains("/m3u8")
            streamList.add(
                StreamSource(
                    sourceId = "embed_fallback_$serverKey",
                    name = "Server Dự Phòng (Embed)",
                    displayName = "Server Dự Phòng (${serverName ?: "Embed"})",
                    type = if (isM3u8) StreamType.HLS_DIRECT else StreamType.EMBED,
                    url = fallbackEmbed,
                    priority = 4,
                    quality = "HD",
                    serverName = serverName ?: "Embed",
                    isAvailable = true
                )
            )
        }

        return streamList.sortedBy { it.priority }
    }
}
