package com.pvq.cinepvq.data.movie

import com.pvq.cinepvq.core.database.CinepvqDatabase
import com.pvq.cinepvq.core.database.MovieCacheEntity
import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.core.network.model.KKPhimEpisodeServer
import com.pvq.cinepvq.core.network.model.KKPhimMovieDetail
import com.pvq.cinepvq.core.network.model.KKPhimMovieItem
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.domain.model.Movie
import com.pvq.cinepvq.domain.model.MovieDetail
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.util.concurrent.ConcurrentHashMap

class MovieRepository(
    private val networkModule: NetworkModule,
    private val database: CinepvqDatabase
) {
    private val json: Json = networkModule.json
    private val detailMemoryCache = ConcurrentHashMap<String, Pair<MovieDetail, Long>>()

    companion object {
        private const val DETAIL_MEM_CACHE_TTL_MS = 10 * 60 * 1000L
    }

    suspend fun getLatestMovies(page: Int = 1): Result<List<Movie>> = runCatching {
        if (page <= 2) {
            try {
                val unifiedRes = networkModule.cinepvqApi.getUnifiedLatestMovies(page)
                if (unifiedRes.isSuccessful && unifiedRes.body()?.items?.isNotEmpty() == true) {
                    return@runCatching unifiedRes.body()!!.items.map { it.toDomainMovie() }
                }
            } catch (_: Exception) {
                // Fall back seamlessly to KKPhim direct
            }
        }
        val res = networkModule.kkphimApi.getLatestMovies(page)
        if (!res.isSuccessful || res.body() == null) {
            throw Exception("Không thể tải danh sách phim mới")
        }
        res.body()!!.items.map { it.toDomainMovie() }
    }

    suspend fun getMoviesByCategory(category: String, page: Int = 1): Result<List<Movie>> = runCatching {
        val mappedCategory = when (category) {
            "dang-chieu" -> "phim-chieu-rap"
            else -> category
        }
        val res = networkModule.kkphimApi.getMoviesByCategory(mappedCategory, page)
        if (!res.isSuccessful || res.body()?.data == null) {
            throw Exception("Không thể tải danh mục $category")
        }
        val cdn = res.body()!!.data!!.APP_DOMAIN_CDN_IMAGE ?: "https://phimimg.com"
        res.body()!!.data!!.items.map { it.toDomainMovie(cdn) }
    }

    suspend fun getMoviesByGenre(genre: String, page: Int = 1): Result<List<Movie>> = runCatching {
        val mappedGenre = when (genre) {
            "phim-hai" -> "hai-huoc"
            "khoa-hoc-vien-tuong" -> "vien-tuong"
            else -> genre
        }
        val res = networkModule.kkphimApi.getMoviesByGenre(mappedGenre, page)
        if (!res.isSuccessful || res.body()?.data == null) {
            throw Exception("Không thể tải thể loại $genre")
        }
        val cdn = res.body()!!.data!!.APP_DOMAIN_CDN_IMAGE ?: "https://phimimg.com"
        res.body()!!.data!!.items.map { it.toDomainMovie(cdn) }
    }

    suspend fun getMoviesByCountry(country: String, page: Int = 1): Result<List<Movie>> = runCatching {
        val res = networkModule.kkphimApi.getMoviesByCountry(country, page)
        if (!res.isSuccessful || res.body()?.data == null) {
            throw Exception("Không thể tải quốc gia $country")
        }
        val cdn = res.body()!!.data!!.APP_DOMAIN_CDN_IMAGE ?: "https://phimimg.com"
        res.body()!!.data!!.items.map { it.toDomainMovie(cdn) }
    }

    suspend fun searchMovies(keyword: String, page: Int = 1): Result<List<Movie>> = runCatching {
        val trimmed = keyword.trim()
        if (trimmed.isBlank()) return@runCatching emptyList()

        // 1. Primary: Unified 6-Dataset Search (KKPhim1 + VSMOV + NguonC + ChoPhim + PhimHDCSS)
        try {
            val unifiedRes = networkModule.cinepvqApi.searchUnifiedCatalog(trimmed, page)
            if (unifiedRes.isSuccessful && unifiedRes.body() != null) {
                return@runCatching unifiedRes.body()!!.items.map { it.toDomainMovie() }
            }
        } catch (_: Exception) {
            // Fall through to direct KKPhim API if backend is unreachable
        }

        // 2. Offline/Fallback: Direct KKPhim API
        val res = networkModule.kkphimApi.searchMovies(trimmed, page)
        if (!res.isSuccessful || res.body()?.data == null) {
            return@runCatching emptyList()
        }
        val cdn = res.body()!!.data!!.APP_DOMAIN_CDN_IMAGE ?: "https://phimimg.com"
        res.body()!!.data!!.items.map { it.toDomainMovie(cdn) }
    }

    suspend fun getMovieDetail(slug: String): Result<MovieDetail> = runCatching {
        val cacheKey = slug.trim().lowercase()
        val memHit = detailMemoryCache[cacheKey]
        if (memHit != null && memHit.second > System.currentTimeMillis()) {
            return@runCatching memHit.first
        }

        // 1. Fast primary check on KKPhim direct API
        try {
            val res = networkModule.kkphimApi.getMovieDetail(slug)
            if (res.isSuccessful && res.body()?.movie != null && res.body()!!.episodes.isNotEmpty()) {
                val detail = res.body()!!.movie!!.toDomainDetail(res.body()!!.episodes)
                detailMemoryCache[cacheKey] = detail to (System.currentTimeMillis() + DETAIL_MEM_CACHE_TTL_MS)
                cacheMovieDetail(detail, res.body()!!.episodes)
                return@runCatching detail
            }
        } catch (_: Exception) {
            // Fall through to unified multi-dataset backend resolver
        }

        // 2. Unified 6-Dataset Movie Detail Fallback (VSMOV / NguonC / ChoPhim / PhimHDCSS / PostgreSQL)
        try {
            val unifiedRes = networkModule.cinepvqApi.getUnifiedMovieDetail(slug)
            val uMovie = unifiedRes.body()?.movie
            if (unifiedRes.isSuccessful && uMovie != null && uMovie.name.isNotBlank()) {
                val detail = uMovie.toDomainDetail()
                detailMemoryCache[cacheKey] = detail to (System.currentTimeMillis() + DETAIL_MEM_CACHE_TTL_MS)
                val rawEps = uMovie.episodes.map { srv ->
                    KKPhimEpisodeServer(
                        serverName = srv.serverName,
                        serverData = srv.items.map { ep ->
                            com.pvq.cinepvq.core.network.model.KKPhimEpisodeItem(
                                name = ep.name,
                                slug = ep.slug,
                                linkEmbed = ep.embed,
                                linkM3u8 = ep.m3u8
                            )
                        }
                    )
                }
                cacheMovieDetail(detail, rawEps)
                return@runCatching detail
            }
        } catch (_: Exception) {
            // Fall through to local Room cache
        }

        val cached = database.movieCacheDao().getMovieBySlug(slug)
        if (cached != null) {
            return@runCatching cached.toDomainDetail(json)
        }
        throw Exception("Không tìm thấy thông tin phim")
    }

    private suspend fun cacheMovieDetail(detail: MovieDetail, rawEpisodes: List<KKPhimEpisodeServer>) {
        try {
            val episodesJson = json.encodeToString(rawEpisodes)
            database.movieCacheDao().insert(
                MovieCacheEntity(
                    slug = detail.slug,
                    name = detail.name,
                    originalName = detail.originalName,
                    thumbUrl = detail.thumbUrl,
                    posterUrl = detail.posterUrl,
                    description = detail.description,
                    year = detail.year,
                    quality = detail.quality,
                    time = detail.time,
                    episodesJson = episodesJson
                )
            )
        } catch (_: Exception) {}
    }

    private fun KKPhimMovieItem.toDomainMovie(cdnBase: String = "https://phimimg.com"): Movie {
        val thumb = normalizeImg(thumbUrl, cdnBase)
        val poster = normalizeImg(posterUrl, cdnBase).ifBlank { thumb }
        val rawYear = when (val y = year) {
            is kotlinx.serialization.json.JsonPrimitive -> y.contentOrNull ?: ""
            else -> ""
        }
        return Movie(
            slug = slug,
            name = name,
            originalName = originName,
            thumbUrl = thumb,
            posterUrl = poster,
            year = rawYear,
            episodeCurrent = episodeCurrent ?: "",
            quality = quality ?: "FHD",
            time = time ?: ""
        )
    }

    private fun KKPhimMovieDetail.toDomainDetail(episodesList: List<KKPhimEpisodeServer>): MovieDetail {
        val thumb = normalizeImg(thumbUrl)
        val poster = normalizeImg(posterUrl).ifBlank { thumb }
        val rawYear = when (val y = year) {
            is kotlinx.serialization.json.JsonPrimitive -> y.contentOrNull ?: ""
            else -> ""
        }
        val rawTotal = when (val et = episodeTotal) {
            is kotlinx.serialization.json.JsonPrimitive -> et.contentOrNull ?: ""
            else -> ""
        }
        val dir = extractStringOrArray(director)
        val act = extractStringOrArray(actor)

        val mappedEpisodes = episodesList.map { server ->
            EpisodeServer(
                serverName = server.serverName.ifBlank { "Vietsub" },
                items = server.serverData.map { ep ->
                    EpisodeItem(
                        name = ep.name,
                        slug = ep.slug,
                        embed = ep.linkEmbed ?: ep.linkM3u8 ?: "",
                        m3u8Url = ep.linkM3u8
                    )
                }
            )
        }

        return MovieDetail(
            slug = slug,
            name = name,
            originalName = originName,
            thumbUrl = thumb,
            posterUrl = poster,
            description = content ?: "",
            year = rawYear,
            episodeCurrent = episodeCurrent ?: "",
            episodeTotal = rawTotal,
            quality = quality ?: "FHD",
            lang = lang ?: "Vietsub",
            time = time ?: "",
            director = dir,
            actor = act,
            categories = category.map { it.name },
            countries = country.map { it.name },
            episodes = mappedEpisodes
        )
    }

    private fun MovieCacheEntity.toDomainDetail(json: Json): MovieDetail {
        val episodeServers = try {
            val raw: List<KKPhimEpisodeServer> = json.decodeFromString(episodesJson)
            raw.map { server ->
                EpisodeServer(
                    serverName = server.serverName.ifBlank { "Vietsub" },
                    items = server.serverData.map { ep ->
                        EpisodeItem(
                            name = ep.name,
                            slug = ep.slug,
                            embed = ep.linkEmbed ?: ep.linkM3u8 ?: "",
                            m3u8Url = ep.linkM3u8
                        )
                    }
                )
            }
        } catch (_: Exception) {
            emptyList()
        }

        return MovieDetail(
            slug = slug,
            name = name,
            originalName = originalName,
            thumbUrl = thumbUrl,
            posterUrl = posterUrl ?: thumbUrl,
            description = description ?: "",
            year = year ?: "",
            episodeCurrent = "",
            episodeTotal = "",
            quality = quality ?: "FHD",
            lang = "Vietsub",
            time = time ?: "",
            director = "",
            actor = "",
            categories = emptyList(),
            countries = emptyList(),
            episodes = episodeServers
        )
    }

    private fun normalizeImg(url: String?, cdnBase: String = "https://phimimg.com"): String {
        if (url.isNullOrBlank()) return ""
        val trimmed = url.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
        val cleanBase = cdnBase.trimEnd('/')
        val cleanPath = trimmed.trimStart('/')
        return "$cleanBase/$cleanPath"
    }

    private fun com.pvq.cinepvq.core.network.model.UnifiedMovieItemDto.toDomainMovie(): Movie {
        val rawYear = when (val y = year) {
            is kotlinx.serialization.json.JsonPrimitive -> y.contentOrNull ?: ""
            else -> ""
        }
        return Movie(
            slug = slug,
            name = name,
            originalName = originalName,
            thumbUrl = thumbUrl.ifBlank { posterUrl },
            posterUrl = posterUrl.ifBlank { thumbUrl },
            year = rawYear,
            episodeCurrent = currentEpisode,
            quality = quality.ifBlank { "FHD" },
            time = time
        )
    }

    private fun com.pvq.cinepvq.core.network.model.UnifiedMovieDetailDto.toDomainDetail(): MovieDetail {
        val rawYear = when (val y = year) {
            is kotlinx.serialization.json.JsonPrimitive -> y.contentOrNull ?: ""
            else -> ""
        }
        val rawTotal = when (val et = totalEpisodes) {
            is kotlinx.serialization.json.JsonPrimitive -> et.contentOrNull ?: ""
            else -> ""
        }
        return MovieDetail(
            slug = slug,
            name = name,
            originalName = originalName,
            thumbUrl = thumbUrl.ifBlank { posterUrl },
            posterUrl = posterUrl.ifBlank { thumbUrl },
            description = description,
            year = rawYear,
            episodeCurrent = currentEpisode,
            episodeTotal = rawTotal,
            quality = quality.ifBlank { "FHD" },
            lang = language.ifBlank { "Vietsub" },
            time = time,
            director = director,
            actor = casts,
            categories = emptyList(),
            countries = emptyList(),
            episodes = episodes.map { srv ->
                EpisodeServer(
                    serverName = srv.serverName.ifBlank { "Vietsub" },
                    items = srv.items.map { ep ->
                        EpisodeItem(
                            name = ep.name,
                            slug = ep.slug,
                            embed = ep.embed.ifBlank { ep.m3u8 ?: "" },
                            m3u8Url = ep.m3u8
                        )
                    }
                )
            }
        )
    }

    private fun extractStringOrArray(element: kotlinx.serialization.json.JsonElement?): String {
        if (element == null) return ""
        return when (element) {
            is kotlinx.serialization.json.JsonPrimitive -> element.contentOrNull ?: ""
            is kotlinx.serialization.json.JsonArray -> element.mapNotNull {
                (it as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull
            }.filter { it.isNotBlank() }.joinToString(", ")
            else -> ""
        }
    }
}
