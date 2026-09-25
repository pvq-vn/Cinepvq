"use client";

import { X, Smartphone, Monitor, CheckCircle2, QrCode, Download, ShieldCheck } from "lucide-react";

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadAppModal({
  isOpen,
  onClose,
}: DownloadAppModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 z-10 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
              Android Native & PWA
            </span>
            <h3 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Cài đặt ứng dụng Cinépvq
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Xem phim mượt mà hơn với ứng dụng cài đặt trực tiếp trên thiết bị của bạn.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Android Native APK (Primary Official Release) */}
        <div className="rounded-xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-zinc-50 dark:via-zinc-800/60 to-transparent p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Cinepvq cho Android
                  </h4>
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Native ExoPlayer, PiP toàn hệ thống, In-App Mini Player
                </p>
              </div>
            </div>
          </div>

          <a
            href="https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk"
            target="_blank"
            rel="noopener noreferrer"
            download="Cinepvq.apk"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-[0.99] text-white font-semibold text-xs transition-all shadow-md shadow-violet-600/20"
          >
            <Download className="h-4 w-4" />
            <span>Tải APK Trực Tiếp (Cinepvq.apk)</span>
          </a>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Bản phát hành chính thức từ GitHub Releases, hỗ trợ cập nhật tự động.</span>
          </div>
        </div>

        {/* Other Platforms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* iOS / Mobile PWA */}
          <div className="flex flex-col justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  iOS (iPhone / iPad)
                </h4>
                <p className="text-[10px] text-zinc-500">Trình duyệt Safari</p>
              </div>
            </div>
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                <span>Bấm nút Chia sẻ trong Safari</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                <span>Chọn &ldquo;Thêm vào MH chính&rdquo;</span>
              </div>
            </div>
          </div>

          {/* Desktop App */}
          <div className="flex flex-col justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Windows & macOS
                </h4>
                <p className="text-[10px] text-zinc-500">Chrome / Edge / Safari</p>
              </div>
            </div>
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-violet-500 flex-shrink-0" />
                <span>Bấm biểu tượng Cài đặt trên URL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-violet-500 flex-shrink-0" />
                <span>Mở như ứng dụng độc lập</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="p-3 rounded-xl bg-violet-600/5 border border-violet-600/10 flex items-center gap-3">
          <QrCode className="h-7 w-7 text-violet-600 flex-shrink-0" />
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            Ứng dụng ghi nhớ lịch sử xem phim, danh sách yêu thích và tự động tối ưu hóa tốc độ truyền phát.
          </p>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium text-xs transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
