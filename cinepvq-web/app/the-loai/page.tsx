"use client";

import Link from "next/link";
import { GENRES } from "@/lib/taxonomy";
import { Sparkles, Compass } from "lucide-react";

export default function GenresPage() {
  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-400 mb-3">
            <Compass className="h-3.5 w-3.5" />
            Khám phá điện ảnh
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Tất Cả Thể Loại Phim
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Lựa chọn thể loại yêu thích để tìm kiếm những bộ phim phù hợp nhất với tâm trạng và gu thưởng thức của bạn.
          </p>
        </div>

        {/* Genre cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {GENRES.map((genre) => (
            <Link
              key={genre.slug}
              href={`/the-loai/${genre.slug}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 sm:p-7 min-h-[140px] sm:min-h-[160px] transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] ring-1 ring-white/10"
            >
              {/* Dynamic Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${genre.gradient || "from-violet-600 to-indigo-700"} opacity-90 group-hover:opacity-100 transition-opacity duration-300`}
              />

              {/* Radial overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_60%)]" />

              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

              {/* Top icon indicator */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20 text-white backdrop-blur-sm">
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>

              {/* Bottom text */}
              <div className="relative z-10 space-y-1 mt-4">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide drop-shadow-md">
                  {genre.name}
                </h3>
                {genre.description && (
                  <p className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
                    {genre.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
