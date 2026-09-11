"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  Bookmark,
  Heart,
  History,
  Settings,
  LogOut,
  Film,
  Play,
  Trash2,
  Edit3,
  Calendar,
  Mail,
  ShieldCheck,
  Check,
  X,
  Loader2,
  LogIn,
  ArrowRight,
} from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";
import { normalizeEpisodeLabel } from "@/lib/format";

export default function AccountPage() {
  const {
    user,
    favorites,
    watchlist,
    history,
    mounted,
    logout,
    updateProfile,
    removeFavorite,
    clearFavorites,
    removeFromWatchlist,
    clearWatchlist,
    removeHistory,
    clearHistory,
  } = useUserStore();

  const [activeTab, setActiveTab] = useState<"watchlist" | "favorites" | "history">("watchlist");
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  if (!mounted) {
    return (
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-48 rounded-3xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          <div className="h-64 rounded-3xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
      </main>
    );
  }

  // ── Auth Guard: Guest Mode ──
  if (!user) {
    return (
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl p-8 sm:p-10 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
            <User className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Yêu cầu đăng nhập
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Bạn cần đăng nhập để quản lý thông tin tài khoản, đồng bộ phim yêu thích và lịch sử xem trên mọi thiết bị.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dang-nhap?redirect=/tai-khoan"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập ngay</span>
            </Link>
            <Link
              href="/dang-ky?redirect=/tai-khoan"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-6 py-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
            >
              <span>Đăng ký tài khoản</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Authenticated User View ──
  const handleOpenEdit = () => {
    setNewUsername(user.username || "");
    setEditError("");
    setEditSuccess("");
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setEditError("Tên hiển thị không được để trống");
      return;
    }
    setSavingProfile(true);
    setEditError("");
    setEditSuccess("");

    try {
      await updateProfile({ username: newUsername.trim() });
      setEditSuccess("Cập nhật thông tin thành công!");
      setTimeout(() => {
        setIsEditing(false);
      }, 1000);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại");
    } finally {
      setSavingProfile(false);
    }
  };

  const formattedJoinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Gần đây";

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* User Card */}
        <div className="rounded-3xl bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-purple-600/10 p-6 sm:p-8 border border-violet-500/20 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Avatar */}
            <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/30 text-2xl font-black uppercase">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="h-full w-full object-cover rounded-2xl"
                />
              ) : (
                user.username?.charAt(0) || "U"
              )}
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-zinc-950">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Info */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {user.username}
                </h1>
                <button
                  onClick={handleOpenEdit}
                  className="p-1 text-zinc-400 hover:text-violet-600 transition-colors"
                  title="Chỉnh sửa tên hiển thị"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                  {user.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  Tham gia: {formattedJoinDate}
                </span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-4 pt-1 text-[11px] text-zinc-400">
                <Link
                  href="/xem-sau"
                  className="flex items-center gap-1 hover:text-amber-500 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5 text-amber-500 fill-current" />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {watchlist.length}
                  </span>{" "}
                  phim xem sau
                </Link>
                <Link
                  href="/yeu-thich"
                  className="flex items-center gap-1 hover:text-rose-500 transition-colors"
                >
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-current" />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {favorites.length}
                  </span>{" "}
                  phim yêu thích
                </Link>
                <Link
                  href="/lich-su"
                  className="flex items-center gap-1 hover:text-blue-500 transition-colors"
                >
                  <History className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {history.length}
                  </span>{" "}
                  phim đã xem
                </Link>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Sửa hồ sơ
            </button>
            <Link
              href="/cai-dat"
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <Settings className="h-3.5 w-3.5" />
              Cài đặt
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-violet-500" />
                  Chỉnh sửa hồ sơ
                </h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold">
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  {editSuccess}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Nhập tên mới..."
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 py-2.5 px-3 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Email đăng ký (không thể đổi)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50 py-2.5 px-3 text-xs text-zinc-500 cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>{savingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60 pb-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "watchlist"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Bookmark className="h-4 w-4 fill-current" />
              Xem sau ({watchlist.length})
            </button>

            <button
              onClick={() => setActiveTab("favorites")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "favorites"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Heart className="h-4 w-4 fill-current" />
              Yêu thích ({favorites.length})
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "history"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <History className="h-4 w-4" />
              Lịch sử ({history.length})
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href={
                activeTab === "watchlist"
                  ? "/xem-sau"
                  : activeTab === "favorites"
                  ? "/yeu-thich"
                  : "/lich-su"
              }
              className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Xem trang đầy đủ →
            </Link>
          </div>
        </div>

        {/* Tab Content: Watchlist */}
        {activeTab === "watchlist" && (
          <div className="space-y-4">
            {watchlist.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách xem sau?")) {
                      clearWatchlist();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa toàn bộ xem sau
                </button>
              </div>
            )}

            {watchlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Bookmark className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  Chưa có phim nào trong danh sách Xem sau
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Khi duyệt phim, bạn có thể bấm biểu tượng Bookmark để lưu phim và xem lại bất cứ khi nào thuận tiện.
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
                {watchlist.map((movie) => (
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

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFromWatchlist(movie.slug);
                      }}
                      aria-label={`Xóa ${movie.name} khỏi xem sau`}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-rose-500 hover:bg-black/80 transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 shadow-md cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="p-3 flex flex-col gap-1">
                      <Link
                        href={`/phim/${movie.slug}`}
                        className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1 hover:text-violet-600"
                      >
                        {movie.name}
                      </Link>
                      {movie.year && (
                        <p className="text-[11px] text-zinc-500 line-clamp-1">
                          {movie.year}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Favorites */}
        {activeTab === "favorites" && (
          <div className="space-y-4">
            {favorites.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách yêu thích?")) {
                      clearFavorites();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa toàn bộ yêu thích
                </button>
              </div>
            )}

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

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFavorite(movie.slug);
                      }}
                      aria-label={`Xóa ${movie.name} khỏi yêu thích`}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-rose-500 hover:bg-black/80 transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 shadow-md cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

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
                      href={`/phim/${item.slug}${item.episodeSlug ? `?ep=${item.episodeSlug}` : ""}`}
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
                              Đang xem: {normalizeEpisodeLabel(item.episodeName)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/phim/${item.slug}${item.episodeSlug ? `?ep=${item.episodeSlug}` : ""}`}
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
