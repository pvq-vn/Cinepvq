package com.pvq.cinepvq.features.watch.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Comment
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.pvq.cinepvq.core.network.model.Comment
import com.pvq.cinepvq.ui.theme.*

/**
 * Compact Comment Preview Card shown on the watch screen.
 * Tapping it triggers the full CommentBottomSheet.
 */
@Composable
fun CommentPreviewCard(
    comments: List<Comment>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(CinepvqSurface)
            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Comment,
                    contentDescription = null,
                    tint = CinepvqPrimary,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Bình luận (${comments.size})",
                    color = CinepvqTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = "Xem tất cả >",
                color = CinepvqPrimaryLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Preview snippet
        val latest = comments.firstOrNull()
        if (latest != null) {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Mini Avatar
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(CinepvqSurfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    if (!latest.avatar.isNullOrBlank()) {
                        AsyncImage(
                            model = latest.avatar,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(
                            text = latest.author.take(1).uppercase(),
                            color = CinepvqTextPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = latest.author.ifBlank { "Khán giả" },
                        color = CinepvqTextPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = latest.content,
                        color = CinepvqTextSecondary,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        } else {
            Text(
                text = "Chưa có bình luận nào. Nhấn để trở thành người đầu tiên chia sẻ cảm nghĩ!",
                color = CinepvqTextMuted,
                fontSize = 12.sp
            )
        }
    }
}

/**
 * Full Comment Bottom Sheet: lists comments with author, date, and allows writing new comments.
 */
/**
 * Full Comment Bottom Sheet: lists comments with author, date, and allows writing new comments.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentBottomSheet(
    comments: List<Comment>,
    isPostingComment: Boolean,
    onPostComment: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var commentInput by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CinepvqSurface,
        tonalElevation = 12.dp,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(CinepvqBorder)
            )
        },
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Sheet Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Bình luận (${comments.size})",
                    color = CinepvqTextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .size(32.dp)
                        .background(CinepvqSurfaceVariant, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Đóng",
                        tint = CinepvqTextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Comments List
            if (comments.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Chưa có bình luận nào.\nHãy là người đầu tiên bình luận phim này!",
                        color = CinepvqTextMuted,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 120.dp, max = 340.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(comments) { comment ->
                        CommentItemRow(comment = comment)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Comment Input Bar
            CommentInputRow(
                input = commentInput,
                onInputChange = { commentInput = it },
                isPosting = isPostingComment,
                onSend = {
                    val text = commentInput.trim()
                    if (text.isNotBlank()) {
                        onPostComment(text)
                        commentInput = ""
                    }
                }
            )

            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

/**
 * YouTube-style Side Panel for comments in Landscape / Fullscreen mode.
 * Occupies the right ~35% of the screen while video plays continuously on the left.
 */
@Composable
fun LandscapeCommentsPanel(
    comments: List<Comment>,
    isPostingComment: Boolean,
    onPostComment: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    var commentInput by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .widthIn(min = 280.dp)
            .fillMaxHeight()
            .background(CinepvqSurface)
            .border(width = 1.dp, color = CinepvqBorderSubtle)
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        // Header (Single row guaranteed)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Bình luận (${comments.size})",
                color = CinepvqTextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .size(32.dp)
                    .background(CinepvqSurfaceVariant, CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Đóng bình luận",
                    tint = CinepvqTextSecondary,
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Comments List
        if (comments.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Chưa có bình luận nào.",
                    color = CinepvqTextMuted,
                    fontSize = 12.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(comments) { comment ->
                    CommentItemRow(comment = comment)
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Input
        CommentInputRow(
            input = commentInput,
            onInputChange = { commentInput = it },
            isPosting = isPostingComment,
            onSend = {
                val text = commentInput.trim()
                if (text.isNotBlank()) {
                    onPostComment(text)
                    commentInput = ""
                }
            }
        )
    }
}

@Composable
private fun CommentItemRow(comment: Comment) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Avatar
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
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
                    fontSize = 13.sp
                )
            }
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = comment.author.ifBlank { "Khán giả" },
                    color = CinepvqTextPrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp
                )
                Text(
                    text = comment.createdAt.take(10),
                    color = CinepvqTextMuted,
                    fontSize = 11.sp
                )
            }
            Spacer(modifier = Modifier.height(3.dp))
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
private fun CommentInputRow(
    input: String,
    onInputChange: (String) -> Unit,
    isPosting: Boolean,
    onSend: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = input,
            onValueChange = onInputChange,
            placeholder = {
                Text("Viết cảm nghĩ về phim...", color = CinepvqTextMuted, fontSize = 13.sp)
            },
            singleLine = true,
            shape = RoundedCornerShape(20.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = CinepvqSurfaceVariant,
                unfocusedContainerColor = CinepvqSurfaceVariant,
                focusedBorderColor = CinepvqPrimary,
                unfocusedBorderColor = CinepvqBorderSubtle,
                focusedTextColor = CinepvqTextPrimary,
                unfocusedTextColor = CinepvqTextPrimary
            ),
            modifier = Modifier.weight(1f)
        )

        IconButton(
            onClick = onSend,
            enabled = input.isNotBlank() && !isPosting,
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(if (input.isNotBlank()) CinepvqPrimary else CinepvqSurfaceVariant)
        ) {
            if (isPosting) {
                CircularProgressIndicator(
                    color = Color.White,
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp
                )
            } else {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Gửi",
                    tint = if (input.isNotBlank()) Color.White else CinepvqTextMuted,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
