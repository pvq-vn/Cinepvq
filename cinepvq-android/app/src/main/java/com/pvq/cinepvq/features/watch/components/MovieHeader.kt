package com.pvq.cinepvq.features.watch.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pvq.cinepvq.domain.model.MovieDetail
import com.pvq.cinepvq.ui.theme.*

/**
 * Movie Header with instant expand/collapse (no animation delay).
 * Derived title/part/episode/duration display without repetition.
 * Natural inline metadata format: "Đạo diễn: Deng Ke".
 */
@Composable
fun MovieHeader(
    movie: MovieDetail,
    currentEpisodeName: String,
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }
    val arrowRotation = if (isExpanded) 180f else 0f

    // Derive parsed title and part (e.g. "Phần 2")
    val (baseTitle, partString) = movie.parsedTitleAndPart
    val cleanEp = currentEpisodeName.trim()
    val epLabel = if (cleanEp.isNotBlank()) {
        com.pvq.cinepvq.core.designsystem.utils.EpisodeDisplayFormatter.format(cleanEp)
    } else ""
    val durationText = movie.time.trim()

    // Build subtitle line: "Phần 2 - Tập 23 - 24 phút/tập"
    val subtitleParts = mutableListOf<String>()
    if (!partString.isNullOrBlank()) subtitleParts.add(partString)
    if (epLabel.isNotBlank()) subtitleParts.add(epLabel)
    if (durationText.isNotBlank()) subtitleParts.add(durationText)
    val subtitleLine = subtitleParts.joinToString(" - ")

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(CinepvqSurface)
            .border(1.dp, CinepvqBorderSubtle, RoundedCornerShape(14.dp))
            .clickable { isExpanded = !isExpanded }
            .padding(16.dp)
    ) {
        // ── Top Summary Row (Always Visible) ──
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Movie Base Name (without "(Phần X)")
                Text(
                    text = baseTitle,
                    color = CinepvqTextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = if (isExpanded) Int.MAX_VALUE else 2,
                    overflow = TextOverflow.Ellipsis
                )

                // Subtitle Info: "Phần X - Tập XX - thời lượng/tập"
                if (subtitleLine.isNotBlank()) {
                    Text(
                        text = subtitleLine,
                        color = CinepvqPrimaryLight,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                // Short metadata tags (Year, Quality, Lang - do NOT repeat duration)
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (movie.year.isNotBlank()) {
                        HeaderBadge(text = movie.year)
                    }
                    if (movie.quality.isNotBlank()) {
                        HeaderBadge(text = movie.quality)
                    }
                    if (movie.lang.isNotBlank()) {
                        HeaderBadge(text = movie.lang)
                    }
                }
            }

            // Expand / Collapse Indicator Chevron
            Box(
                modifier = Modifier
                    .padding(start = 8.dp)
                    .size(28.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(CinepvqSurfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.KeyboardArrowDown,
                    contentDescription = if (isExpanded) "Thu gọn thông tin" else "Mở rộng thông tin",
                    tint = CinepvqTextSecondary,
                    modifier = Modifier
                        .size(18.dp)
                        .rotate(arrowRotation)
                )
            }
        }

        // ── Expandable Details Section (Instant, No Animation Delay) ──
        if (isExpanded) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp)
            ) {
                // Divider line
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(CinepvqBorderSubtle)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Synopsis
                if (movie.description.isNotBlank()) {
                    val cleanDesc = movie.description
                        .replace("<p>", "")
                        .replace("</p>", "\n")
                        .replace("<br>", "\n")
                        .replace("<br/>", "\n")
                        .trim()

                    Text(
                        text = "Nội dung phim",
                        color = CinepvqTextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )

                    Text(
                        text = cleanDesc,
                        color = CinepvqTextSecondary,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                // Natural Inline Metadata Rows (label & value adjacent, natural wrapping)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (movie.director.isNotBlank()) {
                        InfoRow(label = "Đạo diễn:", value = movie.director)
                    }
                    if (movie.actor.isNotBlank()) {
                        InfoRow(label = "Diễn viên:", value = movie.actor)
                    }
                    if (movie.categories.isNotEmpty()) {
                        InfoRow(label = "Thể loại:", value = movie.categories.joinToString(", "))
                    }
                    if (movie.countries.isNotEmpty()) {
                        InfoRow(label = "Quốc gia:", value = movie.countries.joinToString(", "))
                    }
                    if (movie.year.isNotBlank()) {
                        InfoRow(label = "Năm phát hành:", value = movie.year)
                    }
                    if (movie.episodeCurrent.isNotBlank()) {
                        InfoRow(label = "Tình trạng:", value = movie.episodeCurrent, isHighlight = true)
                    }
                    if (movie.time.isNotBlank()) {
                        InfoRow(label = "Thời lượng:", value = movie.time)
                    }
                }
            }
        }
    }
}

@Composable
private fun HeaderBadge(text: String) {
    Box(
        modifier = Modifier
            .background(CinepvqSurfaceVariant, RoundedCornerShape(4.dp))
            .border(0.5.dp, CinepvqBorderSubtle, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = text,
            color = CinepvqTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Inline metadata format where label and value sit naturally together,
 * wrapping without giant empty spaces between them.
 */
@Composable
private fun InfoRow(
    label: String,
    value: String,
    isHighlight: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = label,
            color = CinepvqTextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = value,
            color = if (isHighlight) CinepvqAmber else CinepvqTextSecondary,
            fontSize = 12.sp,
            fontWeight = if (isHighlight) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.weight(1f, fill = false)
        )
    }
}
