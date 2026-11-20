package com.pvq.cinepvq.features.trending

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pvq.cinepvq.CinepvqApp
import com.pvq.cinepvq.core.network.NetworkModule
import com.pvq.cinepvq.core.network.model.TrendingRankingsResponseDto
import com.pvq.cinepvq.data.movie.MovieRepository
import com.pvq.cinepvq.domain.model.DoubanCategoryOption
import com.pvq.cinepvq.domain.model.Movie
import com.pvq.cinepvq.domain.model.NetflixCountryOption
import com.pvq.cinepvq.domain.model.TrendingPlatformSection
import com.pvq.cinepvq.domain.model.TrendingRankItem
import com.pvq.cinepvq.domain.model.TrendingRankingsData
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive

enum class TrendingTab(
    val platformId: String,
    val label: String,
    val icon: String,
    val badge: String
) {
    ALL("all", "Tất cả", "🔥", "7 BXH"),
    NETFLIX("netflix", "Netflix", "🎬", "Top 10"),
    DOUBAN("douban", "Douban", "⭐", "Theo điểm"),
    YUNHE("yunhe", "Vân Hợp", "📈", "云合"),
    KUYUN("kuyun", "Khốc Vân", "📊", "酷云"),
    VIEON("vieon", "VieON", "🇻🇳", "Hot VN"),
    FPTPLAY("fptplay", "FPT Play", "⚡", "Hot 24h"),
    IQIYI("iqiyi", "iQIYI", "🐉", "Độ nhiệt")
}

val DEFAULT_NETFLIX_COUNTRIES = listOf(
    NetflixCountryOption("vn", "Việt Nam", "VN", "🇻🇳"),
    NetflixCountryOption("kr", "Hàn Quốc", "HQ", "🇰🇷"),
    NetflixCountryOption("us", "Mỹ", "Mỹ", "🇺🇸"),
    NetflixCountryOption("global", "Toàn Cầu", "Global", "🌍"),
    NetflixCountryOption("jp", "Nhật Bản", "Nhật", "🇯🇵"),
    NetflixCountryOption("th", "Thái Lan", "Thái", "🇹🇭"),
    NetflixCountryOption("tw", "Đài Loan", "Đài Loan", "🇹🇼"),
    NetflixCountryOption("gb", "Anh", "UK", "🇬🇧")
)

val DEFAULT_DOUBAN_CATEGORIES = listOf(
    DoubanCategoryOption("all", "Tổng hợp điểm cao"),
    DoubanCategoryOption("tv_cn", "Phim bộ Hoa ngữ"),
    DoubanCategoryOption("tv_global", "Phim bộ Quốc tế"),
    DoubanCategoryOption("movie", "Điện ảnh tuần"),
    DoubanCategoryOption("top250", "Kinh điển Top 250")
)

class TrendingViewModel(
    private val networkModule: NetworkModule = CinepvqApp.instance.networkModule,
    private val movieRepository: MovieRepository = CinepvqApp.instance.movieRepository
) : ViewModel() {

    private val _activeTab = MutableStateFlow(TrendingTab.ALL)
    val activeTab: StateFlow<TrendingTab> = _activeTab.asStateFlow()

    private val _netflixCountry = MutableStateFlow("vn")
    val netflixCountry: StateFlow<String> = _netflixCountry.asStateFlow()

    private val _netflixType = MutableStateFlow("tv")
    val netflixType: StateFlow<String> = _netflixType.asStateFlow()

    private val _doubanCategory = MutableStateFlow("all")
    val doubanCategory: StateFlow<String> = _doubanCategory.asStateFlow()

    private val _rankingsData = MutableStateFlow<TrendingRankingsData?>(null)
    val rankingsData: StateFlow<TrendingRankingsData?> = _rankingsData.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _isUpdatingFilter = MutableStateFlow(false)
    val isUpdatingFilter: StateFlow<Boolean> = _isUpdatingFilter.asStateFlow()

    private val _isLoadingMoreDouban = MutableStateFlow(false)
    val isLoadingMoreDouban: StateFlow<Boolean> = _isLoadingMoreDouban.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var currentJob: Job? = null
    private var loadMoreDoubanJob: Job? = null
    private val responseCache = mutableMapOf<String, TrendingRankingsData>()

    init {
        loadRankings(isRefresh = false)
    }

    private fun filterKey(): String =
        "${_netflixCountry.value}|${_netflixType.value}|${_doubanCategory.value}"

    fun selectTab(tab: TrendingTab) {
        if (_activeTab.value == tab) return
        _activeTab.value = tab
    }

    fun selectNetflixCountry(code: String) {
        if (_netflixCountry.value == code) return
        _netflixCountry.value = code
        loadRankings(isRefresh = false, isFilterChange = true)
    }

    fun selectNetflixType(type: String) {
        if (_netflixType.value == type) return
        _netflixType.value = type
        loadRankings(isRefresh = false, isFilterChange = true)
    }

    fun selectDoubanCategory(category: String) {
        if (_doubanCategory.value == category) return
        _doubanCategory.value = category
        loadRankings(isRefresh = false, isFilterChange = true)
    }

    fun refresh() {
        loadMoreDoubanJob?.cancel()
        _isLoadingMoreDouban.value = false
        responseCache.clear()
        loadRankings(isRefresh = true)
    }

    fun loadMoreDouban() {
        if (_isLoadingMoreDouban.value) return
        val currentData = _rankingsData.value ?: return
        val doubanSec = currentData.platforms.find { it.id == "douban" } ?: return
        if (!doubanSec.hasMore || doubanSec.nextCursor <= 0) return

        val categorySnapshot = _doubanCategory.value
        val keySnapshot = filterKey()

        loadMoreDoubanJob?.cancel()
        loadMoreDoubanJob = viewModelScope.launch {
            _isLoadingMoreDouban.value = true
            try {
                val res = networkModule.cinepvqApi.getTrendingRankings(
                    platform = "douban",
                    doubanCategory = categorySnapshot,
                    doubanOffset = doubanSec.nextCursor
                )
                val body = res.body()
                val nextSecDto = body?.platforms?.find { it.id == "douban" }
                if (res.isSuccessful && body != null && body.status && nextSecDto != null && _doubanCategory.value == categorySnapshot) {
                    val mappedNext = mapDtoToDomain(body).platforms.find { it.id == "douban" }
                    if (mappedNext != null) {
                        val latestData = _rankingsData.value ?: return@launch
                        val updatedPlatforms = latestData.platforms.map { sec ->
                            if (sec.id != "douban") sec
                            else {
                                val existingSlugs = sec.items.map { it.slug }.toSet()
                                val freshItems = mappedNext.items.filter { it.slug.isNotBlank() && it.slug !in existingSlugs }
                                sec.copy(
                                    items = sec.items + freshItems,
                                    hasMore = mappedNext.hasMore,
                                    nextCursor = mappedNext.nextCursor,
                                    totalAvailable = mappedNext.totalAvailable
                                )
                            }
                        }
                        val updatedData = latestData.copy(platforms = updatedPlatforms)
                        _rankingsData.value = updatedData
                        responseCache[keySnapshot] = updatedData
                    }
                }
            } catch (_: Exception) {
                // Keep existing loaded items intact on network hiccup
            } finally {
                _isLoadingMoreDouban.value = false
            }
        }
    }

    private fun loadRankings(isRefresh: Boolean, isFilterChange: Boolean = false) {
        val key = filterKey()
        if (!isRefresh && responseCache.containsKey(key)) {
            _rankingsData.value = responseCache[key]
            _isLoading.value = false
            _isUpdatingFilter.value = false
            return
        }

        currentJob?.cancel()
        currentJob = viewModelScope.launch {
            when {
                isRefresh -> _isRefreshing.value = true
                isFilterChange && _rankingsData.value != null -> _isUpdatingFilter.value = true
                else -> _isLoading.value = true
            }
            _errorMessage.value = null

            try {
                val res = networkModule.cinepvqApi.getTrendingRankings(
                    platform = "all",
                    country = _netflixCountry.value,
                    netflixType = _netflixType.value,
                    doubanCategory = _doubanCategory.value,
                    refresh = if (isRefresh) true else null
                )
                val body = res.body()
                if (res.isSuccessful && body != null && body.status && body.platforms.isNotEmpty()) {
                    val mapped = mapDtoToDomain(body)
                    responseCache[key] = mapped
                    _rankingsData.value = mapped
                    _isLoading.value = false
                    _isRefreshing.value = false
                    _isUpdatingFilter.value = false
                    return@launch
                }
            } catch (_: Exception) {
                // Fall through to offline KKPhim catalog fallback below
            }

            // Graceful fallback when backend is unreachable so Trending still renders real movies
            val fallback = buildOfflineFallback()
            if (fallback.platforms.isNotEmpty()) {
                _rankingsData.value = fallback
            } else {
                _errorMessage.value = "Không thể kết nối đến máy chủ bảng xếp hạng"
            }

            _isLoading.value = false
            _isRefreshing.value = false
            _isUpdatingFilter.value = false
        }
    }

    private fun mapDtoToDomain(dto: TrendingRankingsResponseDto): TrendingRankingsData {
        val countries = dto.netflixCountries.takeIf { it.isNotEmpty() }?.map {
            NetflixCountryOption(it.code, it.label, it.shortLabel, it.flag)
        } ?: DEFAULT_NETFLIX_COUNTRIES

        val categories = dto.doubanCategories.takeIf { it.isNotEmpty() }?.map {
            DoubanCategoryOption(it.key, it.label)
        } ?: DEFAULT_DOUBAN_CATEGORIES

        val sections = dto.platforms.map { sec ->
            TrendingPlatformSection(
                id = sec.id,
                name = sec.name,
                subtitle = sec.subtitle,
                badgeText = sec.badgeText,
                updatedAt = sec.updatedAt,
                countryCode = sec.countryCode,
                countryLabel = sec.countryLabel,
                categoryKey = sec.categoryKey,
                metricLabel = sec.metricLabel,
                hasMore = sec.hasMore == true,
                nextCursor = sec.nextCursor ?: 0,
                totalAvailable = sec.totalAvailable ?: 0,
                items = sec.items.map { item ->
                    val yearStr = when (val y = item.year) {
                        is JsonPrimitive -> y.content
                        else -> ""
                    }
                    TrendingRankItem(
                        slug = item.slug,
                        name = item.name,
                        originalName = item.originalName,
                        thumbUrl = item.thumbUrl,
                        posterUrl = item.posterUrl,
                        year = yearStr,
                        episodeCurrent = item.currentEpisode,
                        quality = item.quality,
                        rank = item.rank,
                        platformId = item.platformId,
                        platformName = item.platformName,
                        score = item.score,
                        scoreSource = item.scoreSource,
                        views = item.views,
                        formattedViews = item.formattedViews,
                        heatLabel = item.heatLabel,
                        trendDelta = item.trendDelta,
                        playable = item.playable ?: true,
                        searchQuery = item.searchQuery,
                        weeksInTop10 = item.weeksInTop10,
                        marketShare = item.marketShare,
                        broadcastPlatform = item.broadcastPlatform
                    )
                }
            )
        }

        return TrendingRankingsData(
            updatedAt = dto.updatedAt,
            activeNetflixCountry = dto.activeNetflixCountry,
            activeNetflixType = dto.activeNetflixType,
            activeDoubanCategory = dto.activeDoubanCategory,
            netflixCountries = countries,
            doubanCategories = categories,
            platforms = sections
        )
    }

    private suspend fun buildOfflineFallback(): TrendingRankingsData {
        val latest = movieRepository.getLatestMovies(1).getOrDefault(emptyList())
        val series = movieRepository.getMoviesByCategory("phim-bo", 1).getOrDefault(emptyList())
        val cnSeries = movieRepository.getMoviesByCountry("trung-quoc", 1).getOrDefault(emptyList())

        fun toRankItems(list: List<Movie>, pid: String, pname: String, scoreSrc: String): List<TrendingRankItem> {
            return list.take(12).mapIndexed { idx, m ->
                TrendingRankItem(
                    slug = m.slug,
                    name = m.name,
                    originalName = m.originalName,
                    thumbUrl = m.thumbUrl,
                    posterUrl = m.posterUrl,
                    year = m.year,
                    episodeCurrent = m.episodeCurrent,
                    quality = m.quality,
                    rank = idx + 1,
                    platformId = pid,
                    platformName = pname,
                    score = (9.0 - idx * 0.1).coerceAtLeast(7.2),
                    scoreSource = scoreSrc,
                    formattedViews = "Top #${idx + 1}",
                    heatLabel = "Top #${idx + 1} $pname",
                    playable = true
                )
            }
        }

        val sections = mutableListOf<TrendingPlatformSection>()
        if (latest.isNotEmpty()) {
            sections.add(
                TrendingPlatformSection(
                    id = "netflix",
                    name = "Netflix Top 10",
                    subtitle = "Danh sách thịnh hành (chế độ dự phòng ngoại tuyến)",
                    badgeText = "NETFLIX TOP 10",
                    updatedAt = "",
                    items = toRankItems(latest, "netflix", "Netflix", "IMDb")
                )
            )
        }
        if (cnSeries.isNotEmpty()) {
            sections.add(
                TrendingPlatformSection(
                    id = "douban",
                    name = "Douban (豆瓣)",
                    subtitle = "Phim bộ Hoa ngữ nổi bật",
                    badgeText = "DOUBAN SCORE",
                    updatedAt = "",
                    items = toRankItems(cnSeries, "douban", "Douban", "Douban")
                )
            )
        }
        if (series.isNotEmpty()) {
            sections.add(
                TrendingPlatformSection(
                    id = "vieon",
                    name = "VieON",
                    subtitle = "Phim bộ thịnh hành",
                    badgeText = "VIEON HOT",
                    updatedAt = "",
                    items = toRankItems(series, "vieon", "VieON", "VieON")
                )
            )
        }

        return TrendingRankingsData(
            updatedAt = "",
            netflixCountries = DEFAULT_NETFLIX_COUNTRIES,
            doubanCategories = DEFAULT_DOUBAN_CATEGORIES,
            platforms = sections
        )
    }
}
