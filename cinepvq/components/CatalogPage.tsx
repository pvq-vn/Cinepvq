"use client";

import { useState } from "react";
import { Film, AlertCircle, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { Movie, Paginate } from "@/types/movie";
import MovieCard from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";

interface CatalogPageProps {
  title: string;
  description?: string;
  movies: Movie[];
  paginate: Paginate | null;
  isLoading: boolean;
  isError: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onRetry?: () => void;
  badge?: string;
}

export default function CatalogPage({
  title,
  description,
  movies,
  paginate,
  isLoading,
  isError,
  currentPage,
  onPageChange,
  onRetry,
  badge,
}: CatalogPageProps) {
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("latest");

  // Client-side filtering & sorting on the current page's items
  let displayMovies = [...movies];

  if (filterQuality !== "all") {
    displayMovies = displayMovies.filter(
      (m) => m.quality?.toLowerCase() === filterQuality.toLowerCase()
    );
  }

  if (sortBy === "name") {
    displayMovies.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } else if (sortBy === "year") {
    displayMovies.sort((a, b) => {
      const yearA = parseInt(String(a.year || "0"), 10);
      const yearB = parseInt(String(b.year || "0"), 10);
      return yearB - yearA;
    });
  }

  const totalPage = paginate?.total_page ?? 1;
  const totalItems = paginate?.total_items;

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div>
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-600/10 px-2.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400 mb-2">
                {badge}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
                {description}
              </p>
            )}
            {typeof totalItems === "number" && (
              <p className="mt-1 text-xs text-zinc-400">
                Tổng cộng <span className="font-semibold text-zinc-600 dark:text-zinc-300">{totalItems.toLocaleString("vi-VN")}</span> bộ phim
              </p>
            )}
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Quality */}
            <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 text-xs ring-1 ring-zinc-200/60 dark:ring-zinc-800/60">
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={filterQuality}
                onChange={(e) => setFilterQuality(e.target.value)}
                className="bg-transparent text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer"
              >
                <option value="all" className="dark:bg-zinc-900">Mọi chất lượng</option>
                <option value="HD" className="dark:bg-zinc-900">HD</option>
                <option value="FHD" className="dark:bg-zinc-900">FHD</option>
              </select>
            </div>

            {/* Sort */}
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 text-xs ring-1 ring-zinc-200/60 dark:ring-zinc-800/60">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer"
              >
                <option value="latest" className="dark:bg-zinc-900">Cập nhật mới nhất</option>
                <option value="name" className="dark:bg-zinc-900">Tên phim A-Z</option>
                <option value="year" className="dark:bg-zinc-900">Năm phát hành</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Error state ── */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Lỗi tải danh sách phim
              </h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                Không thể kết nối đến máy chủ phim lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.
              </p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* ── Loading state ── */}
        {isLoading && !isError && <MovieGridSkeleton count={10} />}

        {/* ── Empty state ── */}
        {!isLoading && !isError && displayMovies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-400">
              <Film className="h-10 w-10 opacity-40" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Chưa có phim nào phù hợp
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Hiện tại danh mục này đang được cập nhật thêm phim mới.
              </p>
            </div>
          </div>
        )}

        {/* ── Movie Grid ── */}
        {!isLoading && !isError && displayMovies.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {displayMovies.map((movie) => (
                <MovieCard key={movie.slug} movie={movie} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPage={totalPage}
              onPageChange={(page) => {
                onPageChange(page);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
