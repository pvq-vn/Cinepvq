package com.pvq.cinepvq.core.designsystem.utils

import java.util.Locale

object EpisodeDisplayFormatter {

    private val SPECIAL_LABELS = listOf(
        "full", "trọn bộ", "tron bo", "trailer", "special", "đặc biệt", "dac biet",
        "ova", "movie", "preview", "tập đặc biệt", "tap dac biet"
    )

    /**
     * Normalizes episode display label to unified "Tập 01", "Tập 33" format.
     *
     * Examples:
     * - "01" -> "Tập 01"
     * - "1" -> "Tập 01"
     * - "tap-1" -> "Tập 01"
     * - "tap-01" -> "Tập 01"
     * - "Tap 01" -> "Tập 01"
     * - "episode-1" -> "Tập 01"
     * - "Episode 01" -> "Tập 01"
     * - "33" -> "Tập 33"
     * - "tập 33" -> "Tập 33"
     * - "Full" -> "Full"
     * - "Trailer" -> "Trailer"
     * - "Special" -> "Special"
     * - "Movie" -> "Movie"
     */
    fun format(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val trimmed = raw.trim()

        val lower = trimmed.lowercase(Locale.ROOT)
        // Check for special non-numbered labels first
        if (SPECIAL_LABELS.any { lower == it || lower == "tập $it" || lower == "tap $it" }) {
            return when {
                lower.contains("full") -> "Full"
                lower.contains("trọn bộ") || lower.contains("tron bo") -> "Trọn bộ"
                lower.contains("trailer") -> "Trailer"
                lower.contains("special") -> "Special"
                lower.contains("đặc biệt") || lower.contains("dac biet") -> "Đặc biệt"
                lower.contains("movie") -> "Movie"
                lower.contains("ova") -> "OVA"
                lower.contains("preview") -> "Preview"
                else -> trimmed
            }
        }

        // Check if there are digits in the string
        val digitMatch = Regex("""\d+""").find(trimmed)
        if (digitMatch != null) {
            val num = digitMatch.value.toIntOrNull()
            if (num != null) {
                return if (num < 10) {
                    String.format(Locale.ROOT, "Tập %02d", num)
                } else {
                    String.format(Locale.ROOT, "Tập %d", num)
                }
            }
        }

        // Fallback: If no digits, return trimmed
        return trimmed
    }
}
