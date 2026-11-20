package com.pvq.cinepvq.features.trending

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.pvq.cinepvq.core.designsystem.components.*
import com.pvq.cinepvq.domain.model.DoubanCategoryOption
import com.pvq.cinepvq.domain.model.NetflixCountryOption
import com.pvq.cinepvq.domain.model.TrendingPlatformSection
import com.pvq.cinepvq.domain.model.TrendingRankItem
import com.pvq.cinepvq.ui.theme.*
import java.util.Locale

private fun platformGradient(platformId: String): List<Color> = when (platformId) {
    "netflix" -> listOf(Color(0xFFDC2626), Color(0xFF991B1B))
    "douban" -> listOf(Color(0xFF059669), Color(0xFF0F766E))
    "yunhe" -> listOf(Color(0xFF0284C7), Color(0xFF4338CA))
    "kuyun" -> listOf(Color(0xFF7C3AED), Color(0xFFA21CAF))
    "vieon" -> listOf(Color(0xFF65A30D), Color(0xFF15803D))
    "fptplay" -> listOf(Color(0xFFF97316), Color(0xFFDC2626))
    "iqiyi" -> listOf(Color(0xFF0D9488), Color(0xFF0891B2))
    else -> listOf(CinepvqAmber, Color(0xFFEF4444))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrendingScreen(
    onMovieClick: (String) -> Unit,
    onSearchQueryClick: ((String) -> Unit)? = null,
    onBarsVisibilityChanged: ((Boolean) -> Unit)? = null,
    viewModel: TrendingViewModel = viewModel()
) {
    val activeTab by viewModel.activeTab.collectAsStateWithLifecycle()
    val netflixCountry by viewModel.netflixCountry.collectAsStateWithLifecycle()
    val netflixType by viewModel.netflixType.collectAsStateWithLifecycle()
    val doubanCategory by viewModel.doubanCategory.collectAsStateWithLifecycle()
    val rankingsData by viewModel.rankingsData.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val isUpdatingFilter by viewModel.isUpdatingFilter.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    val listState = rememberLazyListState()
    val tabRowState = rememberLazyListState()
    val compactRowState = rememberLazyListState()

    var isHeaderCollapsed by remember { mutableStateOf(false) }
    var lastScrollIndex by remember { mutableIntStateOf(0) }
    var lastScrollOffset by remember { mutableIntStateOf(0) }

    // Always scroll cleanly to top and reset collapsed header when switching platform/country/category!
    LaunchedEffect(activeTab, netflixCountry, netflixType, doubanCategory) {
        listState.scrollToItem(0)
        isHeaderCollapsed = false
        lastScrollIndex = 0
        lastScrollOffset = 0
        onBarsVisibilityChanged?.invoke(true)
        val idx = TrendingTab.entries.indexOf(activeTab)
        if (idx >= 0) {
            tabRowState.animateScrollToItem(idx)
            compactRowState.animateScrollToItem(idx)
        }
    }

    LaunchedEffect(listState) {
        snapshotFlow {
            listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset
        }.collect { (index, offset) ->
            val isAtTop = index == 0 && offset < 20
            if (isAtTop) {
                if (isHeaderCollapsed) isHeaderCollapsed = false
                onBarsVisibilityChanged?.invoke(true)
            } else {
                val isScrollingDown = index > lastScrollIndex || (index == lastScrollIndex && offset > lastScrollOffset + 15)
                val isScrollingUp = index < lastScrollIndex || (index == lastScrollIndex && offset < lastScrollOffset - 15)

                if (isScrollingDown) {
                    if (!isHeaderCollapsed) isHeaderCollapsed = true
                    onBarsVisibilityChanged?.invoke(false)
                } else if (isScrollingUp) {
                    onBarsVisibilityChanged?.invoke(true)
                }
            }
            lastScrollIndex = index
            lastScrollOffset = offset
        }
    }

    val allSections = rankingsData?.platforms ?: emptyList()
    val visibleSections = remember(allSections, activeTab) {
        if (activeTab == TrendingTab.ALL) allSections
        else allSections.filter { it.id == activeTab.platformId }
    }
    val netflixCountries = rankingsData?.netflixCountries ?: DEFAULT_NETFLIX_COUNTRIES
    val doubanCategories = rankingsData?.doubanCategories ?: DEFAULT_DOUBAN_CATEGORIES
    val spotlightItem = visibleSections.firstOrNull()?.items?.firstOrNull()

    val handleItemClick: (TrendingRankItem) -> Unit = { item ->
        if (item.playable) {
            onMovieClick(item.slug)
        } else {
            onSearchQueryClick?.invoke(item.searchQuery ?: item.name)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
    ) {
        // ── Full Header ───────────────────────────────────────────────────────
        AnimatedVisibility(
            visible = !isHeaderCollapsed,
            enter = expandVertically(animationSpec = tween(250)) + fadeIn(),
            exit = shrinkVertically(animationSpec = tween(200)) + fadeOut()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(CinepvqAmber.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Whatshot,
                                contentDescription = null,
                                tint = CinepvqAmber,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "BXH Đa Nền Tảng Real-time",
                                color = CinepvqAmber,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    if (isUpdatingFilter) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = CinepvqPrimary,
                            strokeWidth = 2.dp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Thịnh Hành & Bảng Xếp Hạng",
                    color = CinepvqTextPrimary,
                    fontSize = 21.sp,
                    fontWeight = FontWeight.Black
                )

                Text(
                    text = "Netflix Quốc Gia • Douban Theo Điểm • Vân Hợp • Khốc Vân • VieON • FPT • iQIYI",
                    color = CinepvqTextMuted,
                    fontSize = 11.sp,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 2.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(
                    state = tabRowState,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(horizontal = 2.dp)
                ) {
                    items(TrendingTab.entries.toTypedArray(), key = { it.name }) { tab ->
                        val isSelected = activeTab == tab
                        val grad = platformGradient(tab.platformId)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isSelected) Brush.horizontalGradient(grad)
                                    else Brush.linearGradient(listOf(CinepvqSurface, CinepvqSurface))
                                )
                                .border(
                                    width = 1.dp,
                                    color = if (isSelected) Color.White.copy(alpha = 0.3f) else CinepvqBorderSubtle,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable { viewModel.selectTab(tab) }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Text(text = tab.icon, fontSize = 12.sp)
                                Text(
                                    text = tab.label,
                                    color = if (isSelected) Color.White else CinepvqTextSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }

        // ── Compact Sticky Header on Scroll ──────────────────────────────────
        AnimatedVisibility(
            visible = isHeaderCollapsed,
            enter = expandVertically(animationSpec = tween(200)) + fadeIn(),
            exit = shrinkVertically(animationSpec = tween(180)) + fadeOut()
        ) {
            Surface(
                color = CinepvqSurface,
                shadowElevation = 4.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Whatshot,
                        contentDescription = null,
                        tint = CinepvqAmber,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    LazyRow(
                        state = compactRowState,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(TrendingTab.entries.toTypedArray(), key = { it.name }) { tab ->
                            val isSelected = activeTab == tab
                            val grad = platformGradient(tab.platformId)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(
                                        if (isSelected) Brush.horizontalGradient(grad)
                                        else Brush.linearGradient(listOf(CinepvqSurfaceVariant, CinepvqSurfaceVariant))
                                    )
                                    .clickable { viewModel.selectTab(tab) }
                                    .padding(horizontal = 10.dp, vertical = 5.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(text = tab.icon, fontSize = 11.sp)
                                    Text(
                                        text = tab.label,
                                        color = if (isSelected) Color.White else CinepvqTextSecondary,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Main Content ─────────────────────────────────────────────────────
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                isLoading && allSections.isEmpty() -> LoadingView()
                errorMessage != null && allSections.isEmpty() -> ErrorView(
                    message = errorMessage ?: "Không thể tải bảng xếp hạng",
                    onRetry = { viewModel.refresh() }
                )
                visibleSections.isEmpty() -> EmptyView(message = "Chưa có dữ liệu bảng xếp hạng")
                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Spotlight Top #1 Hero Card
                        if (spotlightItem != null) {
                            item(key = "spotlight_${spotlightItem.platformId}_${spotlightItem.slug}") {
                                TrendingSpotlightHero(
                                    item = spotlightItem,
                                    onClick = { handleItemClick(spotlightItem) }
                                )
                            }
                        }

                        // Platform Sections
                        items(
                            items = visibleSections,
                            key = { "${it.id}_${it.countryCode ?: ""}_${it.categoryKey ?: ""}" }
                        ) { section ->
                            PlatformSectionCard(
                                section = section,
                                expanded = activeTab != TrendingTab.ALL,
                                netflixCountries = netflixCountries,
                                selectedNetflixCountry = netflixCountry,
                                selectedNetflixType = netflixType,
                                onSelectNetflixCountry = { viewModel.selectNetflixCountry(it) },
                                onSelectNetflixType = { viewModel.selectNetflixType(it) },
                                doubanCategories = doubanCategories,
                                selectedDoubanCategory = doubanCategory,
                                onSelectDoubanCategory = { viewModel.selectDoubanCategory(it) },
                                onExpandPlatform = { pid ->
                                    TrendingTab.entries.find { it.platformId == pid }?.let {
                                        viewModel.selectTab(it)
                                    }
                                },
                                onItemClick = handleItemClick
                            )
                        }

                        item { Spacer(modifier = Modifier.height(76.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun TrendingSpotlightHero(
    item: TrendingRankItem,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    val backdrop = item.posterUrl.ifBlank { item.thumbUrl }
    val poster = item.thumbUrl.ifBlank { item.posterUrl }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CinepvqSurface,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        shadowElevation = 8.dp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            if (backdrop.isNotBlank()) {
                AsyncImage(
                    model = ImageRequest.Builder(context).data(backdrop).crossfade(true).build(),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .matchParentSize()
                )
            }
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                Color(0xF009090B),
                                Color(0xD909090B),
                                Color(0x9909090B)
                            )
                        )
                    )
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(86.dp)
                        .aspectRatio(2f / 3f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(CinepvqSurfaceVariant)
                        .border(1.5.dp, CinepvqAmber.copy(alpha = 0.7f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (poster.isNotBlank()) {
                        AsyncImage(
                            model = ImageRequest.Builder(context).data(poster).crossfade(true).build(),
                            contentDescription = item.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.EmojiEvents,
                            contentDescription = null,
                            tint = CinepvqAmber,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFF97316))))
                                .padding(horizontal = 7.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "TOP #${item.rank} ${item.platformName.uppercase()}",
                                color = Color.Black,
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Black,
                                maxLines = 1
                            )
                        }
                        if (item.score > 0.0) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color.White.copy(alpha = 0.14f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "★ ${String.format(Locale.US, "%.1f", item.score)}",
                                    color = Color(0xFFFCD34D),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Text(
                        text = item.name,
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (item.heatLabel.isNotBlank()) {
                        Text(
                            text = item.heatLabel,
                            color = Color(0xFFD4D4D8),
                            fontSize = 11.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Box(
                        modifier = Modifier
                            .padding(top = 2.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Brush.horizontalGradient(listOf(Color(0xFFF59E0B), Color(0xFFEA580C))))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Icon(
                                imageVector = if (item.playable) Icons.Default.PlayArrow else Icons.Default.Search,
                                contentDescription = null,
                                tint = Color.Black,
                                modifier = Modifier.size(15.dp)
                            )
                            Text(
                                text = if (item.playable) "Xem Phim Ngay" else "Tìm Trên Cinepvq",
                                color = Color.Black,
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlatformSectionCard(
    section: TrendingPlatformSection,
    expanded: Boolean,
    netflixCountries: List<NetflixCountryOption>,
    selectedNetflixCountry: String,
    selectedNetflixType: String,
    onSelectNetflixCountry: (String) -> Unit,
    onSelectNetflixType: (String) -> Unit,
    doubanCategories: List<DoubanCategoryOption>,
    selectedDoubanCategory: String,
    onSelectDoubanCategory: (String) -> Unit,
    onExpandPlatform: (String) -> Unit,
    onItemClick: (TrendingRankItem) -> Unit
) {
    val grad = platformGradient(section.id)
    val top3 = section.items.take(3)
    val rest = if (expanded) section.items.drop(3).take(9) else section.items.drop(3).take(6)

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = CinepvqSurface,
        border = BorderStroke(1.dp, CinepvqBorderSubtle),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Branded Header
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.horizontalGradient(grad))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(5.dp))
                                .background(Color.Black.copy(alpha = 0.28f))
                                .padding(horizontal = 7.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = section.badgeText.ifBlank { section.id.uppercase() },
                                color = Color.White,
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = section.name,
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = section.subtitle,
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 11.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    if (!expanded) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            modifier = Modifier.clickable { onExpandPlatform(section.id) }
                        ) {
                            Text(
                                text = "Xem hết",
                                color = Color(0xFF18181B),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                // Netflix Country Selector + TV / Films Toggle
                if (section.id == "netflix") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Quốc gia:",
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.Black.copy(alpha = 0.28f))
                                .padding(2.dp),
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            listOf("tv" to "Phim Bộ", "films" to "Phim Lẻ").forEach { (key, label) ->
                                val sel = selectedNetflixType == key
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (sel) Color.White else Color.Transparent)
                                        .clickable { onSelectNetflixType(key) }
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(
                                        text = label,
                                        color = if (sel) Color(0xFF991B1B) else Color.White,
                                        fontSize = 10.5.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(netflixCountries, key = { it.code }) { country ->
                            val sel = country.code == selectedNetflixCountry
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (sel) Color.White else Color.Black.copy(alpha = 0.28f))
                                    .border(
                                        1.dp,
                                        if (sel) Color.White else Color.White.copy(alpha = 0.2f),
                                        RoundedCornerShape(10.dp)
                                    )
                                    .clickable { onSelectNetflixCountry(country.code) }
                                    .padding(horizontal = 9.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = "${country.flag} ${country.label}",
                                    color = if (sel) Color(0xFFB91C1C) else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = if (sel) FontWeight.ExtraBold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // Douban Category Sub-Filter
                if (section.id == "douban") {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(doubanCategories, key = { it.key }) { cat ->
                            val sel = cat.key == selectedDoubanCategory
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (sel) Color.White else Color.Black.copy(alpha = 0.28f))
                                    .border(
                                        1.dp,
                                        if (sel) Color.White else Color.White.copy(alpha = 0.2f),
                                        RoundedCornerShape(10.dp)
                                    )
                                    .clickable { onSelectDoubanCategory(cat.key) }
                                    .padding(horizontal = 9.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = "★ ${cat.label}",
                                    color = if (sel) Color(0xFF065F46) else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = if (sel) FontWeight.ExtraBold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }

            // Section Body: Top 3 Podium Rows + #4..#12 3-Col Grid
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                top3.forEach { item ->
                    TrendingPodiumRowCard(item = item, onClick = { onItemClick(item) })
                }

                if (rest.isNotEmpty()) {
                    HorizontalDivider(color = CinepvqBorderSubtle, modifier = Modifier.padding(vertical = 2.dp))
                    Text(
                        text = "Hạng #4 – #${3 + rest.size}",
                        color = CinepvqTextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )

                    rest.chunked(3).forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            rowItems.forEach { item ->
                                TrendingGridRankCard(
                                    item = item,
                                    onClick = { onItemClick(item) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            repeat(3 - rowItems.size) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TrendingPodiumRowCard(
    item: TrendingRankItem,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    val medalColors = when (item.rank) {
        1 -> listOf(Color(0xFFFBBF24), Color(0xFFF59E0B))
        2 -> listOf(Color(0xFFE2E8F0), Color(0xFF94A3B8))
        else -> listOf(Color(0xFFD97706), Color(0xFF92400E))
    }
    val medalTextColor = if (item.rank <= 2) Color.Black else Color.White
    val poster = item.thumbUrl.ifBlank { item.posterUrl }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = CinepvqSurfaceVariant.copy(alpha = 0.65f),
        border = BorderStroke(
            1.dp,
            if (item.rank == 1) CinepvqAmber.copy(alpha = 0.45f) else CinepvqBorderSubtle
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(62.dp)
                    .aspectRatio(2f / 3f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(CinepvqBackground),
                contentAlignment = Alignment.Center
            ) {
                if (poster.isNotBlank()) {
                    AsyncImage(
                        model = ImageRequest.Builder(context).data(poster).crossfade(true).build(),
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.BarChart,
                        contentDescription = null,
                        tint = CinepvqTextMuted,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(3.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Brush.horizontalGradient(medalColors))
                        .padding(horizontal = 5.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = "#${item.rank}",
                        color = medalTextColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = item.name,
                    color = CinepvqTextPrimary,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (item.score > 0.0) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(CinepvqAmber.copy(alpha = 0.16f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "★ ${String.format(Locale.US, "%.1f", item.score)} ${item.scoreSource}",
                                color = CinepvqAmber,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                        }
                    }

                    if (item.formattedViews.isNotBlank()) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xFF10B981).copy(alpha = 0.14f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = item.formattedViews.replace(" lượt xem", ""),
                                color = Color(0xFF34D399),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.heatLabel.ifBlank { item.originalName ?: "" },
                        color = CinepvqTextMuted,
                        fontSize = 10.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    if (!item.playable) {
                        Text(
                            text = "Tìm phim ›",
                            color = CinepvqPrimaryLight,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    } else if (item.trendDelta > 0) {
                        Text(
                            text = "▲ +${item.trendDelta}",
                            color = Color(0xFF34D399),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    } else if (item.trendDelta < 0) {
                        Text(
                            text = "▼ ${item.trendDelta}",
                            color = CinepvqRed,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TrendingGridRankCard(
    item: TrendingRankItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val poster = item.thumbUrl.ifBlank { item.posterUrl }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(CinepvqSurfaceVariant.copy(alpha = 0.5f))
            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .background(CinepvqBackground),
            contentAlignment = Alignment.Center
        ) {
            if (poster.isNotBlank()) {
                AsyncImage(
                    model = ImageRequest.Builder(context).data(poster).crossfade(true).build(),
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.BarChart,
                        contentDescription = null,
                        tint = CinepvqTextMuted,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.name,
                        color = CinepvqTextMuted,
                        fontSize = 9.5.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(4.dp)
                    .size(22.dp)
                    .background(Color.Black.copy(alpha = 0.85f), RoundedCornerShape(6.dp))
                    .border(1.dp, CinepvqAmber.copy(alpha = 0.45f), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = item.rank.toString(),
                    color = CinepvqAmber,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black
                )
            }

            if (!item.playable) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(4.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(CinepvqPrimary.copy(alpha = 0.9f))
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = "Tìm",
                        color = Color.White,
                        fontSize = 8.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 6.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = item.name,
                color = CinepvqTextPrimary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (item.score > 0.0) {
                    Text(
                        text = "★ ${String.format(Locale.US, "%.1f", item.score)}",
                        color = CinepvqAmber,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = item.formattedViews.replace(" lượt xem", "").replace(" thị phần", "%"),
                    color = CinepvqTextMuted,
                    fontSize = 9.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
