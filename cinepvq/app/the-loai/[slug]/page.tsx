"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useFetchMoviesByCategory } from "@/hooks/useMovies";
import { ChevronLeft, ChevronRight } from "lucide-react";

const genreNames: Record<string, string> = {
  "hanh-dong": "Hành Động",
  "tinh-cam": "Tình Cảm",
  "hai-huoc": "Hài Hước",
  "kinh-di": "Kinh Dị",
  "tam-ly": "Tâm Lý",
  "vo-thuat": "Võ Thuật",
  "co-trang": "Cổ Trang",
  "hinh-su": "Hình Sự",
  "khoa-hoc-vien-tuong": "Khoa Học Viễn Tưởng",
};

export default function GenreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError } = useFetchMoviesByCategory(slug, page);

  const genreLabel = genreNames[slug] ?? slug;

  /* ── Error ── */
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-lg font-semibold text-red-600 dark:text-red-400">
          Lỗi kết nối API
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Vui lòng kiểm tra kết nối mạng và thử lại.
        </p>
      </div>
    );
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 animate-pulse">
          Đang tải phim...
        </p>
      </div>
    );
  }

  /* ── Pagination helpers ── */
  const currentPage = paginate?.current_page ?? 1;
  const totalPage = paginate?.total_page ?? 1;
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPage;

  const goToPage = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── Page content ── */
  return (
    <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
            Phim {genreLabel}
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Danh sách phim thể loại {genreLabel} được cập nhật mới nhất
          </p>
        </div>

        {/* Empty state */}
        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25c0 .621.504 1.125 1.125 1.125M18 12h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125M18 12c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M19.125 15.75h-1.5A1.125 1.125 0 0 1 18 14.625M19.125 15.75c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
              </svg>
            </div>
            <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300">
              Chưa có phim nào trong thể loại này
            </p>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {movies.map((movie) => (
                <a
                  key={movie.slug}
                  href={`/phim/${movie.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 transition-all duration-300 hover:ring-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10"
                >
                  {/* Poster */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden">
                    <img
                      src={movie.thumb_url}
                      alt={movie.name}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {movie.quality && (
                      <span className="absolute top-2 left-2 rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                        {movie.quality}
                      </span>
                    )}
                    {movie.current_episode && (
                      <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                        {movie.current_episode}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 p-3">
                    <h2 className="text-sm font-semibold leading-tight line-clamp-2 text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors duration-200">
                      {movie.name}
                    </h2>
                    {movie.original_name && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 line-clamp-1">
                        {movie.original_name}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>

            {/* ── Pagination ── */}
            {paginate && totalPage > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                {/* Previous */}
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={isFirstPage}
                  className={`
                    inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950
                    ${
                      isFirstPage
                        ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300 active:scale-95"
                    }
                  `}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trang trước
                </button>

                {/* Page indicator */}
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 tabular-nums">
                  Trang{" "}
                  <span className="font-bold text-violet-600 dark:text-violet-400">
                    {currentPage}
                  </span>{" "}
                  /{" "}
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {totalPage}
                  </span>
                </span>

                {/* Next */}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={isLastPage}
                  className={`
                    inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950
                    ${
                      isLastPage
                        ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300 active:scale-95"
                    }
                  `}
                >
                  Trang sau
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
