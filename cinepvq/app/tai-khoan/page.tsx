"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  Heart,
  History,
  Settings,
  LogOut,
  Film,
  Play,
  Trash2,
} from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function AccountPage() {
  const { user, favorites, history, mounted, logout, removeHistory, clearHistory } =
    useUserStore();
  const [activeTab, setActiveTab] = useState<"favorites" | "history">("favorites");

  if (!mounted) return null;

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* User Card */}
        <div className="rounded-3xl bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-purple-600/10 p-6 sm:p-8 border border-violet-500/20 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/30">
              <User className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {user ? user.username : "Khách xem phim"}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {user ? user.email : "Đăng nhập để lưu và đồng bộ dữ liệu xem phim"}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-4 pt-1 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  {favorites.length} phim yêu thích
                </span>
                <span className="flex items-center gap-1">
                  <History className="h-3.5 w-3.5 text-amber-500" />
                  {history.length} phim đã xem
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Đăng xuất
              </button>
            ) : (
              <Link
                href="/dang-nhap"
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
              >
                Đăng nhập ngay
              </Link>
            )}
            <Link
              href="/cai-dat"
              className="flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Cài đặt
            </Link>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-3 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-3">
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === "favorites"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Heart className="h-4 w-4 fill-current" />
            Phim yêu thích ({favorites.length})
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === "history"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử xem phim ({history.length})
          </button>
        </div>

        {/* Tab Content: Favorites */}
        {activeTab === "favorites" && (
          <div className="space-y-4">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Heart className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  Chưa có phim yêu thích nào
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Khi xem phim, bạn có thể nhấn vào biểu tượng trái tim để lưu lại vào danh sách yêu thích của mình.
                </p>
                <Link
                  href="/"
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
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
        )}

        {/* Tab Content: History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {history.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={clearHistory}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa toàn bộ lịch sử
                </button>
              </div>
            )}

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <History className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  Lịch sử xem phim trống
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Các bộ phim bạn đã bắt đầu xem sẽ tự động được lưu lại tại đây để bạn có thể tiếp tục xem bất cứ lúc nào.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.slug}
                    className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <Link
                      href={`/phim/${item.slug}`}
                      className="flex items-center gap-3.5 min-w-0 flex-1"
                    >
                      <img
                        src={item.thumb_url}
                        alt={item.name}
                        className="h-16 w-12 object-cover rounded-xl bg-zinc-800 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate hover:text-violet-600">
                          {item.name}
                        </h4>
                        {item.original_name && (
                          <p className="text-xs text-zinc-500 truncate">
                            {item.original_name}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                          {item.episodeName && (
                            <span className="font-semibold text-violet-600 dark:text-violet-400">
                              Đang xem: Tập {item.episodeName}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/phim/${item.slug}`}
                        className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Xem tiếp
                      </Link>
                      <button
                        onClick={() => removeHistory(item.slug)}
                        aria-label="Xóa khỏi lịch sử"
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
        )}
      </div>
    </main>
  );
}
