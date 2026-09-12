package com.pvq.cinepvq.features.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pvq.cinepvq.core.designsystem.components.EmptyView
import com.pvq.cinepvq.core.designsystem.components.LoadingView
import com.pvq.cinepvq.core.designsystem.components.MovieCard
import com.pvq.cinepvq.ui.theme.*

@Composable
fun SearchScreen(
    onMovieClick: (String) -> Unit,
    viewModel: SearchViewModel = viewModel()
) {
    val focusManager = LocalFocusManager.current
    val query by viewModel.query.collectAsStateWithLifecycle()
    val searchResults by viewModel.searchResults.collectAsStateWithLifecycle()
    val isSearching by viewModel.isSearching.collectAsStateWithLifecycle()
    val selectedTag by viewModel.selectedTag.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinepvqBackground)
            .statusBarsPadding()
            .imePadding()
    ) {
        // Search Input Bar
        OutlinedTextField(
            value = query,
            onValueChange = { viewModel.onQueryChange(it) },
            placeholder = {
                Text(
                    text = "Tìm kiếm phim, diễn viên...",
                    color = CinepvqTextMuted,
                    fontSize = 14.sp
                )
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = null,
                    tint = CinepvqTextSecondary
                )
            },
            trailingIcon = {
                if (query.isNotBlank()) {
                    IconButton(onClick = {
                        viewModel.clearQuery()
                        focusManager.clearFocus()
                    }) {
                        Icon(
                            imageVector = Icons.Default.Clear,
                            contentDescription = "Xóa",
                            tint = CinepvqTextSecondary
                        )
                    }
                }
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = {
                viewModel.saveSearchQuery(query)
                focusManager.clearFocus()
            }),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = CinepvqSurface,
                unfocusedContainerColor = CinepvqSurface,
                focusedBorderColor = CinepvqPrimary,
                unfocusedBorderColor = CinepvqBorderSubtle,
                focusedTextColor = CinepvqTextPrimary,
                unfocusedTextColor = CinepvqTextPrimary,
                cursorColor = CinepvqPrimary
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        )

        val searchHistory by viewModel.searchHistory.collectAsStateWithLifecycle(emptyList())

        val activeCategory by viewModel.activeCategory.collectAsStateWithLifecycle()
        val activeGenre by viewModel.activeGenre.collectAsStateWithLifecycle()
        val activeCountry by viewModel.activeCountry.collectAsStateWithLifecycle()
        val activeSort by viewModel.activeSort.collectAsStateWithLifecycle()

        val activeFiltersCount = listOfNotNull(activeCategory, activeGenre, activeCountry, if (activeSort != "latest") activeSort else null).size

        // Advanced Filters Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Default.Menu,
                    contentDescription = null,
                    tint = CinepvqPrimary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Bộ lọc nâng cao",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = CinepvqTextPrimary
                )
                if (activeFiltersCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .background(CinepvqPrimary, RoundedCornerShape(12.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = activeFiltersCount.toString(),
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            if (activeFiltersCount > 0) {
                TextButton(
                    onClick = { viewModel.clearAllFilters() },
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("Đặt lại", fontSize = 12.sp, color = Color.Red)
                }
            }
        }

        // Filter Rows
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            val categories = listOf(
                "phim-bo" to "Phim Bộ",
                "phim-le" to "Phim Lẻ",
                "hoat-hinh" to "Hoạt Hình",
                "tv-shows" to "TV Show",
                "dang-chieu" to "Đang Chiếu"
            )
            
            val genres = listOf(
                "hanh-dong" to "Hành Động",
                "tinh-cam" to "Tình Cảm",
                "kinh-di" to "Kinh Dị",
                "hai-huoc" to "Hài Hước",
                "vien-tuong" to "Viễn Tưởng",
                "tam-ly" to "Tâm Lý"
            )

            val countries = listOf(
                "han-quoc" to "Hàn Quốc",
                "trung-quoc" to "Trung Quốc",
                "nhat-ban" to "Nhật Bản",
                "thai-lan" to "Thái Lan",
                "au-my" to "Âu Mỹ",
                "viet-nam" to "Việt Nam"
            )

            val sorts = listOf(
                "latest" to "Mới cập nhật",
                "name" to "Tên A-Z",
                "year" to "Năm giảm dần"
            )

            item {
                FilterDropdownMenu("Danh mục", categories, activeCategory) { slug ->
                    viewModel.applyFilter("category", slug)
                }
            }
            item {
                FilterDropdownMenu("Thể loại", genres, activeGenre) { slug ->
                    viewModel.applyFilter("genre", slug)
                }
            }
            item {
                FilterDropdownMenu("Quốc gia", countries, activeCountry) { slug ->
                    viewModel.applyFilter("country", slug)
                }
            }
            item {
                FilterDropdownMenu("Sắp xếp", sorts, activeSort, isSort = true) { slug ->
                    if (slug != null) viewModel.onSortChanged(slug)
                }
            }
        }

        // History Section
        if (query.isBlank() && searchHistory.isNotEmpty() && activeFiltersCount == 0) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Lịch sử tìm kiếm",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = CinepvqTextPrimary
                )
                TextButton(
                    onClick = { viewModel.clearSearchHistory() },
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("Xóa tất cả", fontSize = 12.sp, color = CinepvqPrimary)
                }
            }
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                items(searchHistory, key = { it.query }) { hist ->
                    SuggestionChip(
                        onClick = {
                            viewModel.onQueryChange(hist.query)
                            focusManager.clearFocus()
                        },
                        label = { Text(hist.query, fontSize = 12.sp) },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            containerColor = CinepvqSurfaceVariant,
                            labelColor = CinepvqTextSecondary
                        ),
                        border = SuggestionChipDefaults.suggestionChipBorder(
                            enabled = true,
                            borderColor = Color.Transparent
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            }
        }

        // Results Grid
        Box(modifier = Modifier.fillMaxSize()) {
            when {
                isSearching -> {
                    LoadingView()
                }
                searchResults.isEmpty() -> {
                    EmptyView(
                        message = if (query.isNotBlank()) "Không tìm thấy phim phù hợp với '$query'"
                        else "Chưa có phim trong danh mục này"
                    )
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 105.dp),
                        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 80.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(searchResults, key = { it.slug }) { movie ->
                            MovieCard(
                                movie = movie,
                                width = 110.dp,
                                onClick = { onMovieClick(movie.slug) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilterDropdownMenu(
    label: String,
    options: List<Pair<String, String>>,
    selectedValue: String?,
    isSort: Boolean = false,
    onValueSelected: (String?) -> Unit
) {
    var expanded by androidx.compose.runtime.mutableStateOf(false)
    val selectedText = if (isSort) {
        options.find { it.first == (selectedValue ?: "latest") }?.second ?: "Mới cập nhật"
    } else {
        options.find { it.first == selectedValue }?.second ?: "Tất cả"
    }
    
    val isSelected = if (isSort) selectedValue != "latest" && selectedValue != null else selectedValue != null

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        FilterChip(
            selected = isSelected,
            onClick = { expanded = true },
            label = {
                Text(
                    text = if (isSelected) selectedText else label,
                    fontSize = 12.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
            },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = FilterChipDefaults.filterChipColors(
                containerColor = CinepvqSurface,
                labelColor = CinepvqTextSecondary,
                selectedContainerColor = CinepvqPrimary.copy(alpha = 0.15f),
                selectedLabelColor = CinepvqPrimary
            ),
            border = FilterChipDefaults.filterChipBorder(
                enabled = true,
                selected = isSelected,
                borderColor = if (isSelected) CinepvqPrimary else CinepvqBorderSubtle
            ),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.menuAnchor()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(CinepvqSurface)
        ) {
            DropdownMenuItem(
                text = { Text(if (isSort) "Mới cập nhật (Mặc định)" else "Tất cả", color = CinepvqTextPrimary) },
                onClick = {
                    onValueSelected(if (isSort) "latest" else null)
                    expanded = false
                }
            )
            options.forEach { option ->
                val active = if (isSort) option.first == (selectedValue ?: "latest") else option.first == selectedValue
                DropdownMenuItem(
                    text = { 
                        Text(
                            option.second, 
                            color = if (active) CinepvqPrimary else CinepvqTextPrimary,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.Normal
                        ) 
                    },
                    onClick = {
                        onValueSelected(option.first)
                        expanded = false
                    }
                )
            }
        }
    }
}
