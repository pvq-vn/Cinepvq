package com.pvq.cinepvq.features.player

import android.app.Activity
import android.content.Context
import android.provider.Settings
import kotlin.math.roundToInt

/**
 * Pure math & Android system-brightness helpers for responsive player gestures.
 */
object PlayerGestureMath {

    /**
     * Normalizes raw `Settings.System.SCREEN_BRIGHTNESS` into `[0.01f, 1.0f]`.
     * Handles standard Android `255` as well as vendor high-precision ranges (`1023`, `4095`).
     */
    fun normalizeSystemBrightness(rawBrightness: Int, configuredMax: Int = 255): Float {
        if (rawBrightness <= 0) return 0.01f
        val effectiveMax = when {
            configuredMax >= rawBrightness && configuredMax > 0 -> configuredMax
            rawBrightness > 1023 -> 4095
            rawBrightness > 255 -> 1023
            else -> 255
        }
        return (rawBrightness.toFloat() / effectiveMax.toFloat()).coerceIn(0.01f, 1.0f)
    }

    /**
     * Reads true current brightness: window override if already adjusted in this session,
     * otherwise actual Android system brightness (prevents jumping from e.g. 30% -> 50% on first drag!).
     */
    fun readCurrentBrightness(context: Context, activity: Activity?): Float {
        val windowBri = activity?.window?.attributes?.screenBrightness
        if (windowBri != null && windowBri >= 0f) {
            return windowBri.coerceIn(0.01f, 1.0f)
        }
        // Android 11+ / OEM float brightness (exact 0f..1f regardless of vendor integer max scale)
        try {
            val floatBri = Settings.System.getFloat(context.contentResolver, "screen_brightness_float")
            if (floatBri in 0.0f..1.0f) {
                return floatBri.coerceIn(0.01f, 1.0f)
            }
        } catch (_: Exception) {}

        return try {
            val raw = Settings.System.getInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS
            )
            val resId = context.resources.getIdentifier(
                "config_screenBrightnessSettingMaximum",
                "integer",
                "android"
            )
            val maxBri = if (resId != 0) {
                try {
                    context.resources.getInteger(resId)
                } catch (_: Exception) {
                    255
                }
            } else {
                255
            }
            normalizeSystemBrightness(raw, maxBri)
        } catch (_: Exception) {
            0.5f
        }
    }

    /**
     * Computes responsive seek delta in seconds from horizontal drag distance.
     * Uses roundToInt() (no truncation deadzone) and full-width scaling (~90s across half screen).
     */
    fun computeSeekDeltaSeconds(dragX: Float, containerWidthPx: Float): Int {
        val effectiveSpan = (containerWidthPx * 0.48f).coerceAtLeast(180f)
        return ((dragX / effectiveSpan) * 90f).roundToInt()
    }

    /**
     * Computes integer Android AudioManager volume index using roundToInt().
     */
    fun computeVolumeIndex(volumeFraction: Float, maxVolume: Int): Int {
        val safeMax = maxVolume.coerceAtLeast(1)
        return (volumeFraction.coerceIn(0f, 1f) * safeMax).roundToInt().coerceIn(0, safeMax)
    }
}
