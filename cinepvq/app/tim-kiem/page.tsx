"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSearchMovies } from "@/hooks/useMovies";
import MovieCard from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/Skeleton";
import { Search, Film, AlertCircle, RefreshCw, X } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const keyword = searchParams.get("keyword") ?? "";

  const [inputVal, setInputVal] = useState(keyword);

  // Reset input when URL search params change during render without an effect
  const [prevKeyword, setPrevKeyword] = useState(keyword);
  if (prevKeyword !== keyword) {
    setPrevKeyword(keyword);
    setInputVal(keyword);
  }

  const { data: movies, isLoading, isError, refetch } = useSearchMovies(keyword);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    router.push(`/tim-kiem?keyword=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="space-y-8">
      {/* Search Input Hero Box */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-600/10 via-indigo-600/10 to-purple-600/10 p-6 sm:p-10 border border-violet-500/20">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
          Tìm Kiếm Phim
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-xl">
          Tìm kiếm bất kỳ bộ phim điện ảnh, phim bộ, anime hoặc diễn viên nào bạn yêu thích.
        </p>

        <form onSubmit={handleSearch} className="relative max-w-2xl">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Nhập tên phim, tên gốc, đạo diễn..."
            className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-4 pl-12 pr-28 text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 shadow-xl focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none transition-all"
          />
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
          {inputVal && (
            <button
              type="button"
              onClick={() => setInputVal("")}
              className="absolute right-24 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* ── State: No query yet ── */}
      {!keyword && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Film className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <p className="text-sm font-medium text-zinc-500">
            Nhập từ khóa vào ô phía trên để bắt đầu tìm kiếm
          </p>
        </div>
      )}

      {/* ── State: Error ── */}
      {keyword && isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Lỗi tìm kiếm phim
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Không thể kết nối đến máy chủ. Vui lòng thử lại sau giây lát.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {/* ── State: Loading ── */}
      {keyword && isLoading && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-zinc-400">
            Đang tìm kiếm &ldquo;{keyword}&rdquo;...
          </p>
          <MovieGridSkeleton count={10} />
        </div>
      )}

      {/* ── State: Empty ── */}
      {keyword && !isLoading && !isError && movies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
            <Search className="h-8 w-8 opacity-40" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Không tìm thấy kết quả phù hợp
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            Không có bộ phim nào khớp với từ khóa &ldquo;{keyword}&rdquo;. Hãy thử kiểm tra lại chính tả hoặc tìm bằng từ khóa ngắn hơn.
          </p>
        </div>
      )}

      {/* ── State: Results Found ── */}
      {keyword && !isLoading && !isError && movies.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Kết quả cho: &ldquo;{keyword}&rdquo;
            </h2>
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
              {movies.length} bộ phim
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.slug} movie={movie} />
            ))}
          </div>
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
          <SearchContent />
        </Suspense>
      </div>
    </main>
  );
}
