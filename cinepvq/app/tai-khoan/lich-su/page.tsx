"use client";

import Link from "next/link";
import { History, Play, Trash2, ArrowLeft } from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function WatchHistoryPage() {
  const { history, mounted, removeHistory, clearHistory } = useUserStore();

  if (!mounted) return null;

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-5">
          <div className="space-y-1">
            <Link
              href="/tai-khoan"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-600 mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Tài khoản
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <History className="h-6 w-6 text-amber-500" />
              Lịch Sử Xem Phim
            </h1>
            <p className="text-xs text-zinc-500">
              Các bộ phim bạn đã xem gần đây ({history.length} phim)
            </p>
          </div>

          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              <Trash2 className="h-4 w-4" />
              Xóa tất cả lịch sử
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <History className="h-14 w-14 text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Lịch sử xem phim trống
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Bạn chưa xem bộ phim nào gần đây. Hãy chọn một bộ phim yêu thích để bắt đầu thưởng thức!
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
            >
              Xem phim ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.slug}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
              >
                <Link
                  href={`/phim/${item.slug}`}
                  className="flex items-center gap-4 min-w-0 flex-1"
                >
                  <img
                    src={item.thumb_url}
                    alt={item.name}
                    className="h-20 w-14 object-cover rounded-xl bg-zinc-800 flex-shrink-0 shadow-sm"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate hover:text-violet-600">
                      {item.name}
                    </h3>
                    {item.original_name && (
                      <p className="text-xs text-zinc-500 truncate">
                        {item.original_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                      {item.episodeName && (
                        <span className="font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                          Tập {item.episodeName}
                        </span>
                      )}
                      <span className="text-zinc-400 text-[11px]">
                        Lưu lúc: {new Date(item.updatedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/phim/${item.slug}`}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Xem tiếp
                  </Link>
                  <button
                    onClick={() => removeHistory(item.slug)}
                    aria-label="Xóa phim khỏi lịch sử"
                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
