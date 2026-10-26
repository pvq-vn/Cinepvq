"use client";

import { useState, useMemo } from "react";
import { useFetchMoviesFiltered } from "@/hooks/useMovies";
import HeroCarousel from "@/components/HeroCarousel";
import MovieRow from "@/components/MovieRow";
import MovieCard from "@/components/MovieCard";
import Pagination from "@/components/Pagination";
import { MovieGridSkeleton, HeroSkeleton } from "@/components/Skeleton";
import { GENRES, COUNTRIES, GENRE_MAP, COUNTRY_MAP } from "@/lib/taxonomy";
import {
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Flame,
  Globe2,
  Layers,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export interface CategoryRowConfig {
  id: string;
  title: string;
  subtitle: string;
  genre?: string;
  country?: string;
  year?: number;
  variant?: "default" | "ranking";
}

interface CategoryHubPageProps {
  categorySlug: "phim-bo" | "phim-le" | "hoat-hinh" | "tv-shows";
  title: string;
  description: string;
  badge: string;
  quickCountries?: { name: string; slug: string }[];
  quickGenres?: { name: string; slug: string }[];
  sections: CategoryRowConfig[];
}

function ThematicRowSection({
  categorySlug,
  config,
}: {
  categorySlug: string;
  config: CategoryRowConfig;
}) {
  const { data: movies, isLoading } = useFetchMoviesFiltered({
    category: categorySlug,
    genre: config.genre,
    country: config.country,
    year: config.year,
    page: 1,
    limit: 16,
  });

  if (isLoading && movies.length === 0) return null;
  if (!movies || movies.length === 0) return null;

  const params = new URLSearchParams({ category: categorySlug });
  if (config.genre) params.set("genre", config.genre);
  if (config.country) params.set("country", config.country);
  if (config.year) params.set("year", String(config.year));

  return (
    <div className="cv-auto">
      <MovieRow
        title={config.title}
        subtitle={config.subtitle}
        movies={movies.slice(0, 14)}
        variant={config.variant || "default"}
        seeAllHref={`/tim-kiem?${params.toString()}`}
      />
    </div>
  );
}

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export default function CategoryHubPage({
  categorySlug,
  title,
  description,
  badge,
  quickCountries = [
    { name: "Hàn Quốc", slug: "han-quoc" },
    { name: "Trung Quốc", slug: "trung-quoc" },
    { name: "Âu Mỹ", slug: "au-my" },
    { name: "Nhật Bản", slug: "nhat-ban" },
    { name: "Việt Nam", slug: "viet-nam" },
    { name: "Thái Lan", slug: "thai-lan" },
  ],
  quickGenres = [
    { name: "Hành Động", slug: "hanh-dong" },
    { name: "Tình Cảm", slug: "tinh-cam" },
    { name: "Cổ Trang", slug: "co-trang" },
    { name: "Viễn Tưởng", slug: "vien-tuong" },
    { name: "Kinh Dị", slug: "kinh-di" },
    { name: "Hài Hước", slug: "hai-huoc" },
    { name: "Hình Sự", slug: "hinh-su" },
    { name: "Bí Ẩn", slug: "bi-an" },
  ],
  sections,
}: CategoryHubPageProps) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [sortBy, setSortBy] = useState<"modified.time" | "year" | "_id">("modified.time");
  const [page, setPage] = useState(1);

  const hasActiveFilter = Boolean(selectedCountry || selectedGenre || selectedYear);

  // Main catalog / Hero feed (page 1 when no filter, or filtered query)
  const {
    data: mainMovies,
    paginate,
    isLoading: mainLoading,
    isError: mainError,
    refetch: refetchMain,
  } = useFetchMoviesFiltered({
    category: categorySlug,
    country: selectedCountry || undefined,
    genre: selectedGenre || undefined,
    year: selectedYear || undefined,
    sortField: sortBy,
    page,
    limit: 24,
  });

  // Top Most Viewed feed for this category (sorted by popular/year 2025-2026)
  const { data: mostViewedMovies } = useFetchMoviesFiltered(
    {
      category: categorySlug,
      year: 2025,
      sortField: "modified.time",
      page: 1,
      limit: 12,
    },
    !hasActiveFilter
  );

  const heroMovies = useMemo(() => mainMovies.slice(0, 6), [mainMovies]);
  const top10RankingMovies = useMemo(() => {
    if (mostViewedMovies.length >= 6) return mostViewedMovies.slice(0, 10);
    return mainMovies.slice(0, 10);
  }, [mostViewedMovies, mainMovies]);

  const handleResetFilters = () => {
    setSelectedCountry("");
    setSelectedGenre("");
    setSelectedYear("");
    setSortBy("modified.time");
    setPage(1);
  };

  return (
    <main className="flex-1 pb-20">
      {/* 1. Hero Spotlight Carousel */}
      {mainLoading && page === 1 && !hasActiveFilter ? (
        <HeroSkeleton />
      ) : heroMovies.length > 0 && page === 1 && !hasActiveFilter ? (
        <HeroCarousel movies={heroMovies} />
      ) : (
        <div className="pt-24" />
      )}

      {/* 2. Category Hub Header & Quick Discovery Filter Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-zinc-100/90 via-white to-zinc-100/80 dark:from-zinc-900/90 dark:via-zinc-900/60 dark:to-zinc-950/90 p-5 sm:p-7 border border-zinc-200/80 dark:border-zinc-800/80 shadow-lg space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-400 mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                {badge}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {title}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
                {description}
              </p>
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="self-start md:self-auto inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-3.5 py-2 text-xs font-bold transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Về giao diện khám phá chủ đề</span>
              </button>
            )}
          </div>

          {/* Quick Country Pills */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0 mr-1">
                <Globe2 className="h-3.5 w-3.5 text-cyan-500" />
                Quốc gia:
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry("");
                  setPage(1);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  !selectedCountry
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                Tất cả
              </button>
              {quickCountries.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(selectedCountry === c.slug ? "" : c.slug);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                    selectedCountry === c.slug
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Quick Genre Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0 mr-1">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                Thể loại:
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedGenre("");
                  setPage(1);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  !selectedGenre
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                Tất cả
              </button>
              {quickGenres.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => {
                    setSelectedGenre(selectedGenre === g.slug ? "" : g.slug);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                    selectedGenre === g.slug
                      ? "bg-amber-500 text-black shadow-sm"
                      : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Full Select Dropdowns (Country, Genre, Year, Sort) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div>
              <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                Chọn Quốc gia khác
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Tất cả quốc gia</option>
                {COUNTRIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                Chọn Thể loại khác
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => {
                  setSelectedGenre(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Tất cả thể loại</option>
                {GENRES.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                Năm phát hành
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Tất cả các năm</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                Sắp xếp theo
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as "modified.time" | "year" | "_id");
                  setPage(1);
                }}
                className="w-full rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="modified.time">Mới cập nhật</option>
                <option value="year">Năm phát hành mới nhất</option>
                <option value="_id">Phổ biến / Xem nhiều</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Multi-Section Thematic Rows (Shown when on Page 1 & No Active Filters) */}
      {!hasActiveFilter && page === 1 && (
        <div className="mx-auto max-w-7xl space-y-4 mt-6">
          {/* Top 10 Most Viewed in Category */}
          {top10RankingMovies.length > 0 && (
            <MovieRow
              title={`🔥 Top 10 ${title} Xem Nhiều Nhất`}
              subtitle="Những tác phẩm thu hút lượt xem cao nhất tuần này"
              movies={top10RankingMovies}
              variant="ranking"
              seeAllHref={`/thinh-hanh`}
            />
          )}

          {/* Curated Country & Genre Rows */}
          {sections.map((sec) => (
            <ThematicRowSection
              key={sec.id}
              categorySlug={categorySlug}
              config={sec}
            />
          ))}
        </div>
      )}

      {/* 4. Full Filterable & Paginated Catalog Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/70 dark:border-zinc-800/70 pb-4">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-violet-500" />
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              {hasActiveFilter
                ? `Kết Quả Lọc ${title} ${
                    selectedCountry ? `• ${COUNTRY_MAP[selectedCountry] || selectedCountry}` : ""
                  } ${selectedGenre ? `• ${GENRE_MAP[selectedGenre] || selectedGenre}` : ""} ${
                    selectedYear ? `• Năm ${selectedYear}` : ""
                  }`
                : `Kho ${title} Toàn Bộ (Mới Cập Nhật)`}
            </h2>
          </div>

          {paginate && (
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Trang {page} / {paginate.total_page || 1} ({paginate.total_items?.toLocaleString("vi-VN") || 0} phim)
            </span>
          )}
        </div>

        {mainError && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Không thể tải danh sách phim lúc này.
            </p>
            <button
              onClick={() => refetchMain()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </button>
          </div>
        )}

        {mainLoading && <MovieGridSkeleton count={12} />}

        {!mainLoading && !mainError && mainMovies.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-500">
              Không tìm thấy bộ phim nào khớp với bộ lọc hiện tại.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 px-4 py-2 text-xs font-bold"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        {!mainLoading && !mainError && mainMovies.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {mainMovies.map((movie) => (
                <MovieCard key={movie.slug} movie={movie} />
              ))}
            </div>

            <Pagination
              currentPage={page}
              totalPage={paginate?.total_page ?? 1}
              onPageChange={(newPage) => {
                setPage(newPage);
                window.scrollTo({ top: 380, behavior: "smooth" });
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
