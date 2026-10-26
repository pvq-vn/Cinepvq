package com.pvq.cinepvq.features.watch.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pvq.cinepvq.ui.theme.*

/**
 * Action Bar row located directly beneath the movie header:
 * Favorite, Watch Later, and Share buttons with distinct active states and feedback.
 */
@Composable
fun MovieActionBar(
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    isWatchLater: Boolean,
    onToggleWatchLater: () -> Unit,
    onShareClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Favorite Button
        ActionBarItem(
            icon = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
            label = "Yêu thích",
            isActive = isFavorite,
            activeColor = CinepvqRed,
            onClick = onToggleFavorite,
            modifier = Modifier.weight(1f)
        )

        // Watch Later Button
        ActionBarItem(
            icon = if (isWatchLater) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
            label = "Xem sau",
            isActive = isWatchLater,
            activeColor = CinepvqPrimaryLight,
            onClick = onToggleWatchLater,
            modifier = Modifier.weight(1f)
        )

        // Share Button
        ActionBarItem(
            icon = Icons.Default.Share,
            label = "Chia sẻ",
            isActive = false,
            onClick = onShareClick,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ActionBarItem(
    icon: ImageVector,
    label: String,
    isActive: Boolean,
    activeColor: Color = CinepvqPrimary,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = if (isActive) activeColor.copy(alpha = 0.12f) else CinepvqSurface
    val borderColor = if (isActive) activeColor.copy(alpha = 0.5f) else CinepvqBorderSubtle
    val contentColor = if (isActive) activeColor else CinepvqTextSecondary

    Box(
        modifier = modifier
            .height(42.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = contentColor,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = label,
                color = contentColor,
                fontSize = 12.sp,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
