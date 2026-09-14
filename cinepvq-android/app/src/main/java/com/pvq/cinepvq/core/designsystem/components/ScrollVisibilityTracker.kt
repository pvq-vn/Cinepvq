package com.pvq.cinepvq.core.designsystem.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.runtime.*

/**
 * Tracks scroll direction on a LazyListState directly using snapshotFlow.
 * - Swipe up / content moving down into view: onVisibilityChanged(false) -> hide bars.
 * - Swipe down / content moving back up towards top: onVisibilityChanged(true) -> show bars.
 * - Near the very top (index 0, offset <= 10): always onVisibilityChanged(true).
 */
@Composable
fun TrackLazyListScroll(
    listState: LazyListState,
    threshold: Int = 16,
    onVisibilityChanged: ((Boolean) -> Unit)?
) {
    if (onVisibilityChanged == null) return

    var previousIndex by remember { mutableIntStateOf(listState.firstVisibleItemIndex) }
    var previousOffset by remember { mutableIntStateOf(listState.firstVisibleItemScrollOffset) }

    LaunchedEffect(listState) {
        snapshotFlow {
            listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset
        }.collect { (currentIndex, currentOffset) ->
            if (currentIndex == 0 && currentOffset <= 10) {
                onVisibilityChanged(true)
                previousIndex = 0
                previousOffset = currentOffset
                return@collect
            }

            val indexDiff = currentIndex - previousIndex
            val offsetDiff = currentOffset - previousOffset

            if (indexDiff > 0) {
                // Swiped up -> moving down into content -> HIDE
                onVisibilityChanged(false)
                previousIndex = currentIndex
                previousOffset = currentOffset
            } else if (indexDiff < 0) {
                // Swiped down -> moving up towards top -> SHOW
                onVisibilityChanged(true)
                previousIndex = currentIndex
                previousOffset = currentOffset
            } else if (offsetDiff > threshold) {
                // Offset increased -> HIDE
                onVisibilityChanged(false)
                previousOffset = currentOffset
            } else if (offsetDiff < -threshold) {
                // Offset decreased -> SHOW
                onVisibilityChanged(true)
                previousOffset = currentOffset
            }
        }
    }
}

/**
 * Tracks scroll direction on a LazyGridState directly using snapshotFlow.
 */
@Composable
fun TrackLazyGridScroll(
    gridState: LazyGridState,
    threshold: Int = 16,
    onVisibilityChanged: ((Boolean) -> Unit)?
) {
    if (onVisibilityChanged == null) return

    var previousIndex by remember { mutableIntStateOf(gridState.firstVisibleItemIndex) }
    var previousOffset by remember { mutableIntStateOf(gridState.firstVisibleItemScrollOffset) }

    LaunchedEffect(gridState) {
        snapshotFlow {
            gridState.firstVisibleItemIndex to gridState.firstVisibleItemScrollOffset
        }.collect { (currentIndex, currentOffset) ->
            if (currentIndex == 0 && currentOffset <= 10) {
                onVisibilityChanged(true)
                previousIndex = 0
                previousOffset = currentOffset
                return@collect
            }

            val indexDiff = currentIndex - previousIndex
            val offsetDiff = currentOffset - previousOffset

            if (indexDiff > 0) {
                onVisibilityChanged(false)
                previousIndex = currentIndex
                previousOffset = currentOffset
            } else if (indexDiff < 0) {
                onVisibilityChanged(true)
                previousIndex = currentIndex
                previousOffset = currentOffset
            } else if (offsetDiff > threshold) {
                onVisibilityChanged(false)
                previousOffset = currentOffset
            } else if (offsetDiff < -threshold) {
                onVisibilityChanged(true)
                previousOffset = currentOffset
            }
        }
    }
}

/**
 * Tracks scroll direction on a ScrollState (verticalScroll) directly using snapshotFlow.
 */
@Composable
fun TrackScrollState(
    scrollState: ScrollState,
    threshold: Int = 16,
    onVisibilityChanged: ((Boolean) -> Unit)?
) {
    if (onVisibilityChanged == null) return

    var previousOffset by remember { mutableIntStateOf(scrollState.value) }

    LaunchedEffect(scrollState) {
        snapshotFlow { scrollState.value }
            .collect { currentOffset ->
                if (currentOffset <= 10) {
                    onVisibilityChanged(true)
                    previousOffset = currentOffset
                    return@collect
                }
                val diff = currentOffset - previousOffset
                if (diff > threshold) {
                    onVisibilityChanged(false)
                    previousOffset = currentOffset
                } else if (diff < -threshold) {
                    onVisibilityChanged(true)
                    previousOffset = currentOffset
                }
            }
    }
}
