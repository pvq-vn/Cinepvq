package com.pvq.cinepvq.features.watch.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pvq.cinepvq.domain.model.EpisodeItem
import com.pvq.cinepvq.domain.model.EpisodeServer
import com.pvq.cinepvq.ui.theme.*
import kotlinx.coroutines.launch

private const val CHUNK_SIZE = 10

/**
 * Modern Horizontal Episode List with YouTube-style pagination navigator:
 * <   01   02   03   ...   10   >
 * - Episode buttons show numbers only (01, 02)
 * - Navigation buttons (<, >) show icons only
 * - Clicking < or > immediately resets scroll to start of new group
 * - Current episode is automatically brought into viewport and highlighted
 * - No < on first group; no > on last group
 * - If total episodes <= 10, no pagination buttons (<, >) are rendered
 */
@Composable
fun EpisodeHorizontalList(
    servers: List<EpisodeServer>,
    selectedServerIndex: Int,
    onSelectServer: (Int) -> Unit,
    allEpisodes: List<EpisodeItem>,
    currentEpisodeSlug: String,
    onSelectEpisode: (EpisodeItem) -> Unit,
    modifier: Modifier = Modifier
) {
    if (allEpisodes.isEmpty()) return

    val coroutineScope = rememberCoroutineScope()
    val totalChunks = if (allEpisodes.isNotEmpty()) (allEpisodes.size + CHUNK_SIZE - 1) / CHUNK_SIZE else 1

    // Active pagination group index (0, 1, 2...)
    var activeChunkIndex by remember {
        val initialIdx = allEpisodes.indexOfFirst { it.slug == currentEpisodeSlug }
        val chunk = if (initialIdx >= 0) initialIdx / CHUNK_SIZE else 0
        mutableIntStateOf(chunk.coerceIn(0, (totalChunks - 1).coerceAtLeast(0)))
    }

    val safeChunk = activeChunkIndex.coerceIn(0, (totalChunks - 1).coerceAtLeast(0))
    val displayedEpisodes = remember(allEpisodes, safeChunk) {
        allEpisodes.drop(safeChunk * CHUNK_SIZE).take(CHUNK_SIZE)
    }

    val listState = rememberLazyListState()

    // Auto-navigate to correct chunk & scroll active episode into viewport
    LaunchedEffect(currentEpisodeSlug, allEpisodes) {
        val epIdx = allEpisodes.indexOfFirst { it.slug == currentEpisodeSlug }
        if (epIdx >= 0) {
            val neededChunk = epIdx / CHUNK_SIZE
            if (activeChunkIndex != neededChunk) {
                activeChunkIndex = neededChunk
            }
            val relativeIdx = epIdx % CHUNK_SIZE
            val listIndex = if (neededChunk > 0) relativeIdx + 1 else relativeIdx
            val target = (listIndex - 1).coerceAtLeast(0)
            listState.animateScrollToItem(target)
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        // ── Section Title & Total Count ──
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Danh sách tập",
                color = CinepvqTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(CinepvqPrimary.copy(alpha = 0.15f))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "${allEpisodes.size} tập",
                    color = CinepvqPrimaryLight,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // ── Audio / Server Switcher Chips (if > 1 server) ──
        if (servers.size > 1) {
            Spacer(modifier = Modifier.height(10.dp))
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(servers) { index, server ->
                    val isSelected = index == selectedServerIndex
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            onSelectServer(index)
                            activeChunkIndex = 0
                            coroutineScope.launch {
                                listState.scrollToItem(0)
                            }
                        },
                        label = {
                            Text(
                                text = server.serverName,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            containerColor = CinepvqSurface,
                            labelColor = CinepvqTextSecondary,
                            selectedContainerColor = CinepvqPrimary,
                            selectedLabelColor = Color.White
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = isSelected,
                            borderColor = if (isSelected) CinepvqPrimary else CinepvqBorderSubtle
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // ── Episode Navigator Row [<  01  02  03  ...  10  >] ──
        LazyRow(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Previous Group Button (<) - only when safeChunk > 0
            if (totalChunks > 1 && safeChunk > 0) {
                item(key = "prev_chunk") {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(CinepvqSurface)
                            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(10.dp))
                            .clickable {
                                activeChunkIndex = safeChunk - 1
                                coroutineScope.launch {
                                    listState.scrollToItem(0)
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBackIos,
                            contentDescription = "Nhóm tập trước",
                            tint = CinepvqPrimaryLight,
                            modifier = Modifier
                                .size(14.dp)
                                .padding(start = 2.dp)
                        )
                    }
                }
            }

            // Episode Buttons (01, 02, 03...)
            itemsIndexed(displayedEpisodes, key = { _, ep -> ep.slug }) { _, ep ->
                val isCurrentPlay = currentEpisodeSlug == ep.slug
                val bgColor by animateColorAsState(
                    targetValue = if (isCurrentPlay) CinepvqPrimary else CinepvqSurface,
                    label = "epBg"
                )
                val borderColor by animateColorAsState(
                    targetValue = if (isCurrentPlay) CinepvqPrimaryLight else CinepvqBorderSubtle,
                    label = "epBorder"
                )

                Box(
                    modifier = Modifier
                        .size(width = 46.dp, height = 42.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(bgColor)
                        .border(1.dp, borderColor, RoundedCornerShape(10.dp))
                        .clickable { onSelectEpisode(ep) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = ep.episodeNumberOnly,
                        color = if (isCurrentPlay) Color.White else CinepvqTextPrimary,
                        fontSize = 13.sp,
                        fontWeight = if (isCurrentPlay) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }

            // Next Group Button (>) - only when safeChunk < totalChunks - 1
            if (totalChunks > 1 && safeChunk < totalChunks - 1) {
                item(key = "next_chunk") {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(CinepvqSurface)
                            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(10.dp))
                            .clickable {
                                activeChunkIndex = safeChunk + 1
                                coroutineScope.launch {
                                    listState.scrollToItem(0)
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                            contentDescription = "Nhóm tập tiếp theo",
                            tint = CinepvqPrimaryLight,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}
