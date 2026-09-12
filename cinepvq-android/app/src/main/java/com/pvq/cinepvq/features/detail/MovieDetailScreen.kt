package com.pvq.cinepvq.features.detail

import android.content.Intent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.pvq.cinepvq.core.designsystem.components.ErrorView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.core.network.model.Comment
import com.pvq.cinepvq.ui.theme.*

@Composable
fun MovieDetailScreen(
    slug: String,
    onBackClick: () -> Unit,
    onPlayClick: (String, String) -> Unit,
    onNavigateToMovie: (String) -> Unit,
    viewModel: DetailViewModel = viewModel()
) {
    val context = LocalContext.current

    LaunchedEffect(slug) {
        viewModel.loadMovie(slug)
    }

    val movie by viewModel.movieDetail.collectAsStateWithLifecycle()
    val isFavorite by viewModel.isFavorite.collectAsStateWithLifecycle()
    val resumeHistory by viewModel.resumeHistory.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val comments by viewModel.comments.collectAsStateWithLifecycle()
    val isPostingComment by viewModel.isPostingComment.collectAsStateWithLifecycle()
    val similarMovies by viewModel.similarMovies.collectAsStateWithLifecycle()

    var commentText by remember { mutableStateOf("") }
    var isDescriptionExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
    ) {
        Box(modifier = Modifier.weight(1f)) {
            when {
                isLoading && movie == null -> LoadingView()
                errorMessage != null && movie == null -> ErrorView(
                    message = errorMessage ?: "Không thể tải thông tin phim",
                    onRetry = { viewModel.loadMovie(slug) }
                )
                movie != null -> {
                    val detail = movie!!
                    
                    val hasResume = resumeHistory != null &&
                            (resumeHistory?.currentTime ?: 0L) > 10L &&
                            (resumeHistory?.duration == 0L || (resumeHistory?.currentTime ?: 0L) < (resumeHistory?.duration ?: 0L) * 0.95)

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 40.dp)
                    ) {
                        // ── 1. Hero Backdrop Section ──
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(320.dp)
                            ) {
                                // Backdrop Image
                                AsyncImage(
                                    model = ImageRequest.Builder(LocalContext.current)
                                        .data(detail.posterUrl.ifBlank { detail.thumbUrl })
                                        .crossfade(true)
                                        .build(),
                                    contentDescription = detail.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )

                                // Multi-layer dark cinematic gradient
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.verticalGradient(
                                                listOf(
                                                    Color.Black.copy(alpha = 0.65f),
                                                    Color.Transparent,
                                                    CinepvqBackground.copy(alpha = 0.75f),
                                                    CinepvqBackground
                                                )
                                            )
                                        )
                                )

                                // Top Header Bar
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // Back Button
                                    IconButton(
                                        onClick = onBackClick,
                                        modifier = Modifier
                                            .size(38.dp)
                                            .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                                            .border(1.dp, CinepvqBorderSubtle, CircleShape)
                                    ) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                            contentDescription = "Quay lại",
                                            tint = Color.White,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }

                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        // Share button
                                        IconButton(
                                            onClick = {
                                                val sendIntent = Intent().apply {
                                                    action = Intent.ACTION_SEND
                                                    putExtra(Intent.EXTRA_TEXT, "Xem phim ${detail.name} trên Cinepvq")
                                                    type = "text/plain"
                                                }
                                                context.startActivity(Intent.createChooser(sendIntent, "Chia sẻ phim"))
                                            },
                                            modifier = Modifier
                                                .size(38.dp)
                                                .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                                                .border(1.dp, CinepvqBorderSubtle, CircleShape)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Share,
                                                contentDescription = "Chia sẻ",
                                                tint = Color.White,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }

                                        // Favorite button
                                        IconButton(
                                            onClick = { viewModel.toggleFavorite() },
                                            modifier = Modifier
                                                .size(38.dp)
                                                .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                                                .border(1.dp, CinepvqBorderSubtle, CircleShape)
                                        ) {
                                            Icon(
                                                imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                                contentDescription = "Yêu thích",
                                                tint = if (isFavorite) CinepvqRed else Color.White,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // ── 2. Poster + Title + Metadata Row ──
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp)
                            ) {
                                // Add negative spacer to pull content up
                                Spacer(modifier = Modifier.height((-50).dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                                    verticalAlignment = Alignment.Bottom
                                ) {
                                    // 2:3 Floating Poster Card
                                    Box(
                                        modifier = Modifier
                                            .width(115.dp)
                                            .aspectRatio(2f / 3f)
                                            .clip(RoundedCornerShape(12.dp))
                                            .border(1.5.dp, CinepvqBorderSubtle, RoundedCornerShape(12.dp))
                                            .background(CinepvqSurface)
                                    ) {
                                        AsyncImage(
                                            model = ImageRequest.Builder(LocalContext.current)
                                                .data(detail.thumbUrl.ifBlank { detail.posterUrl })
                                                .crossfade(true)
                                                .build(),
                                            contentDescription = detail.name,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize()
                                        )

                                        if (detail.quality.isNotBlank()) {
                                            Box(
                                                modifier = Modifier
                                                    .align(Alignment.TopStart)
                                                    .padding(6.dp)
                                                    .background(CinepvqPrimary, RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 5.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = detail.quality,
                                                    color = Color.White,
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }

                                    // Title and Basic Info
                                    Column(
                                        modifier = Modifier.weight(1f).padding(bottom = 8.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            text = detail.name,
                                            color = CinepvqTextPrimary,
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 3,
                                            overflow = TextOverflow.Ellipsis
                                        )

                                        if (!detail.originalName.isNullOrBlank()) {
                                            Text(
                                                text = detail.originalName,
                                                color = CinepvqTextSecondary,
                                                fontSize = 13.sp,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }

                                        // Quick tags (Year, Language, Time)
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            if (detail.year.isNotBlank()) {
                                                BadgeChip(text = detail.year)
                                            }
                                            if (detail.lang.isNotBlank()) {
                                                BadgeChip(text = detail.lang)
                                            }
                                        }
                                        if (detail.time.isNotBlank()) {
                                            Text(
                                                text = detail.time,
                                                color = CinepvqTextMuted,
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(18.dp))

                                // ── Primary Action Buttons (Xem Ngay / Tiếp Tục Xem) ──
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    val firstEp = detail.episodes.firstOrNull()?.items?.firstOrNull()
                                    val resumeEpStr = if (hasResume) resumeHistory?.episodeSlug else null
                                    
                                    val firstEpSlug = firstEp?.slug ?: "tap-1"
                                    val playSlug = resumeEpStr ?: firstEpSlug

                                    if (hasResume) {
                                        // Resume Button
                                        Button(
                                            onClick = { onPlayClick(slug, playSlug) },
                                            colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.weight(1.3f),
                                            contentPadding = PaddingValues(vertical = 12.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.PlayArrow,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = "Tiếp tục xem",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp,
                                                color = Color.White
                                            )
                                        }

                                        // Restart from Episode 1
                                        OutlinedButton(
                                            onClick = { onPlayClick(slug, firstEpSlug) },
                                            shape = RoundedCornerShape(12.dp),
                                            border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                                brush = Brush.horizontalGradient(listOf(CinepvqBorderSubtle, CinepvqBorderSubtle))
                                            ),
                                            colors = ButtonDefaults.outlinedButtonColors(containerColor = CinepvqSurface),
                                            modifier = Modifier.weight(1f),
                                            contentPadding = PaddingValues(vertical = 12.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Refresh,
                                                contentDescription = null,
                                                tint = CinepvqTextSecondary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "Xem từ đầu",
                                                color = CinepvqTextSecondary,
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 12.sp
                                            )
                                        }
                                    } else {
                                        // Watch Now Button
                                        Button(
                                            onClick = { onPlayClick(slug, firstEpSlug) },
                                            colors = ButtonDefaults.buttonColors(containerColor = CinepvqPrimary),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.weight(1f),
                                            contentPadding = PaddingValues(vertical = 12.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.PlayArrow,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = "Xem Ngay",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp,
                                                color = Color.White
                                            )
                                        }
                                    }

                                    // Favorite Toggle Button
                                    OutlinedButton(
                                        onClick = { viewModel.toggleFavorite() },
                                        shape = RoundedCornerShape(12.dp),
                                        border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                            brush = Brush.horizontalGradient(
                                                listOf(
                                                    if (isFavorite) CinepvqRed else CinepvqBorderSubtle,
                                                    if (isFavorite) CinepvqRed else CinepvqBorderSubtle
                                                )
                                            )
                                        ),
                                        colors = ButtonDefaults.outlinedButtonColors(
                                            containerColor = if (isFavorite) CinepvqRed.copy(alpha = 0.12f) else CinepvqSurface
                                        ),
                                        contentPadding = PaddingValues(vertical = 12.dp, horizontal = 14.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                            contentDescription = null,
                                            tint = if (isFavorite) CinepvqRed else CinepvqTextPrimary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }
                        }

                        // ── 3. Synopsis / Description Card ──
                        if (detail.description.isNotBlank()) {
                            item {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp)
                                        .background(CinepvqSurface, RoundedCornerShape(14.dp))
                                        .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(14.dp))
                                        .padding(16.dp)
                                        .animateContentSize()
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Movie,
                                            contentDescription = null,
                                            tint = CinepvqPrimary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = "Nội Dung Phim",
                                            color = CinepvqTextPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    // Remove simple HTML tags if present in description
                                    val cleanDesc = detail.description
                                        .replace("<p>", "")
                                        .replace("</p>", "\n")
                                        .replace("<br>", "\n")
                                        .replace("<br/>", "\n")
                                        .trim()

                                    Text(
                                        text = cleanDesc,
                                        color = CinepvqTextSecondary,
                                        fontSize = 13.sp,
                                        lineHeight = 20.sp,
                                        maxLines = if (isDescriptionExpanded) Int.MAX_VALUE else 4,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    
                                    if (cleanDesc.length > 200) {
                                        Text(
                                            text = if (isDescriptionExpanded) "Thu gọn" else "Xem thêm",
                                            color = CinepvqPrimary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier
                                                .padding(top = 8.dp)
                                                .clickable { isDescriptionExpanded = !isDescriptionExpanded }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        // ── 4. Technical Details Card ──
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp)
                                    .background(CinepvqSurface, RoundedCornerShape(14.dp))
                                    .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(14.dp))
                                    .padding(16.dp)
                            ) {
                                Text(
                                    text = "Thông Tin Chi Tiết",
                                    color = CinepvqTextPrimary,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(bottom = 12.dp)
                                )

                                if (detail.director.isNotBlank()) {
                                    DetailInfoRow(label = "Đạo diễn:", value = detail.director)
                                }
                                if (detail.actor.isNotBlank()) {
                                    DetailInfoRow(label = "Diễn viên:", value = detail.actor)
                                }
                                if (detail.countries.isNotEmpty()) {
                                    DetailInfoRow(label = "Quốc gia:", value = detail.countries.joinToString(", "))
                                }
                                if (detail.categories.isNotEmpty()) {
                                    DetailInfoRow(label = "Thể loại:", value = detail.categories.joinToString(", "))
                                }
                                if (detail.year.isNotBlank()) {
                                    DetailInfoRow(label = "Năm phát hành:", value = detail.year)
                                }
                                if (detail.time.isNotBlank()) {
                                    DetailInfoRow(label = "Thời lượng:", value = detail.time)
                                }
                                if (detail.episodeCurrent.isNotBlank()) {
                                    DetailInfoRow(label = "Tình trạng:", value = detail.episodeCurrent, isHighlight = true)
                                }
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                        }

                        // ── 5. Similar Movies ──
                        if (similarMovies.isNotEmpty()) {
                            item {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = null,
                                            tint = CinepvqPrimary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = "Phim Đề Xuất",
                                            color = CinepvqTextPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    
                                    Spacer(modifier = Modifier.height(12.dp))
                                    
                                    LazyRow(
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        contentPadding = PaddingValues(horizontal = 0.dp)
                                    ) {
                                        items(similarMovies) { sim ->
                                            Column(
                                                modifier = Modifier
                                                    .width(100.dp)
                                                    .clickable { 
                                                        onNavigateToMovie(sim.slug)
                                                    }
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .aspectRatio(2f/3f)
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(CinepvqSurfaceVariant)
                                                ) {
                                                    AsyncImage(
                                                        model = ImageRequest.Builder(LocalContext.current)
                                                            .data(sim.thumbUrl.ifBlank { sim.posterUrl })
                                                            .crossfade(true)
                                                            .build(),
                                                        contentDescription = sim.name,
                                                        contentScale = ContentScale.Crop,
                                                        modifier = Modifier.fillMaxSize()
                                                    )
                                                    if (sim.quality.isNotBlank()) {
                                                        Box(
                                                            modifier = Modifier
                                                                .align(Alignment.TopStart)
                                                                .padding(4.dp)
                                                                .background(CinepvqPrimary, RoundedCornerShape(4.dp))
                                                                .padding(horizontal = 4.dp, vertical = 2.dp)
                                                        ) {
                                                            Text(
                                                                text = sim.quality,
                                                                color = Color.White,
                                                                fontSize = 8.sp,
                                                                fontWeight = FontWeight.Bold
                                                            )
                                                        }
                                                    }
                                                }
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text(
                                                    text = sim.name,
                                                    color = CinepvqTextPrimary,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    maxLines = 2,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        // ── 6. Comments Section ──
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp)
                            ) {
                                Text(
                                    text = "Bình Luận (${comments.size})",
                                    color = CinepvqTextPrimary,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(bottom = 12.dp)
                                )
                                
                                // Comment Input
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    androidx.compose.material3.OutlinedTextField(
                                        value = commentText,
                                        onValueChange = { commentText = it },
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(50.dp),
                                        placeholder = { Text("Viết bình luận...", fontSize = 13.sp) },
                                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                                            focusedContainerColor = CinepvqSurface,
                                            unfocusedContainerColor = CinepvqSurface,
                                            focusedBorderColor = CinepvqPrimary,
                                            unfocusedBorderColor = CinepvqBorderSubtle,
                                            focusedTextColor = CinepvqTextPrimary,
                                            unfocusedTextColor = CinepvqTextPrimary,
                                        ),
                                        shape = RoundedCornerShape(12.dp),
                                        singleLine = true
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    androidx.compose.material3.Button(
                                        onClick = { 
                                            viewModel.postComment(slug, commentText)
                                            commentText = ""
                                        },
                                        enabled = commentText.isNotBlank() && !isPostingComment,
                                        shape = RoundedCornerShape(12.dp),
                                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                            containerColor = CinepvqPrimary,
                                            disabledContainerColor = CinepvqBorderSubtle
                                        ),
                                        modifier = Modifier.height(50.dp)
                                    ) {
                                        Text("Gửi", fontWeight = FontWeight.Bold)
                                    }
                                }
                                
                                Spacer(modifier = Modifier.height(20.dp))
                                
                                // Comments List
                                if (comments.isEmpty()) {
                                    Text(
                                        text = "Chưa có bình luận nào. Hãy là người đầu tiên!",
                                        color = CinepvqTextMuted,
                                        fontSize = 13.sp,
                                        modifier = Modifier.padding(vertical = 12.dp)
                                    )
                                } else {
                                    comments.forEach { comment ->
                                        CommentItem(comment)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommentItem(comment: Comment) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top
    ) {
        // Avatar
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(CinepvqSurfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            if (!comment.avatar.isNullOrBlank()) {
                AsyncImage(
                    model = comment.avatar,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Text(
                    text = comment.author.take(1).uppercase(),
                    color = CinepvqTextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = comment.author.ifBlank { "User" },
                    color = CinepvqTextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = comment.createdAt.take(10), // Simplistic date format
                    color = CinepvqTextMuted,
                    fontSize = 11.sp
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = comment.content,
                color = CinepvqTextSecondary,
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
private fun BadgeChip(text: String) {
    Box(
        modifier = Modifier
            .background(CinepvqSurfaceVariant, RoundedCornerShape(4.dp))
            .border(0.5.dp, CinepvqBorderSubtle, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = text,
            color = CinepvqTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun DetailInfoRow(
    label: String,
    value: String,
    isHighlight: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            color = CinepvqTextMuted,
            fontSize = 12.sp,
            modifier = Modifier.width(100.dp)
        )
        Text(
            text = value,
            color = if (isHighlight) CinepvqAmber else CinepvqTextPrimary,
            fontSize = 12.sp,
            fontWeight = if (isHighlight) FontWeight.Bold else FontWeight.Normal,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f)
        )
    }
}
