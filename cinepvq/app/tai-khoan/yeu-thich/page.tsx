"use client";

import Link from "next/link";
import { Heart, Film, ArrowLeft } from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function FavoritesPage() {
  const { favorites, mounted } = useUserStore();

  if (!mounted) return null;

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60 pb-5">
          <div className="space-y-1">
            <Link
              href="/tai-khoan"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-600 mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Tài khoản
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500 fill-current" />
              Danh Sách Phim Yêu Thích
            </h1>
            <p className="text-xs text-zinc-500">
              Bạn có {favorites.length} bộ phim trong danh sách theo dõi
            </p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <Heart className="h-14 w-14 text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Chưa có phim yêu thích nào
            </h3>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {favorites.map((movie) => (
              <div
                key={movie.slug}
                className="group relative flex flex-col overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-xl transition-all"
              >
                <Link href={`/phim/${movie.slug}`} className="aspect-[2/3] w-full overflow-hidden relative">
                  <img
                    src={movie.thumb_url}
                    alt={movie.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {movie.quality && (
                    <span className="absolute top-2 left-2 rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                      {movie.quality}
                    </span>
                  )}
                </Link>
                <div className="p-3 flex flex-col gap-1">
                  <Link
                    href={`/phim/${movie.slug}`}
                    className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1 hover:text-violet-600"
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
