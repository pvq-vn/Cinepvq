"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bookmark,
  Play,
  Trash2,
  ArrowLeft,
  LogIn,
  SlidersHorizontal,
  Film,
  Tv,
  Layers,
} from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function WatchlistPage() {
  const { user, watchlist, mounted, removeFromWatchlist, clearWatchlist } =
    useUserStore();

  const [filterType, setFilterType] = useState<"all" | "series" | "single">("all");
  const [sortBy, setSortBy] = useState<"latest" | "name" | "year">("latest");

  // Filter & Sort client-side
  const filteredAndSortedItems = useMemo(() => {
    let result = [...watchlist];

    // Filter by type
    if (filterType === "series") {
      result = result.filter(
        (m) =>
          m.type?.toLowerCase().includes("series") ||
          m.type?.toLowerCase().includes("phim-bo") ||
          (m.current_episode && !m.current_episode.toLowerCase().includes("full"))
      );
    } else if (filterType === "single") {
      result = result.filter(
        (m) =>
          m.type?.toLowerCase().includes("single") ||
          m.type?.toLowerCase().includes("phim-le") ||
          m.type?.toLowerCase().includes("movie") ||
          (m.current_episode && m.current_episode.toLowerCase().includes("full"))
      );
    }

    // Sort
    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    } else if (sortBy === "year") {
      result.sort((a, b) => {
        const yearA = parseInt(String(a.year || "0"), 10);
        const yearB = parseInt(String(b.year || "0"), 10);
        return yearB - yearA;
      });
    } else {
      // "latest"
      result.sort((a, b) => {
        const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return result;
  }, [watchlist, filterType, sortBy]);

  if (!mounted) {
    return (
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-5">
          <div className="space-y-1">
            <Link
              href="/tai-khoan"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-600 transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Tài khoản
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
              <Bookmark className="h-6 w-6 text-violet-600 dark:text-violet-400 fill-current" />
              Danh Sách Xem Sau
            </h1>
            <p className="text-xs text-zinc-500">
              Bạn đã lưu {watchlist.length} bộ phim để thưởng thức khi rảnh rỗi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!user && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-xs text-violet-700 dark:text-violet-300">
                <span>Đang lưu trên máy này.</span>
                <Link
                  href="/dang-nhap?redirect=/xem-sau"
                  className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 font-bold text-white shadow-sm hover:bg-violet-500 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Đăng nhập đồng bộ
                </Link>
              </div>
            )}

            {watchlist.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách xem sau?")
                  ) {
                    clearWatchlist();
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline px-2.5 py-1.5 rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Filter & Sort Controls (only show if watchlist has items) */}
        {watchlist.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200/60 dark:border-zinc-800/60">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterType === "all"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Tất cả ({watchlist.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("series")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterType === "series"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Tv className="h-3.5 w-3.5" />
                Phim bộ
              </button>
              <button
                type="button"
                onClick={() => setFilterType("single")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterType === "single"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                Phim lẻ
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 text-xs border border-zinc-200/60 dark:border-zinc-800/60">
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "latest" | "name" | "year")}
                className="bg-transparent text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer"
              >
                <option value="latest" className="dark:bg-zinc-900">
                  Mới thêm nhất
                </option>
                <option value="name" className="dark:bg-zinc-900">
                  Tên phim A-Z
                </option>
                <option value="year" className="dark:bg-zinc-900">
                  Năm phát hành
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Empty State */}
        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400 mb-2">
              <Bookmark className="h-10 w-10 opacity-70" />
            </div>
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Danh sách xem sau của bạn đang trống
            </h2>
            <p className="text-xs text-zinc-500 max-w-sm">
              Khi lướt tìm phim, hãy nhấn vào biểu tượng dấu trang để lưu lại những bộ phim thú vị mà bạn muốn xem sau này!
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
            >
              <Film className="h-4 w-4" />
              Khám phá phim ngay
            </Link>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-center text-zinc-500">
            <p className="text-sm font-semibold">
              Không có bộ phim nào phù hợp với bộ lọc đã chọn.
            </p>
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline mt-1"
            >
              Xem lại tất cả ({watchlist.length} phim)
            </button>
          </div>
        ) : (
          /* Movie Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredAndSortedItems.map((movie) => (
              <div
                key={movie.slug}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-xl transition-all"
              >
                <Link
                  href={`/phim/${movie.slug}`}
                  className="aspect-[2/3] w-full overflow-hidden relative block"
                >
                  <img
                    src={movie.thumb_url}
                    alt={movie.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl shadow-violet-600/50">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {movie.quality && (
                    <span className="absolute top-2 left-2 rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase shadow">
                      {movie.quality}
                    </span>
                  )}
                  {movie.current_episode && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-zinc-200">
                      {movie.current_episode}
                    </span>
                  )}
                </Link>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeFromWatchlist(movie.slug)}
                  aria-label={`Xóa ${movie.name} khỏi danh sách xem sau`}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-red-500 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="p-3 flex flex-col gap-1">
                  <Link
                    href={`/phim/${movie.slug}`}
                    className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1 hover:text-violet-600 transition-colors"
                  >
                    {movie.name}
                  </Link>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="line-clamp-1">
                      {movie.original_name || (movie.year ? `Năm ${movie.year}` : "")}
                    </span>
                    {movie.year && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {movie.year}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
