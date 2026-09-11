"use client";

import Link from "next/link";
import { Heart, Film, ArrowLeft, Trash2, LogIn } from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function FavoritesPage() {
  const { user, favorites, mounted, removeFavorite, clearFavorites } = useUserStore();

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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500 fill-current" />
              Danh Sách Phim Yêu Thích
            </h1>
            <p className="text-xs text-zinc-500">
              Bạn đang lưu trữ {favorites.length} bộ phim trong danh sách theo dõi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!user && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-xs text-violet-700 dark:text-violet-300">
                <span>Đang lưu trên máy này. Đăng nhập để đồng bộ đám mây:</span>
                <Link
                  href="/dang-nhap?redirect=/yeu-thich"
                  className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 font-bold text-white shadow-sm hover:bg-violet-500 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Đăng nhập
                </Link>
              </div>
            )}

            {favorites.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách phim yêu thích?")) {
                    clearFavorites();
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

        {/* Empty State */}
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <Heart className="h-14 w-14 text-zinc-300 dark:text-zinc-700" />
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Chưa có phim yêu thích nào
            </h2>
            <p className="text-xs text-zinc-500 max-w-sm">
              Hãy dạo một vòng khám phá kho phim và nhấn vào biểu tượng trái tim để lưu lại những bộ phim bạn yêu thích nhé!
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
            >
              <Film className="h-4 w-4" />
              Khám phá phim ngay
            </Link>
          </div>
        ) : (
          /* Movie Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {favorites.map((movie) => (
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFavorite(movie.slug);
                  }}
                  aria-label={`Xóa ${movie.name} khỏi yêu thích`}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-rose-500 hover:bg-black/80 transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 shadow-md cursor-pointer"
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
                  {movie.original_name && (
                    <p className="text-[11px] text-zinc-500 line-clamp-1">
                      {movie.original_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
