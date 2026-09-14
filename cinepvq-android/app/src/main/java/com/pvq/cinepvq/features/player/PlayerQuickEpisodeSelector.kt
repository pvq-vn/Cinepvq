package com.pvq.cinepvq.features.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.ui.theme.*

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton

/**
 * Compact horizontal episode selector for Landscape / Fullscreen mode.
 * Shows "<" back button followed by number-only episode buttons (01, 02, ...).
 */
@Composable
fun PlayerQuickEpisodeSelector(
    episodes: List<EpisodeItem>,
    currentEpisodeSlug: String,
    onSelectEpisode: (EpisodeItem) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (episodes.isEmpty()) return

    val listState = rememberLazyListState()

    // Auto-scroll to currently playing episode
    LaunchedEffect(currentEpisodeSlug, episodes) {
        val index = episodes.indexOfFirst { it.slug == currentEpisodeSlug }
        if (index != -1) {
            val target = (index - 1).coerceAtLeast(0)
            listState.animateScrollToItem(target)
        }
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Back button to close quick episode selector
        IconButton(
            onClick = onClose,
            modifier = Modifier
                .size(36.dp)
                .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Quay lại",
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        LazyRow(
            state = listState,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.weight(1f)
        ) {
            itemsIndexed(episodes) { _, ep ->
                val isCurrent = ep.slug == currentEpisodeSlug

                Box(
                    modifier = Modifier
                        .size(width = 44.dp, height = 36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (isCurrent) CinepvqPrimary
                            else Color.Black.copy(alpha = 0.6f)
                        )
                        .border(
                            width = 1.dp,
                            color = if (isCurrent) CinepvqPrimaryLight else Color.White.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(8.dp)
                        )
                        .clickable { onSelectEpisode(ep) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = ep.episodeNumberOnly,
                        color = if (isCurrent) Color.White else Color.White.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
