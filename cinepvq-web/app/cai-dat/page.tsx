"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useUserStore } from "@/hooks/useUserStore";
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Play,
  Volume2,
  Tv,
  Cloud,
  LogIn,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, settings, updateSettings, mounted } = useUserStore();

  if (!mounted) return null;

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="border-b border-zinc-200/60 dark:border-zinc-800/60 pb-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <SettingsIcon className="h-7 w-7 text-violet-500" />
            Cài Đặt Hệ Thống
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500">
            Tùy chỉnh giao diện, chế độ phát video và trải nghiệm xem phim của bạn
          </p>
        </div>

        {/* 1. Theme Configuration */}
        <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Giao Diện Ứng Dụng (Theme)
            </h2>
            <p className="text-xs text-zinc-500">
              Chọn chế độ hiển thị phù hợp với thị giác và môi trường ánh sáng của bạn.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {/* Dark */}
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center gap-2.5 ${
                theme === "dark"
                  ? "bg-violet-600/10 border-violet-600 text-violet-600 dark:text-violet-400 font-bold ring-2 ring-violet-500/20 shadow-md"
                  : "bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
              }`}
            >
              <Moon className="h-6 w-6" />
              <span className="text-xs">Chế độ tối (Dark)</span>
            </button>

            {/* Light */}
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center gap-2.5 ${
                theme === "light"
                  ? "bg-violet-600/10 border-violet-600 text-violet-600 dark:text-violet-400 font-bold ring-2 ring-violet-500/20 shadow-md"
                  : "bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
              }`}
            >
              <Sun className="h-6 w-6" />
              <span className="text-xs">Chế độ sáng (Light)</span>
            </button>

            {/* System */}
            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center gap-2.5 ${
                theme === "system"
                  ? "bg-violet-600/10 border-violet-600 text-violet-600 dark:text-violet-400 font-bold ring-2 ring-violet-500/20 shadow-md"
                  : "bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
              }`}
            >
              <Monitor className="h-6 w-6" />
              <span className="text-xs">Theo hệ thống (System)</span>
            </button>
          </div>
        </section>

        {/* 2. Video Playback Settings */}
        <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Trải Nghiệm Phát Video
            </h2>
            <p className="text-xs text-zinc-500">
              Thiết lập hành vi phát video tự động và chất lượng truyền phát mặc định.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
            {/* Preferred Quality */}
            <div className="pt-4 first:pt-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10 text-violet-600">
                  <Tv className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Chất lượng phát ưu tiên
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Tự động điều chỉnh theo tốc độ đường truyền hoặc chọn cố định.
                  </p>
                </div>
              </div>

              <select
                value={settings.preferredQuality}
                onChange={(e) =>
                  updateSettings({
                    preferredQuality: e.target.value as "auto" | "HD" | "FHD",
                  })
                }
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium outline-none cursor-pointer"
              >
                <option value="auto">Tự động (Khuyên dùng)</option>
                <option value="HD">HD (720p)</option>
                <option value="FHD">Full HD (1080p)</option>
              </select>
            </div>

            {/* Auto Play Next Episode */}
            <div className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Play className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Tự động chuyển tập tiếp theo
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Tự động phát tập phim kế tiếp khi tập hiện tại kết thúc.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updateSettings({ autoPlay: !settings.autoPlay })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoPlay ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoPlay ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Sound Effects */}
            <div className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Âm thanh giao diện
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Phát hiệu ứng âm thanh nhẹ khi tương tác với các nút bấm.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSettings({ soundEnabled: !settings.soundEnabled })
                }
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.soundEnabled ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.soundEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* 3. Storage and Sync status */}
        <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 border border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Phiên bản ứng dụng
            </span>
            <span className="font-mono text-zinc-400">Cinépvq v2.0 (Supabase Powered)</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Trạng thái đồng bộ
            </span>
            {user ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <Cloud className="h-4 w-4" />
                Đồng bộ đám mây đã bật ({user.email})
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Lưu trữ cục bộ</span>
                <Link
                  href="/dang-nhap?redirect=/cai-dat"
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-violet-500 transition-colors"
                >
                  <LogIn className="h-3 w-3" />
                  Đăng nhập để đồng bộ
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
