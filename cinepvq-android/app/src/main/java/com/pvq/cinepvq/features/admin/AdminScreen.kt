package com.pvq.cinepvq.features.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pvq.cinepvq.core.network.model.*
import com.pvq.cinepvq.ui.theme.*
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
    onNavigateBack: () -> Unit,
    viewModel: AdminViewModel = viewModel()
) {
    val user by viewModel.currentUser.collectAsStateWithLifecycle()
    val isSoleAdmin = AdminViewModel.isAdminEmail(user?.email)

    val activeTab by viewModel.activeTab.collectAsStateWithLifecycle()
    val toastMessage by viewModel.toastMessage.collectAsStateWithLifecycle()
    val isBusy by viewModel.isBusy.collectAsStateWithLifecycle()

    val stats by viewModel.stats.collectAsStateWithLifecycle()
    val isLoadingStats by viewModel.isLoadingStats.collectAsStateWithLifecycle()

    val movies by viewModel.movies.collectAsStateWithLifecycle()
    val movieSearch by viewModel.movieSearch.collectAsStateWithLifecycle()
    val moviePage by viewModel.moviePage.collectAsStateWithLifecycle()
    val movieTotalPages by viewModel.movieTotalPages.collectAsStateWithLifecycle()
    val isLoadingMovies by viewModel.isLoadingMovies.collectAsStateWithLifecycle()

    val crawlerCaches by viewModel.crawlerCaches.collectAsStateWithLifecycle()
    val isLoadingCrawler by viewModel.isLoadingCrawler.collectAsStateWithLifecycle()

    val users by viewModel.users.collectAsStateWithLifecycle()
    val userSearch by viewModel.userSearch.collectAsStateWithLifecycle()
    val isLoadingUsers by viewModel.isLoadingUsers.collectAsStateWithLifecycle()

    val comments by viewModel.comments.collectAsStateWithLifecycle()
    val isLoadingComments by viewModel.isLoadingComments.collectAsStateWithLifecycle()

    LaunchedEffect(toastMessage) {
        if (toastMessage != null) {
            delay(4000)
            viewModel.clearToast()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AdminPanelSettings,
                            contentDescription = null,
                            tint = Color(0xFFF59E0B),
                            modifier = Modifier.size(22.dp)
                        )
                        Column {
                            Text(
                                text = "Quản trị hệ thống",
                                color = CinepvqTextPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Cinepvq Admin Portal",
                                color = CinepvqTextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Quay lại",
                            tint = CinepvqTextPrimary
                        )
                    }
                },
                actions = {
                    if (isSoleAdmin) {
                        IconButton(onClick = { viewModel.selectTab(activeTab) }) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Làm mới",
                                tint = CinepvqPrimaryLight
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CinepvqBackground)
            )
        },
        containerColor = CinepvqBackground
    ) { paddingValues ->
        if (!isSoleAdmin) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    border = BorderStroke(1.dp, CinepvqRed.copy(alpha = 0.4f))
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.GppBad,
                            contentDescription = null,
                            tint = CinepvqRed,
                            modifier = Modifier.size(44.dp)
                        )
                        Text(
                            text = "Không có quyền truy cập",
                            color = CinepvqTextPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Khu vực này chỉ dành riêng cho tài khoản Quản trị viên Cinepvq.",
                            color = CinepvqTextSecondary,
                            fontSize = 13.sp
                        )
                    }
                }
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Toast Banner
            if (toastMessage != null) {
                Surface(
                    color = CinepvqPrimary.copy(alpha = 0.2f),
                    border = BorderStroke(1.dp, CinepvqPrimary.copy(alpha = 0.5f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = toastMessage ?: "",
                            color = CinepvqTextPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { viewModel.clearToast() }, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Đóng", tint = CinepvqTextMuted, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }

            // Tab Strip
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(AdminTab.entries.toTypedArray(), key = { it.name }) { tab ->
                    val selected = tab == activeTab
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (selected) Brush.horizontalGradient(listOf(CinepvqPrimary, Color(0xFF6366F1)))
                                else Brush.linearGradient(listOf(CinepvqSurface, CinepvqSurface))
                            )
                            .clickable { viewModel.selectTab(tab) }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = tab.label,
                            color = if (selected) Color.White else CinepvqTextSecondary,
                            fontSize = 12.5.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }

            if (isBusy) {
                LinearProgressIndicator(
                    color = CinepvqPrimary,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            when (activeTab) {
                AdminTab.OVERVIEW -> AdminOverviewTab(
                    stats = stats,
                    isLoading = isLoadingStats,
                    onRefresh = { viewModel.loadStats() }
                )
                AdminTab.MOVIES -> AdminMoviesTab(
                    movies = movies,
                    searchQuery = movieSearch,
                    page = moviePage,
                    totalPages = movieTotalPages,
                    isLoading = isLoadingMovies,
                    isBusy = isBusy,
                    onSearchChange = { viewModel.updateMovieSearch(it) },
                    onSearchSubmit = { viewModel.loadMovies(page = 1) },
                    onEnrichSlug = { viewModel.enrichMovie(it) },
                    onFixEpisodes = { viewModel.fixAllEpisodes() },
                    onToggleFeatured = { viewModel.toggleMovieFeatured(it) },
                    onToggleHidden = { viewModel.toggleMovieHidden(it) },
                    onDeleteMovie = { viewModel.deleteMovie(it) },
                    onPageChange = { viewModel.loadMovies(page = it) }
                )
                AdminTab.CRAWLER -> AdminCrawlerTab(
                    caches = crawlerCaches,
                    isLoading = isLoadingCrawler,
                    isBusy = isBusy,
                    onCrawlRankings = { viewModel.runCrawlerAction("crawl_rankings") },
                    onSyncLatest = { viewModel.runCrawlerAction("sync_latest_movies") }
                )
                AdminTab.USERS -> AdminUsersTab(
                    users = users,
                    searchQuery = userSearch,
                    isLoading = isLoadingUsers,
                    onSearchChange = { viewModel.updateUserSearch(it) },
                    onSearchSubmit = { viewModel.loadUsers() },
                    onToggleBan = { viewModel.toggleUserBan(it) }
                )
                AdminTab.ENGAGEMENT -> AdminEngagementTab(
                    comments = comments,
                    isLoading = isLoadingComments,
                    isBusy = isBusy,
                    onDeleteComment = { viewModel.deleteComment(it) },
                    onSendBroadcast = { t, m, s -> viewModel.sendBroadcastNotification(t, m, s) }
                )
            }
        }
    }
}

@Composable
private fun AdminOverviewTab(
    stats: AdminStatsResponseDto?,
    isLoading: Boolean,
    onRefresh: () -> Unit
) {
    if (isLoading && stats == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = CinepvqPrimary)
        }
        return
    }
    val c = stats?.counts ?: AdminCountsDto()
    val metrics = listOf(
        "Người dùng" to c.users,
        "Phim trong DB" to c.movies,
        "Tổng số tập" to c.episodes,
        "Lịch sử xem" to c.watchHistory,
        "Yêu thích" to c.favorites,
        "Xem sau" to c.watchlist,
        "Bình luận" to c.comments,
        "BXH đã cache" to c.cachedPlatforms
    )

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Text("Thống kê hệ thống", color = CinepvqTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
        items(metrics.chunked(2)) { pair ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                pair.forEach { (label, count) ->
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                        border = BorderStroke(1.dp, CinepvqBorderSubtle)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(text = count.toString(), color = CinepvqPrimaryLight, fontSize = 22.sp, fontWeight = FontWeight.Black)
                            Text(text = label, color = CinepvqTextSecondary, fontSize = 12.sp)
                        }
                    }
                }
                if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
            }
        }

        if (!stats?.health.isNullOrEmpty()) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                Text("Sức khỏe dịch vụ", color = CinepvqTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
            items(stats!!.health) { h ->
                val dotColor = when (h.status) {
                    "online" -> CinepvqGreen
                    "degraded" -> CinepvqAmber
                    else -> CinepvqRed
                }
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    border = BorderStroke(1.dp, CinepvqBorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(h.name, color = CinepvqTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("${h.detail} • ${h.latencyMs}ms", color = CinepvqTextMuted, fontSize = 11.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(dotColor.copy(alpha = 0.2f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(h.status.uppercase(), color = dotColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        if (!stats?.recentActivity.isNullOrEmpty()) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                Text("Hoạt động xem gần đây", color = CinepvqTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
            items(stats!!.recentActivity) { act ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = act.movieName ?: act.movieSlug,
                            color = CinepvqTextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${act.username ?: act.email} • ${act.episodeName ?: act.episodeSlug}",
                            color = CinepvqTextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminMoviesTab(
    movies: List<AdminMovieRowDto>,
    searchQuery: String,
    page: Int,
    totalPages: Int,
    isLoading: Boolean,
    isBusy: Boolean,
    onSearchChange: (String) -> Unit,
    onSearchSubmit: () -> Unit,
    onEnrichSlug: (String) -> Unit,
    onFixEpisodes: () -> Unit,
    onToggleFeatured: (AdminMovieRowDto) -> Unit,
    onToggleHidden: (AdminMovieRowDto) -> Unit,
    onDeleteMovie: (String) -> Unit,
    onPageChange: (Int) -> Unit
) {
    var slugInput by remember { mutableStateOf("") }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // Quick Enrich & Fix Episodes Card
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                border = BorderStroke(1.dp, CinepvqBorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Cào & làm giàu phim theo Slug", color = CinepvqTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = slugInput,
                            onValueChange = { slugInput = it },
                            placeholder = { Text("vd: khanh-du-nien-phan-2", fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Button(
                            onClick = {
                                if (slugInput.isNotBlank()) {
                                    onEnrichSlug(slugInput)
                                    slugInput = ""
                                }
                            },
                            enabled = !isBusy && slugInput.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary)
                        ) {
                            Text("Cào", fontSize = 12.sp)
                        }
                    }
                    OutlinedButton(
                        onClick = onFixEpisodes,
                        enabled = !isBusy,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Build, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Chuẩn hóa toàn bộ tên tập trong DB", fontSize = 12.sp)
                    }
                }
            }
        }

        // Search Movies in DB
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    placeholder = { Text("Tìm phim trong DB...", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = onSearchSubmit,
                    colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary)
                ) {
                    Icon(Icons.Default.Search, contentDescription = "Tìm", modifier = Modifier.size(18.dp))
                }
            }
        }

        if (isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CinepvqPrimary)
                }
            }
        } else {
            items(movies, key = { it.slug }) { movie ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    border = BorderStroke(1.dp, if (movie.isHidden) CinepvqRed.copy(alpha = 0.4f) else CinepvqBorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(movie.name, color = CinepvqTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            text = "${movie.slug} • ${movie.episodeCount} tập • ${movie.internalViews} lượt xem",
                            color = CinepvqTextMuted,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AssistChip(
                                onClick = { onToggleFeatured(movie) },
                                label = { Text(if (movie.isFeatured) "★ Nổi bật" else "Nổi bật", fontSize = 11.sp) }
                            )
                            AssistChip(
                                onClick = { onToggleHidden(movie) },
                                label = { Text(if (movie.isHidden) "Đang ẩn" else "Đang hiện", fontSize = 11.sp) }
                            )
                            AssistChip(
                                onClick = { onDeleteMovie(movie.slug) },
                                label = { Text("Xóa", color = CinepvqRed, fontSize = 11.sp) }
                            )
                        }
                    }
                }
            }

            if (totalPages > 1) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(onClick = { onPageChange(page - 1) }, enabled = page > 1) {
                            Text("Trang trước", fontSize = 12.sp)
                        }
                        Text("Trang $page / $totalPages", color = CinepvqTextSecondary, fontSize = 12.sp)
                        OutlinedButton(onClick = { onPageChange(page + 1) }, enabled = page < totalPages) {
                            Text("Trang sau", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminCrawlerTab(
    caches: List<AdminCrawlerCacheDto>,
    isLoading: Boolean,
    isBusy: Boolean,
    onCrawlRankings: () -> Unit,
    onSyncLatest: () -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Button(
                onClick = onCrawlRankings,
                enabled = !isBusy,
                colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Cào mới 7 BXH Thịnh Hành ngay", fontWeight = FontWeight.Bold)
            }
        }
        item {
            OutlinedButton(
                onClick = onSyncLatest,
                enabled = !isBusy,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Đồng bộ & làm giàu 6 phim mới nhất")
            }
        }
        item {
            Text("Bộ nhớ đệm BXH (${caches.size})", color = CinepvqTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        if (isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CinepvqPrimary)
                }
            }
        } else {
            items(caches, key = { it.platformId }) { c ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(c.platformName.ifBlank { c.platformId }, color = CinepvqTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("${c.itemCount} mục • ${c.updatedAt.take(19)}", color = CinepvqTextMuted, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminUsersTab(
    users: List<AdminUserRowDto>,
    searchQuery: String,
    isLoading: Boolean,
    onSearchChange: (String) -> Unit,
    onSearchSubmit: () -> Unit,
    onToggleBan: (AdminUserRowDto) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    placeholder = { Text("Tìm email / tên người dùng...", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Button(onClick = onSearchSubmit, colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary)) {
                    Icon(Icons.Default.Search, contentDescription = "Tìm", modifier = Modifier.size(18.dp))
                }
            }
        }

        if (isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CinepvqPrimary)
                }
            }
        } else {
            items(users, key = { it.id }) { u ->
                val isAdmin = u.role == "admin"
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    border = BorderStroke(1.dp, if (isAdmin) CinepvqAmber.copy(alpha = 0.5f) else CinepvqBorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = (u.username?.ifBlank { null } ?: u.email) + if (isAdmin) " (ADMIN)" else "",
                                color = if (isAdmin) CinepvqAmber else CinepvqTextPrimary,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(u.email, color = CinepvqTextSecondary, fontSize = 11.5.sp)
                            Text(
                                text = "Lịch sử: ${u.historyCount} • Thích: ${u.favoritesCount} • Bình luận: ${u.commentsCount}",
                                color = CinepvqTextMuted,
                                fontSize = 11.sp
                            )
                        }
                        if (!isAdmin) {
                            OutlinedButton(
                                onClick = { onToggleBan(u) },
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (u.status == "active") "Khóa" else "Mở khóa",
                                    color = if (u.status == "active") CinepvqRed else CinepvqGreen,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminEngagementTab(
    comments: List<AdminCommentRowDto>,
    isLoading: Boolean,
    isBusy: Boolean,
    onDeleteComment: (String) -> Unit,
    onSendBroadcast: (String, String, String?) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var movieSlug by remember { mutableStateOf("") }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                border = BorderStroke(1.dp, CinepvqBorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Phát thông báo toàn hệ thống", color = CinepvqTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Tiêu đề thông báo", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it },
                        label = { Text("Nội dung", fontSize = 12.sp) },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = movieSlug,
                        onValueChange = { movieSlug = it },
                        label = { Text("Slug phim đính kèm (tùy chọn)", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = {
                            onSendBroadcast(title, message, movieSlug)
                            title = ""
                            message = ""
                            movieSlug = ""
                        },
                        enabled = !isBusy && title.isNotBlank() && message.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Gửi thông báo tới toàn bộ người dùng", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Text("Quản lý bình luận gần đây (${comments.size})", color = CinepvqTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }

        if (isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = CinepvqPrimary)
                }
            }
        } else {
            items(comments, key = { it.id }) { c ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CinepvqSurface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(
                                text = "${c.username ?: c.email} • ${c.movieName ?: c.movieSlug}",
                                color = CinepvqPrimaryLight,
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(c.content, color = CinepvqTextPrimary, fontSize = 13.sp)
                        }
                        IconButton(onClick = { onDeleteComment(c.id) }) {
                            Icon(Icons.Default.Delete, contentDescription = "Xóa bình luận", tint = CinepvqRed, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}
