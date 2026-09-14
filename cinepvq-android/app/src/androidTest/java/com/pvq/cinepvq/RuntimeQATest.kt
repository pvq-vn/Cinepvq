package com.pvq.cinepvq

import android.content.Intent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RuntimeQATest {

    @get:Rule
    val composeTestRule = createEmptyComposeRule()

    @Test
    fun testPlayerRuntimeQA() {
        val intent = Intent(ApplicationProvider.getApplicationContext(), MainActivity::class.java).apply {
            putExtra("route", "player/du-phuong-hanh/tap-01?serverName=Vietsub&embedUrl=")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        ActivityScenario.launch<MainActivity>(intent).use { scenario ->
            // Wait for player screen to load movie and video
            composeTestRule.waitUntil(timeoutMillis = 20000) {
                composeTestRule.onAllNodesWithText("Dữ Phượng Hành").fetchSemanticsNodes().isNotEmpty()
            }

            // 1. Test A: Tap player to show controls (Single seekbar interactive)
            val playerBox = composeTestRule.onAllNodesWithContentDescription("Video Player Area").onFirst()
            playerBox.performClick()

            // Verify controls appear: Play/Pause, Settings, Fullscreen
            composeTestRule.waitUntil(timeoutMillis = 5000) {
                composeTestRule.onAllNodesWithContentDescription("Cài đặt").fetchSemanticsNodes().isNotEmpty()
            }

            // 2. Test B: Switch Language / Server (Vietsub -> Thuyết Minh)
            val langBtn = composeTestRule.onAllNodesWithContentDescription("Ngôn ngữ").onFirst()
            langBtn.performClick()

            // Verify warning banner appears
            composeTestRule.waitUntil(timeoutMillis = 8000) {
                composeTestRule.onAllNodesWithText("Thời gian giữa các bản có thể không đồng bộ", substring = true).fetchSemanticsNodes().isNotEmpty() ||
                composeTestRule.onAllNodesWithText("Chọn bản phát").fetchSemanticsNodes().isNotEmpty()
            }

            // 3. Test F: Open Settings Bottom Sheet (Level 1 & Level 2 with fixed header)
            playerBox.performClick()
            val settingsBtn = composeTestRule.onAllNodesWithContentDescription("Cài đặt").onFirst()
            settingsBtn.performClick()

            composeTestRule.waitUntil(timeoutMillis = 5000) {
                composeTestRule.onAllNodesWithText("Cài đặt phát").fetchSemanticsNodes().isNotEmpty()
            }

            // Click Tốc độ phát (Level 2)
            val speedRow = composeTestRule.onAllNodesWithText("Tốc độ phát").onFirst()
            speedRow.performClick()

            composeTestRule.waitUntil(timeoutMillis = 5000) {
                composeTestRule.onAllNodesWithText("1.0x (Chuẩn)").fetchSemanticsNodes().isNotEmpty()
            }

            // Close settings
            val closeBtn = composeTestRule.onAllNodesWithContentDescription("Đóng").onFirst()
            closeBtn.performClick()
        }
    }
}
