"use client";

import { useFetchNewMovies } from "@/hooks/useMovies";

export default function Home() {
  const { data: movies, isLoading, isError } = useFetchNewMovies();

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

  /* ── Movie grid ── */
  return (
    <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
            Phim mới cập nhật
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Danh sách phim được cập nhật mới nhất trên hệ thống
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
              {/* Poster — dùng thẻ <img> tạm để tránh lỗi next/image */}
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
      </div>
    </main>
  );
}
