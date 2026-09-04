"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSearchMovies } from "@/hooks/useMovies";

function SearchResults() {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const { data: movies, isLoading, isError } = useSearchMovies(keyword);

  /* ── No keyword ── */
  if (!keyword.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">
          Nhập từ khóa để tìm kiếm phim
        </p>
      </div>
    );
  }

  /* ── Error ── */
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-red-600 dark:text-red-400">
          Lỗi tìm kiếm
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
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 animate-pulse">
          Đang tìm kiếm &ldquo;{keyword}&rdquo;...
        </p>
      </div>
    );
  }

  /* ── Empty results ── */
  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300">
          Không tìm thấy bộ phim nào
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Không có kết quả phù hợp với từ khóa &ldquo;{keyword}&rdquo;. Hãy thử từ khóa khác nhé!
        </p>
      </div>
    );
  }

  /* ── Results grid (reusing same card from homepage) ── */
  return (
    <>
      {/* Heading */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
          Kết quả tìm kiếm
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Tìm thấy <span className="font-semibold text-zinc-700 dark:text-zinc-200">{movies.length}</span> kết quả cho &ldquo;{keyword}&rdquo;
        </p>
      </div>

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

              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Quality badge */}
              {movie.quality && (
                <span className="absolute top-2 left-2 rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  {movie.quality}
                </span>
              )}

              {/* Episode badge */}
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
    </>
  );
}

export default function SearchPage() {
  return (
    <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 animate-spin" />
              </div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 animate-pulse">
                Đang tải...
              </p>
            </div>
          }
        >
          <SearchResults />
        </Suspense>
      </div>
    </main>
  );
}
