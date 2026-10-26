package com.pvq.cinepvq.data.user

import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAccessor

/**
 * Thread-safe, standardized ISO-8601 UTC timestamp utility for Cinepvq data synchronization.
 * Guarantees strict compatibility with backend PostgreSQL TIMESTAMP and JavaScript Date parsing.
 */
object IsoTimestampHelper {

    private val isoInstantFormatter = DateTimeFormatter.ISO_INSTANT

    /**
     * Generates a standardized UTC ISO-8601 timestamp string (e.g. "2026-09-15T06:35:00.123Z").
     */
    fun nowIso(): String {
        return isoInstantFormatter.format(Instant.now())
    }

    /**
     * Formats an epoch millisecond timestamp as a standardized UTC ISO-8601 string.
     */
    fun formatEpochMillis(millis: Long): String {
        return isoInstantFormatter.format(Instant.ofEpochMilli(millis))
    }

    /**
     * Parses an ISO-8601 string into epoch milliseconds (Long).
     * Thread-safe and resilient against:
     * - Strings with or without milliseconds (e.g. 2026-09-15T06:35:00Z vs 2026-09-15T06:35:00.123Z)
     * - Strings with micro/nanoseconds (e.g. Postgres 2026-09-15T06:35:00.123456Z)
     * - Strings with timezone offset (e.g. 2026-09-15T13:35:00+07:00)
     */
    fun parseIsoToEpochMillis(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        val trimmed = iso.trim()

        return try {
            Instant.parse(trimmed).toEpochMilli()
        } catch (_: Exception) {
            try {
                OffsetDateTime.parse(trimmed).toInstant().toEpochMilli()
            } catch (_: Exception) {
                try {
                    val accessor: TemporalAccessor = DateTimeFormatter.ISO_DATE_TIME.parse(trimmed)
                    Instant.from(accessor).toEpochMilli()
                } catch (_: Exception) {
                    0L
                }
            }
        }
    }

    /**
     * Checks if a string is a parseable ISO-8601 timestamp.
     */
    fun isValidIso(iso: String?): Boolean {
        if (iso.isNullOrBlank()) return false
        return parseIsoToEpochMillis(iso) > 0L
    }
}
