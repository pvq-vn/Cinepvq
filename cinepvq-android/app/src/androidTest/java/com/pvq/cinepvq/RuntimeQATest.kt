package com.pvq.cinepvq

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RuntimeQATest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun testHomeScrollAndNavigation() {
        // Wait for Home screen to load
        composeTestRule.waitUntil(timeoutMillis = 15000) {
            composeTestRule.onAllNodesWithText("Phim Tài Liệu").fetchSemanticsNodes().isNotEmpty() || 
            composeTestRule.onAllNodesWithText("Khám phá").fetchSemanticsNodes().isNotEmpty()
        }

        // We will just try to scroll the screen down by swiping on the root
        val rootNode = composeTestRule.onRoot()
        
        // Scroll down
        for (i in 1..5) {
            rootNode.performTouchInput { swipeUp() }
            Thread.sleep(500)
        }
        
        // Scroll up
        for (i in 1..5) {
            rootNode.performTouchInput { swipeDown() }
            Thread.sleep(500)
        }

        // Try to click any movie card using content description or tag if available
        // We will click "Chi Tiết" if it exists
        val detailButton = composeTestRule.onAllNodesWithText("Chi Tiết").onFirst()
        if (detailButton.isDisplayed()) {
            detailButton.performClick()
            
            // Wait for detail screen
            composeTestRule.waitUntil(timeoutMillis = 5000) {
                composeTestRule.onAllNodesWithText("Xem Ngay").fetchSemanticsNodes().isNotEmpty()
            }
            
            // Go back
            composeTestRule.onRoot().performTouchInput { swipeRight() } // or system back
        }
    }
}
