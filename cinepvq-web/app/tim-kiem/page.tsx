"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMovieDiscovery } from "@/hooks/useMovies";
import MovieCard from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";
import {
  Search,
  Film,
  AlertCircle,
  RefreshCw,
  X,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { GENRES, COUNTRIES, GENRE_MAP, COUNTRY_MAP } from "@/lib/taxonomy";
import type { Movie } from "@/types/movie";

const CATEGORIES = [
  { name: "Phim Bộ", slug: "phim-bo" },
  { name: "Phim Lẻ", slug: "phim-le" },
  { name: "Hoạt Hình", slug: "hoat-hinh" },
  { name: "TV Show", slug: "tv-shows" },
  { name: "Đang Chiếu", slug: "dang-chieu" },
];

const CATEGORY_MAP: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.slug]: c.name }),
  {}
);

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2015, 2010];

const POPULAR_SUGGESTIONS = [
  "Dữ Phượng Hành",
  "Tây Du Ký",
  "One Piece",
  "Naruto",
  "Conan",
  "Harry Potter",
  "Đấu Phá Thương Khung",
  "Đào, Phở và Piano",
];

function SearchDiscoveryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── Extract URL state as Single Source of Truth ─────────────────────────
  const queryKeyword =
    searchParams.get("q") ?? searchParams.get("keyword") ?? "";
  const rawCategory = searchParams.get("category") ?? "";
  const rawGenre = searchParams.get("genre") ?? "";
  const rawCountry = searchParams.get("country") ?? "";
  const rawYear = searchParams.get("year") ?? "";
  const rawSort = searchParams.get("sort") ?? "latest";
  const queryPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // ─── Mutual Exclusivity: Only ONE primary filter can be active ────────────
  // NguonC API endpoints are strictly separate (films/search, films/danh-sach,
  // films/the-loai, films/quoc-gia, films/nam-phat-hanh). Combining them is not
  // supported by backend and causes silent ignore bugs.
  // Priority: keyword > category > genre > country > year
  const activeCategory = !queryKeyword ? rawCategory : "";
  const activeGenre = !queryKeyword && !activeCategory ? rawGenre : "";
  const activeCountry =
    !queryKeyword && !activeCategory && !activeGenre ? rawCountry : "";
  const activeYear =
    !queryKeyword && !activeCategory && !activeGenre && !activeCountry
      ? rawYear
      : "";
  const activeSort =
    rawSort === "name" || rawSort === "year" ? rawSort : "latest";

  // ─── Local Search Input State ─────────────────────────────────────────────
  const [inputVal, setInputVal] = useState(queryKeyword);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // Sync input value if URL changes externally (back/forward navigation)
  const [prevUrlKeyword, setPrevUrlKeyword] = useState(queryKeyword);
  if (queryKeyword !== prevUrlKeyword) {
    setPrevUrlKeyword(queryKeyword);
    setInputVal(queryKeyword);
  }

  // ─── URL Sanitization Effect ─────────────────────────────────────────────
  // Automatically purges invalid states from URL:
  // - Conflicting filters (e.g., genre=X&country=Y or q=X&genre=Y)
  // - sort=latest (default sort should not pollute URL)
  // - legacy keyword parameter (normalized to q)
  // - quality parameter (quality filter is removed)
  useEffect(() => {
    const hasLegacyKeyword = searchParams.has("keyword");
    const hasQuality = searchParams.has("quality");
    const hasDefaultSort = searchParams.get("sort") === "latest";

    // Count how many mutually exclusive filter criteria are present in URL
    const criteriaCount = [
      Boolean(queryKeyword),
      Boolean(rawCategory),
      Boolean(rawGenre),
      Boolean(rawCountry),
      Boolean(rawYear),
    ].filter(Boolean).length;

    if (
      hasLegacyKeyword ||
      hasQuality ||
      hasDefaultSort ||
      criteriaCount > 1
    ) {
      const params = new URLSearchParams();
      if (queryKeyword) {
        params.set("q", queryKeyword);
      } else if (activeCategory) {
        params.set("category", activeCategory);
      } else if (activeGenre) {
        params.set("genre", activeGenre);
      } else if (activeCountry) {
        params.set("country", activeCountry);
      } else if (activeYear) {
        params.set("year", activeYear);
      }

      if (activeSort !== "latest") {
        params.set("sort", activeSort);
      }
      if (queryPage > 1) {
        params.set("page", String(queryPage));
      }

      const queryString = params.toString();
      const cleanUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(cleanUrl, { scroll: false });
    }
  }, [
    searchParams,
    queryKeyword,
    rawCategory,
    rawGenre,
    rawCountry,
    rawYear,
    activeCategory,
    activeGenre,
    activeCountry,
    activeYear,
    activeSort,
    queryPage,
    pathname,
    router,
  ]);

  // ─── URL Update Helper ───────────────────────────────────────────────────
  const updateUrlParams = useCallback(
    (updates: Record<string, string | number | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());

      // Always remove legacy keyword and obsolete quality filter
      params.delete("keyword");
      params.delete("quality");

      for (const [key, value] of Object.entries(updates)) {
        if (
          value === null ||
          value === "" ||
          value === "all" ||
          (key === "sort" && value === "latest") ||
          key === "quality"
        ) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      // If user sets a search keyword, clear other primary filters
      if ("q" in updates && updates.q) {
        params.delete("category");
        params.delete("genre");
        params.delete("country");
        params.delete("year");
      }

      if (resetPage) {
        params.delete("page");
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(targetUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // ─── Debounced Search Input ──────────────────────────────────────────────
  useEffect(() => {
    const trimmed = inputVal.trim();
    if (trimmed === queryKeyword) return;

    const timer = setTimeout(() => {
      updateUrlParams(
        {
          q: trimmed || null,
          category: null,
          genre: null,
          country: null,
          year: null,
        },
        true
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [inputVal, queryKeyword, updateUrlParams]);

  // Immediate submit on Enter or click
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    updateUrlParams(
      {
        q: trimmed || null,
        category: null,
        genre: null,
        country: null,
        year: null,
      },
      true
    );
  };

  const handleClearInput = () => {
    setInputVal("");
    updateUrlParams({ q: null }, true);
  };

  const handleResetAllFilters = () => {
    setInputVal("");
    const targetUrl = pathname;
    router.push(targetUrl, { scroll: false });
  };

  // ─── Query Data via Hook ─────────────────────────────────────────────────
  const {
    data: rawMovies,
    paginate,
    isLoading,
    isError,
    refetch,
  } = useMovieDiscovery({
    keyword: queryKeyword,
    category: activeCategory,
    genre: activeGenre,
    country: activeCountry,
    year: activeYear,
    page: queryPage,
  });

  // ─── Client-side Sorting (Applied on current API page) ────────────────────
  const displayMovies = useMemo(() => {
    const list: Movie[] = [...rawMovies];

    // Sort within current page
    if (activeSort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    } else if (activeSort === "year") {
      list.sort((a, b) => {
        const yearA = parseInt(String(a.year || "0"), 10);
        const yearB = parseInt(String(b.year || "0"), 10);
        return yearB - yearA;
      });
    }

    return list;
  }, [rawMovies, activeSort]);

  // ─── Count Active Filters ────────────────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (activeCategory) count++;
    if (activeGenre) count++;
    if (activeCountry) count++;
    if (activeYear) count++;
    if (activeSort !== "latest") count++;
    return count;
  }, [activeCategory, activeGenre, activeCountry, activeYear, activeSort]);

  // Dynamic Page Title & Description
  const pageTitle = useMemo(() => {
    if (queryKeyword) return `Tìm kiếm: "${queryKeyword}"`;
    if (activeCategory) return `Danh mục: ${CATEGORY_MAP[activeCategory] || activeCategory}`;
    if (activeGenre) return `Thể loại: ${GENRE_MAP[activeGenre] || activeGenre}`;
    if (activeCountry) return `Quốc gia: ${COUNTRY_MAP[activeCountry] || activeCountry}`;
    if (activeYear) return `Phim năm ${activeYear}`;
    return "Khám Phá Điện Ảnh";
  }, [queryKeyword, activeCategory, activeGenre, activeCountry, activeYear]);

  const totalPage = paginate?.total_page ?? 1;
  const totalItems = paginate?.total_items;

  return (
    <div className="space-y-8">
      {/* ── Search Hero Box ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/15 via-indigo-600/10 to-purple-600/15 p-6 sm:p-10 border border-violet-500/20 shadow-xl backdrop-blur-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 dark:bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-300 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Hệ thống Tìm kiếm & Khám phá phim
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent mb-2">
            Tìm Kiếm & Khám Phá
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            Dễ dàng tra cứu hơn 20.000+ bộ phim điện ảnh, phim bộ, anime, và gameshow vietsub chất lượng cao với bộ lọc chuyên sâu.
          </p>

          {/* Search Input Form */}
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Nhập tên phim tiếng Việt, tên gốc (Avatar, Conan, Naruto...)..."
              className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 py-4 pl-12 pr-28 text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 shadow-xl focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none transition-all"
            />
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            {inputVal && (
              <button
                type="button"
                onClick={handleClearInput}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-24 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
            >
              Tìm
            </button>
          </form>

          {/* Popular Suggestions */}
          {!queryKeyword && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Gợi ý:</span>
              {POPULAR_SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setInputVal(term);
                    updateUrlParams(
                      {
                        q: term,
                        category: null,
                        genre: null,
                        country: null,
                        year: null,
                      },
                      true
                    );
                  }}
                  className="rounded-lg bg-white/70 dark:bg-zinc-800/70 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Multifaceted Filter Bar ── */}
      <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Bộ lọc nâng cao
            </span>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Đặt lại</span>
              </button>
            )}

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setFiltersOpenMobile((prev) => !prev)}
              className="sm:hidden flex items-center gap-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              <span>{filtersOpenMobile ? "Thu gọn" : "Mở rộng"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  filtersOpenMobile ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Filters Controls Grid (5 controls: Category, Genre, Country, Year, Sort) */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 ${
            filtersOpenMobile ? "block" : "hidden sm:grid"
          }`}
        >
          {/* 1. Category */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-500">Danh mục</label>
            <select
              value={activeCategory}
              onChange={(e) => {
                const val = e.target.value;
                updateUrlParams({
                  category: val || null,
                  genre: null,
                  country: null,
                  year: null,
                  q: null,
                });
                if (val) setInputVal("");
              }}
              className="rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value="">Tất cả danh mục</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Genre */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-500">Thể loại</label>
            <select
              value={activeGenre}
              onChange={(e) => {
                const val = e.target.value;
                updateUrlParams({
                  genre: val || null,
                  category: null,
                  country: null,
                  year: null,
                  q: null,
                });
                if (val) setInputVal("");
              }}
              className="rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value="">Tất cả thể loại</option>
              {GENRES.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Country */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-500">Quốc gia</label>
            <select
              value={activeCountry}
              onChange={(e) => {
                const val = e.target.value;
                updateUrlParams({
                  country: val || null,
                  category: null,
                  genre: null,
                  year: null,
                  q: null,
                });
                if (val) setInputVal("");
              }}
              className="rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value="">Tất cả quốc gia</option>
              {COUNTRIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Year */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-500">Năm phát hành</label>
            <select
              value={activeYear}
              onChange={(e) => {
                const val = e.target.value;
                updateUrlParams({
                  year: val || null,
                  category: null,
                  genre: null,
                  country: null,
                  q: null,
                });
                if (val) setInputVal("");
              }}
              className="rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value="">Tất cả các năm</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Sorting (Applies to current page) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-zinc-500 flex items-center justify-between">
              <span>Sắp xếp</span>
              <span className="text-[10px] text-zinc-400 font-normal">(trong trang)</span>
            </label>
            <select
              value={activeSort}
              onChange={(e) =>
                updateUrlParams(
                  { sort: e.target.value === "latest" ? null : e.target.value },
                  false
                )
              }
              className="rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value="latest">Mới cập nhật</option>
              <option value="name">Tên phim A-Z</option>
              <option value="year">Năm giảm dần</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <span className="text-[11px] font-medium text-zinc-500 mr-1">Đang lọc:</span>

            {activeCategory && (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-600/10 px-2 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
                Danh mục: {CATEGORY_MAP[activeCategory] || activeCategory}
                <button
                  type="button"
                  aria-label="Xóa bộ lọc danh mục"
                  onClick={() => updateUrlParams({ category: null })}
                  className="hover:text-violet-800 dark:hover:text-violet-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {activeGenre && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600/10 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Thể loại: {GENRE_MAP[activeGenre] || activeGenre}
                <button
                  type="button"
                  aria-label="Xóa bộ lọc thể loại"
                  onClick={() => updateUrlParams({ genre: null })}
                  className="hover:text-indigo-800 dark:hover:text-indigo-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {activeCountry && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-600/10 px-2 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                Quốc gia: {COUNTRY_MAP[activeCountry] || activeCountry}
                <button
                  type="button"
                  aria-label="Xóa bộ lọc quốc gia"
                  onClick={() => updateUrlParams({ country: null })}
                  className="hover:text-cyan-800 dark:hover:text-cyan-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {activeYear && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-600/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                Năm: {activeYear}
                <button
                  type="button"
                  aria-label="Xóa bộ lọc năm"
                  onClick={() => updateUrlParams({ year: null })}
                  className="hover:text-amber-800 dark:hover:text-amber-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {activeSort !== "latest" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-600/10 dark:bg-zinc-400/10 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Sắp xếp: {activeSort === "name" ? "Tên A-Z" : "Năm giảm dần"}
                <button
                  type="button"
                  aria-label="Đặt lại sắp xếp mặc định"
                  onClick={() => updateUrlParams({ sort: null }, false)}
                  className="hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Content States ── */}

      {/* 1. Error State */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Lỗi tải dữ liệu phim
            </h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              Không thể kết nối đến máy chủ phim lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-violet-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {/* 2. Loading State */}
      {isLoading && !isError && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-zinc-400 animate-pulse">
            Đang tìm kiếm và xử lý dữ liệu phim...
          </p>
          <MovieGridSkeleton count={10} />
        </div>
      )}

      {/* 3. Empty Results State */}
      {!isLoading && !isError && displayMovies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
            <Film className="h-8 w-8 opacity-40" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Không tìm thấy bộ phim nào phù hợp
          </h3>
          <p className="text-xs text-zinc-500 max-w-md">
            {queryKeyword
              ? `Không có kết quả khớp với từ khóa "${queryKeyword}". Hãy thử tìm bằng từ khóa ngắn hơn, tên tiếng Anh hoặc xóa bớt các bộ lọc đang chọn.`
              : "Không có bộ phim nào khớp với các tiêu chí bộ lọc đã chọn. Hãy thử nới lỏng bộ lọc để khám phá thêm."}
          </p>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetAllFilters}
              className="mt-2 rounded-xl bg-violet-600/10 px-4 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-600/20 transition-colors"
            >
              Xóa toàn bộ bộ lọc
            </button>
          )}
        </div>
      )}

      {/* 4. Results List Grid */}
      {!isLoading && !isError && displayMovies.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {pageTitle}
              </h2>
              {typeof totalItems === "number" && (
                <p className="text-xs text-zinc-500">
                  Tìm thấy{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {totalItems.toLocaleString("vi-VN")}
                  </span>{" "}
                  bộ phim phù hợp
                </p>
              )}
            </div>

            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 self-start sm:self-auto">
              Trang {queryPage} / {totalPage}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {displayMovies.map((movie) => (
              <MovieCard key={movie.slug} movie={movie} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={queryPage}
            totalPage={totalPage}
            onPageChange={(page) => {
              updateUrlParams({ page }, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<MovieGridSkeleton count={10} />}>
          <SearchDiscoveryContent />
        </Suspense>
      </div>
    </main>
  );
}
