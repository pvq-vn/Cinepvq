"use client";

import Link from "next/link";
import { History, Play, Trash2, ArrowLeft, LogIn, Clock, Film } from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";
import { normalizeEpisodeLabel } from "@/lib/format";

export default function HistoryPage() {
  const { user, history, mounted, removeHistory, clearHistory } = useUserStore();

  if (!mounted) {
    return (
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const mostRecent = history.length > 0 ? history[0] : null;

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
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
              <History className="h-6 w-6 text-amber-500" />
              Lịch Sử Xem Phim
            </h1>
            <p className="text-xs text-zinc-500">
              Ghi nhớ tập phim và tiến độ xem gần đây ({history.length} phim)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!user && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-xs text-violet-700 dark:text-violet-300">
                <span>Đang lưu cục bộ.</span>
                <Link
                  href="/dang-nhap?redirect=/lich-su"
                  className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1 font-bold text-white shadow-sm hover:bg-violet-500 transition-colors"
                >
                  <LogIn className="h-3 w-3" />
                  Đăng nhập
                </Link>
              </div>
            )}

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem phim?")) {
                    clearHistory();
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline px-2 py-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Highlight Shelf: Tiếp tục xem phim gần nhất */}
        {mostRecent && (
          <section className="rounded-3xl bg-gradient-to-r from-violet-600/15 via-indigo-600/15 to-purple-600/15 p-5 sm:p-6 border border-violet-500/20 shadow-md space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Tiếp tục xem ngay
              </span>
              {mostRecent.episodeName && (
                <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] text-white">
                  {normalizeEpisodeLabel(mostRecent.episodeName)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <img
                src={mostRecent.thumb_url}
                alt={mostRecent.name}
                className="h-20 w-14 sm:h-24 sm:w-16 object-cover rounded-2xl bg-zinc-800 shadow-md flex-shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {mostRecent.name}
                </h3>
                {mostRecent.original_name && (
                  <p className="text-xs text-zinc-500 truncate">
                    {mostRecent.original_name}
                  </p>
                )}

                {/* Progress bar if duration available */}
                {mostRecent.duration && mostRecent.duration > 0 && mostRecent.currentTime ? (
                  <div className="w-full max-w-xs space-y-1 pt-1">
                    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className="h-full bg-violet-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((mostRecent.currentTime / mostRecent.duration) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      Đã xem{" "}
                      {Math.min(
                        100,
                        Math.round((mostRecent.currentTime / mostRecent.duration) * 100)
                      )}
                      % ({Math.floor(mostRecent.currentTime / 60)} /{" "}
                      {Math.floor(mostRecent.duration / 60)} phút)
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    Cập nhật lần cuối: {new Date(mostRecent.updatedAt).toLocaleString("vi-VN")}
                  </p>
                )}
              </div>

              <Link
                href={`/phim/${mostRecent.slug}${
                  mostRecent.episodeSlug ? `?ep=${mostRecent.episodeSlug}` : ""
                }`}
                className="flex-shrink-0 flex items-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-500 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 transition-all active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                <span className="hidden sm:inline">Phát tiếp</span>
              </Link>
            </div>
          </section>
        )}

        {/* History List */}
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <History className="h-14 w-14 text-zinc-300 dark:text-zinc-700" />
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Lịch sử xem phim trống
            </h2>
            <p className="text-xs text-zinc-500 max-w-sm">
              Bạn chưa xem bộ phim nào gần đây. Hãy chọn một bộ phim yêu thích để bắt đầu thưởng thức!
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
            >
              <Film className="h-4 w-4" />
              Xem phim ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Tất cả phim đã xem ({history.length})
            </h3>
            {history.map((item) => {
              const playUrl = `/phim/${item.slug}${
                item.episodeSlug ? `?ep=${item.episodeSlug}` : ""
              }`;

              const progressPercent =
                item.duration && item.duration > 0 && item.currentTime
                  ? Math.min(100, Math.round((item.currentTime / item.duration) * 100))
                  : null;

              return (
                <div
                  key={item.slug}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <Link href={playUrl} className="flex items-center gap-4 min-w-0 flex-1">
                    <img
                      src={item.thumb_url}
                      alt={item.name}
                      className="h-20 w-14 object-cover rounded-xl bg-zinc-800 flex-shrink-0 shadow-sm"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate hover:text-violet-600 transition-colors">
                        {item.name}
                      </h4>
                      {item.original_name && (
                        <p className="text-xs text-zinc-500 truncate">
                          {item.original_name}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {item.episodeName && (
                          <span className="font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                            {normalizeEpisodeLabel(item.episodeName)}
                          </span>
                        )}
                        {progressPercent !== null && (
                          <span className="text-[11px] text-zinc-400">
                            Đã xem {progressPercent}%
                          </span>
                        )}
                        <span className="text-zinc-400 text-[11px]">
                          Lưu lúc: {new Date(item.updatedAt).toLocaleDateString("vi-VN")}
                        </span>
                      </div>

                      {progressPercent !== null && (
                        <div className="h-1 w-full max-w-xs rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden mt-1">
                          <div
                            className="h-full bg-violet-600 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-2">
                    <Link
                      href={playUrl}
                      className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Xem tiếp</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeHistory(item.slug)}
                      aria-label="Xóa phim khỏi lịch sử"
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
