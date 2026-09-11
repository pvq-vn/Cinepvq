"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Film,
  Loader2,
  ArrowRight,
  History,
  Trash2,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { searchMovies } from "@/services/api";
import { GENRES, COUNTRIES } from "@/lib/taxonomy";
import type { Movie } from "@/types/movie";

const RECENT_SEARCHES_KEY = "cinepvq_recent_searches";
const MAX_RECENT_SEARCHES = 10;

const CATEGORIES = [
  { name: "Phim Bộ", slug: "phim-bo" },
  { name: "Phim Lẻ", slug: "phim-le" },
  { name: "Hoạt Hình", slug: "hoat-hinh" },
  { name: "TV Show", slug: "tv-shows" },
  { name: "Đang Chiếu", slug: "dang-chieu" },
];

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2015, 2010];

const POPULAR_SEARCHES = [
  "Đấu La Đại Lục",
  "Thám Tử Lừng Danh Conan",
  "Naruto",
  "One Piece",
  "Harry Potter",
  "Spider-Man",
];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function saveRecentSearch(keyword: string): void {
  if (typeof window === "undefined") return;
  const trimmed = keyword.trim();
  if (!trimmed) return;
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    filtered.unshift(trimmed);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(filtered.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {}
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // Filter selections
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSort, setSelectedSort] = useState("latest");

  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  const loadRecentSearches = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const handleRemoveRecentSearch = (term: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const updated = recentSearches.filter((t) => t !== term);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleClearAllRecentSearches = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setRecentSearches([]);
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  const handleClose = useCallback(() => {
    setQuery("");
    setResults([]);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      loadRecentSearches();
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadRecentSearches]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      searchMovies(trimmed, 1)
        .then((res) => {
          setResults(res.data.items?.slice(0, 6) ?? []);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const executeSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      saveRecentSearch(trimmed);
    }

    const params = new URLSearchParams();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedGenre) params.set("genre", selectedGenre);
      if (selectedCountry) params.set("country", selectedCountry);
      if (selectedYear) params.set("year", selectedYear);
    }

    if (selectedSort && selectedSort !== "latest") {
      params.set("sort", selectedSort);
    }

    const queryString = params.toString();
    router.push(queryString ? `/tim-kiem?${queryString}` : "/tim-kiem");
    handleClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleApplyFilters = () => {
    executeSearch(query);
  };

  const handleResetFilters = () => {
    setSelectedCategory("");
    setSelectedGenre("");
    setSelectedCountry("");
    setSelectedYear("");
    setSelectedSort("latest");
  };

  const activeFiltersCount = [
    Boolean(selectedCategory),
    Boolean(selectedGenre),
    Boolean(selectedCountry),
    Boolean(selectedYear),
    selectedSort !== "latest",
  ].filter(Boolean).length;

  if (!isOpen) return null;

  const hasQuery = Boolean(query.trim());
  const displayResults = hasQuery ? results : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 transition-all z-10">
        {/* Search input form */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 shrink-0"
        >
          <Search className="h-5 w-5 text-zinc-400 dark:text-zinc-500 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm phim, diễn viên, đạo diễn..."
            className="flex-1 bg-transparent text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
          />
          {loading && (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500 mr-2" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="p-1 mr-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Xóa chữ"
              aria-label="Xóa nội dung tìm kiếm"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdvancedFilter((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
              showAdvancedFilter || activeFiltersCount > 0
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
            title="Bộ lọc nâng cao"
            aria-label="Bộ lọc nâng cao"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Bộ lọc</span>
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 rounded-full bg-white text-violet-600 px-1.5 py-0.2 text-[10px] font-extrabold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </form>

        {/* Advanced Filters Expandable Form */}
        {showAdvancedFilter && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/60 p-3.5 sm:p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <SlidersHorizontal className="h-3.5 w-3.5 text-violet-500" />
                <span>Bộ lọc phim chuyên sâu</span>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {/* Category */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Danh mục
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Genre */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Thể loại
                </label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  {GENRES.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Country */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Quốc gia
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Năm phát hành
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Sắp xếp
                </label>
                <select
                  value={selectedSort}
                  onChange={(e) => setSelectedSort(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="latest">Mới cập nhật</option>
                  <option value="name">Tên phim A-Z</option>
                  <option value="year">Năm giảm dần</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow transition-colors flex items-center gap-1"
              >
                <span>Áp dụng bộ lọc</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content (Results / History / Filters / Suggestions) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {hasQuery && displayResults.length > 0 ? (
            <div className="space-y-1">
              {displayResults.map((movie) => (
                <Link
                  key={movie.slug}
                  href={`/phim/${movie.slug}`}
                  onClick={() => {
                    saveRecentSearch(query);
                    handleClose();
                  }}
                  className="flex items-center gap-3.5 rounded-xl p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <img
                    src={movie.thumb_url || movie.poster_url}
                    alt={movie.name}
                    className="h-14 w-10 object-cover rounded-md bg-zinc-800 flex-shrink-0 shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {movie.name}
                    </h4>
                    {movie.original_name && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {movie.original_name}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                      {movie.year && <span>{movie.year}</span>}
                      {movie.quality && <span>• {movie.quality}</span>}
                      {movie.current_episode && (
                        <span>• {movie.current_episode}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}

              {/* View all button */}
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline border-t border-zinc-100 dark:border-zinc-800"
              >
                Xem tất cả kết quả cho &ldquo;{query}&rdquo;
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : hasQuery && !loading ? (
            <div className="py-12 text-center text-zinc-500">
              <Film className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Không tìm thấy bộ phim nào phù hợp</p>
              <button
                type="button"
                onClick={handleSubmit}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 text-xs font-semibold hover:bg-violet-600/20 transition-colors"
              >
                <span>Mở trang tìm kiếm nâng cao</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Lịch sử tìm kiếm gần đây */}
              {recentSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      <History className="h-3.5 w-3.5 text-violet-500" />
                      <span>Tìm kiếm gần đây</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAllRecentSearches}
                      className="text-[11px] font-semibold text-zinc-400 hover:text-rose-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Xóa tất cả</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <span
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          executeSearch(term);
                        }}
                        className="group inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-violet-50 dark:hover:bg-violet-900/30 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 transition-all cursor-pointer ring-1 ring-zinc-200/60 dark:ring-zinc-700/60 shadow-sm"
                      >
                        <History className="h-3 w-3 opacity-50 group-hover:text-violet-500" />
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecentSearch(term, e)}
                          className="p-0.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ml-0.5"
                          title="Xóa"
                          aria-label={`Xóa ${term} khỏi lịch sử`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Quick filter preview button if collapsed */}
              {!showAdvancedFilter && (
                <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-violet-500" />
                    <div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Bộ lọc nâng cao
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Lọc theo danh mục, thể loại, quốc gia, năm phát hành...
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilter(true)}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold shadow hover:bg-violet-500 transition-colors"
                  >
                    Mở bộ lọc
                  </button>
                </div>
              )}

              {/* 3. Gợi ý tìm kiếm phổ biến */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Gợi ý tìm kiếm phổ biến</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setQuery(term);
                        executeSearch(term);
                      }}
                      className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400 transition-colors shadow-sm"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
