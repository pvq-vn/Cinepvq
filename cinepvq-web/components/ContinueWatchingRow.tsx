"use client";

import Link from "next/link";
import { Play, Clock, ChevronRight } from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function ContinueWatchingRow() {
  const { history, mounted } = useUserStore();

  if (!mounted || !history || history.length === 0) {
    return null;
  }

  // Filter or show top recent items
  const items = history.slice(0, 10);

  return (
    <section className="my-6 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-500" />
              <span>Tiếp tục xem</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-500">
              Tiếp tục theo dõi các bộ phim bạn đang xem dở
            </p>
          </div>

          <Link
            href="/lich-su"
            className="group flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors"
          >
            <span>Tất cả ({history.length})</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Horizontal Card Row */}
        <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {items.map((item) => {
            const playUrl = `/phim/${item.slug}${
              item.episodeSlug ? `?ep=${item.episodeSlug}` : ""
            }`;

            const percent =
              item.duration && item.duration > 0 && item.currentTime
                ? Math.min(100, Math.round((item.currentTime / item.duration) * 100))
                : null;

            return (
              <div
                key={item.slug}
                className="group relative flex-shrink-0 w-36 sm:w-44 flex flex-col rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800/80 shadow-sm hover:shadow-lg transition-all"
              >
                <Link href={playUrl} className="relative aspect-video w-full overflow-hidden block bg-zinc-800">
                  <img
                    src={item.thumb_url}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/40">
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Episode Badge */}
                  {item.episodeName && (
                    <span className="absolute bottom-2 left-2 rounded bg-black/70 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Tập {item.episodeName}
                    </span>
                  )}

                  {/* Progress Bar overlay at bottom of image */}
                  {percent !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/60">
                      <div
                        className="h-full bg-violet-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </Link>

                <div className="p-2.5 flex flex-col gap-0.5">
                  <Link
                    href={playUrl}
                    className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1 hover:text-violet-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>
                      {percent !== null
                        ? `Đã xem ${percent}%`
                        : item.episodeName
                        ? `Tập ${item.episodeName}`
                        : "Đã xem"}
                    </span>
                    <Link
                      href={playUrl}
                      className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Tiếp tục
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
