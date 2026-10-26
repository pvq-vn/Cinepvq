"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUserStore } from "@/hooks/useUserStore";
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Film,
  Users,
  MessageSquare,
  Bell,
  Flame,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  XCircle,
  Star,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Send,
  Database,
  Server,
  Lock,
  Unlock,
  Wrench,
  ExternalLink,
} from "lucide-react";

type AdminTab = "overview" | "movies" | "crawler" | "users" | "engagement";

interface HealthItem {
  name: string;
  status: "online" | "degraded" | "offline";
  latencyMs: number;
  detail: string;
}

interface AdminStatsPayload {
  status: boolean;
  adminEmail: string;
  counts: {
    users: number;
    movies: number;
    episodes: number;
    watchHistory: number;
    favorites: number;
    watchlist: number;
    comments: number;
    notifications: number;
    cachedPlatforms: number;
  };
  health: HealthItem[];
  recentActivity: Array<{
    id: string;
    movie_slug: string;
    episode_slug: string;
    episode_name: string | null;
    watched_at: string;
    email: string;
    username: string | null;
    movie_name: string | null;
  }>;
}

interface AdminMovieRow {
  id: string;
  slug: string;
  name: string;
  original_name: string | null;
  thumb_url: string | null;
  year: number | null;
  quality: string | null;
  current_episode: string | null;
  casts: string | null;
  director: string | null;
  imdb_id: string | null;
  douban_id: string | null;
  is_featured: boolean;
  is_hidden: boolean;
  pinned_rank: number | null;
  internal_views: number;
  episode_count: number;
  updated_at: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  created_at: string;
  historyCount: number;
  favoritesCount: number;
  watchlistCount: number;
  commentsCount: number;
}

interface AdminCommentRow {
  id: string;
  movie_slug: string;
  content: string;
  rating: number | null;
  created_at: string;
  email: string;
  username: string | null;
  movie_name: string | null;
}

const SOLE_ADMIN_EMAIL = "vanquyetp823@gmail.com";

export default function AdminPortalPage() {
  const { user, mounted, isAdmin: isSoleAdmin } = useUserStore();
  const authLoading = !mounted;
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Overview state
  const [stats, setStats] = useState<AdminStatsPayload | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Movies state
  const [movies, setMovies] = useState<AdminMovieRow[]>([]);
  const [movieSearch, setMovieSearch] = useState("");
  const [moviePage, setMoviePage] = useState(1);
  const [movieTotalPages, setMovieTotalPages] = useState(1);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [enrichSlugInput, setEnrichSlugInput] = useState("");
  const [editingMovie, setEditingMovie] = useState<AdminMovieRow | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Crawler state
  const [crawlerCaches, setCrawlerCaches] = useState<
    Array<{
      platformId: string;
      platformName: string;
      categoryLabel: string;
      itemCount: number;
      updatedAt: string;
    }>
  >([]);
  const [loadingCrawler, setLoadingCrawler] = useState(false);

  // Users state
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Engagement (Comments & Notifications) state
  const [commentsList, setCommentsList] = useState<AdminCommentRow[]>([]);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifMovieSlug, setNotifMovieSlug] = useState("");
  const [loadingEngagement, setLoadingEngagement] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const fetchStats = useCallback(async () => {
    if (!isSoleAdmin) return;
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data?.status) setStats(data);
    } finally {
      setLoadingStats(false);
    }
  }, [isSoleAdmin]);

  const fetchMovies = useCallback(
    async (q = movieSearch, page = moviePage) => {
      if (!isSoleAdmin) return;
      setLoadingMovies(true);
      try {
        const res = await fetch(
          `/api/admin/movies?q=${encodeURIComponent(q)}&page=${page}&limit=15`
        );
        const data = await res.json();
        if (data?.status) {
          setMovies(data.items || []);
          setMovieTotalPages(data.paginate?.total_page || 1);
        }
      } finally {
        setLoadingMovies(false);
      }
    },
    [isSoleAdmin, movieSearch, moviePage]
  );

  const fetchCrawlerStatus = useCallback(async () => {
    if (!isSoleAdmin) return;
    setLoadingCrawler(true);
    try {
      const res = await fetch("/api/admin/crawler");
      const data = await res.json();
      if (data?.status) {
        setCrawlerCaches(data.caches || []);
      }
    } finally {
      setLoadingCrawler(false);
    }
  }, [isSoleAdmin]);

  const fetchUsers = useCallback(
    async (q = userSearch) => {
      if (!isSoleAdmin) return;
      setLoadingUsers(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data?.status) {
          setUsersList(data.users || []);
        }
      } finally {
        setLoadingUsers(false);
      }
    },
    [isSoleAdmin, userSearch]
  );

  const fetchEngagement = useCallback(async () => {
    if (!isSoleAdmin) return;
    setLoadingEngagement(true);
    try {
      const res = await fetch("/api/admin/comments");
      const data = await res.json();
      if (data?.status) {
        setCommentsList(data.comments || []);
      }
    } finally {
      setLoadingEngagement(false);
    }
  }, [isSoleAdmin]);

  useEffect(() => {
    if (!isSoleAdmin) return;
    if (activeTab === "overview") fetchStats();
    if (activeTab === "movies") fetchMovies(movieSearch, moviePage);
    if (activeTab === "crawler") fetchCrawlerStatus();
    if (activeTab === "users") fetchUsers(userSearch);
    if (activeTab === "engagement") fetchEngagement();
  }, [
    isSoleAdmin,
    activeTab,
    moviePage,
    fetchStats,
    fetchMovies,
    fetchCrawlerStatus,
    fetchUsers,
    fetchEngagement,
  ]);

  // Actions
  const handleEnrichMovie = async (slugToEnrich: string) => {
    const cleanSlug = slugToEnrich.trim().replace(/^\/+|\/+$/g, "").replace(/^phim\//, "");
    if (!cleanSlug) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enrich", slug: cleanSlug }),
      });
      const data = await res.json();
      if (data?.status) {
        showToast(data.message || "Đã cào dữ liệu phim thành công!");
        setEnrichSlugInput("");
        fetchMovies(movieSearch, moviePage);
      } else {
        showToast(data?.message || "Lỗi khi cào thông tin phim");
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleFixAllEpisodeNames = async () => {
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fix_episodes" }),
      });
      const data = await res.json();
      showToast(data?.message || "Đã chuẩn hóa tên tập phim!");
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleMovieFlag = async (
    movie: AdminMovieRow,
    field: "is_featured" | "is_hidden"
  ) => {
    const nextVal = !movie[field];
    const res = await fetch("/api/admin/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        slug: movie.slug,
        [field]: nextVal,
      }),
    });
    const data = await res.json();
    if (data?.status) {
      showToast(data.message);
      setMovies((prev) =>
        prev.map((m) => (m.slug === movie.slug ? { ...m, [field]: nextVal } : m))
      );
    }
  };

  const handleSaveMovieEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          slug: editingMovie.slug,
          name: editingMovie.name,
          original_name: editingMovie.original_name,
          casts: editingMovie.casts,
          director: editingMovie.director,
          imdb_id: editingMovie.imdb_id,
          douban_id: editingMovie.douban_id,
          internal_views: editingMovie.internal_views,
        }),
      });
      const data = await res.json();
      if (data?.status) {
        showToast(data.message);
        setEditingMovie(null);
        fetchMovies(movieSearch, moviePage);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteMovie = async (slug: string) => {
    if (!confirm(`Bạn có chắc muốn xóa phim "${slug}" khỏi CSDL nội bộ?`)) return;
    const res = await fetch("/api/admin/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", slug }),
    });
    const data = await res.json();
    if (data?.status) {
      showToast(data.message);
      fetchMovies(movieSearch, moviePage);
    }
  };

  const handleRunCrawlerAction = async (
    action: "crawl_rankings" | "sync_latest_movies"
  ) => {
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/crawler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, limit: 8 }),
      });
      const data = await res.json();
      if (data?.status) {
        showToast(data.message);
        fetchCrawlerStatus();
      } else {
        showToast(data?.message || "Lỗi khi chạy Crawler");
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleUserStatus = async (u: AdminUserRow) => {
    if (u.email.toLowerCase() === SOLE_ADMIN_EMAIL) return;
    const nextStatus = u.status === "active" ? "suspended" : "active";
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, status: nextStatus }),
    });
    const data = await res.json();
    if (data?.status) {
      showToast(data.message);
      setUsersList((prev) =>
        prev.map((item) =>
          item.id === u.id ? { ...item, status: nextStatus } : item
        )
      );
    } else {
      showToast(data?.message || "Không thể cập nhật trạng thái");
    }
  };

  const handleDeleteComment = async (id: string) => {
    const res = await fetch(`/api/admin/comments?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data?.status) {
      showToast(data.message);
      setCommentsList((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          message: notifMessage,
          movieSlug: notifMovieSlug.trim() || null,
          targetUserId: "all",
        }),
      });
      const data = await res.json();
      if (data?.status) {
        showToast(data.message);
        setNotifTitle("");
        setNotifMessage("");
        setNotifMovieSlug("");
      }
    } finally {
      setActionBusy(false);
    }
  };

  if (authLoading) {
    return (
      <main className="flex-1 pt-28 pb-20 px-4 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-zinc-400">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
          <span>Đang xác thực quyền Quản trị viên...</span>
        </div>
      </main>
    );
  }

  // Strict Client Guard: Only vanquyetp823@gmail.com can view this portal
  if (!user || !isSoleAdmin) {
    return (
      <main className="flex-1 pt-28 pb-20 px-4">
        <div className="mx-auto max-w-lg rounded-3xl bg-zinc-900/90 border border-rose-500/30 p-8 text-center space-y-4 shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Khu Vực Dành Riêng Cho Quản Trị Viên
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Quyền truy cập Trung tâm Quản trị Hệ thống CinePVQ chỉ được cấp duy nhất cho tài khoản Quản trị viên tối cao.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 text-xs font-bold transition-colors"
            >
              Về trang chủ
            </Link>
            {!user && (
              <Link
                href="/dang-nhap"
                className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 text-xs font-extrabold transition-colors"
              >
                Đăng nhập Admin
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    {
      key: "overview",
      label: "Tổng Quan & Kết Nối",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      key: "movies",
      label: "Quản Lý Phim & Auto-Crawl",
      icon: <Film className="h-4 w-4" />,
    },
    {
      key: "crawler",
      label: "Crawler BXH Đa Nền Tảng",
      icon: <Flame className="h-4 w-4" />,
    },
    {
      key: "users",
      label: "Người Dùng Hệ Thống",
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: "engagement",
      label: "Bình Luận & Thông Báo",
      icon: <Bell className="h-4 w-4" />,
    },
  ];

  return (
    <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Toast notification */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-amber-500 text-black px-4 py-3 text-xs sm:text-sm font-extrabold shadow-2xl">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Admin Portal Header */}
        <div className="rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/60 border border-amber-500/30 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-extrabold text-amber-300">
              <ShieldCheck className="h-4 w-4" />
              <span>SOLE SYSTEM ADMINISTRATOR • {SOLE_ADMIN_EMAIL}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Trung Tâm Quản Trị Hệ Thống CinePVQ
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Quản lý toàn diện Cơ sở dữ liệu Supabase PostgreSQL, Hệ thống tự động cào thông tin phim (IMDb, Douban, Diễn viên, Lượt xem), BXH Thịnh hành và Người dùng trên cả Web & Android.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "overview") fetchStats();
              if (activeTab === "movies") fetchMovies();
              if (activeTab === "crawler") fetchCrawlerStatus();
              if (activeTab === "users") fetchUsers();
              if (activeTab === "engagement") fetchEngagement();
            }}
            className="self-start md:self-center inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-4 py-2.5 text-xs shadow-lg transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 ${
                activeTab === t.key
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-extrabold"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/80 dark:border-zinc-800"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW & HEALTH */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* System Connectivity & Health Check */}
            <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Server className="h-5 w-5 text-emerald-500" />
                  <span>Trạng Thái Kết Nối Backend, Supabase & Nguồn Phát</span>
                </h2>
                {loadingStats && (
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {(stats?.health ?? []).map((h) => (
                  <div
                    key={h.name}
                    className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 p-4 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          h.status === "online"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : h.status === "degraded"
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-rose-500/15 text-rose-500"
                        }`}
                      >
                        {h.status === "online" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {h.status}
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">
                        {h.latencyMs}ms
                      </span>
                    </div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {h.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {h.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* KPI Counters */}
            {stats?.counts && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Người dùng đăng ký",
                    val: stats.counts.users,
                    color: "text-violet-500",
                  },
                  {
                    label: "Phim lưu trong CSDL",
                    val: stats.counts.movies,
                    color: "text-amber-500",
                  },
                  {
                    label: "Tổng số tập phim",
                    val: stats.counts.episodes,
                    color: "text-cyan-500",
                  },
                  {
                    label: "Lịch sử xem đồng bộ",
                    val: stats.counts.watchHistory,
                    color: "text-emerald-500",
                  },
                  {
                    label: "Phim yêu thích",
                    val: stats.counts.favorites,
                    color: "text-rose-500",
                  },
                  {
                    label: "Danh sách xem sau",
                    val: stats.counts.watchlist,
                    color: "text-indigo-500",
                  },
                  {
                    label: "Bình luận & Đánh giá",
                    val: stats.counts.comments,
                    color: "text-orange-500",
                  },
                  {
                    label: "BXH Nền tảng đã Cache",
                    val: stats.counts.cachedPlatforms,
                    color: "text-teal-500",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-sm"
                  >
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {card.label}
                    </p>
                    <p className={`mt-1 text-2xl sm:text-3xl font-black ${card.color}`}>
                      {card.val.toLocaleString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Watch Activity Table */}
            <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-violet-500" />
                <span>Hoạt Động Xem Phim Gần Đây Trên Hệ Thống</span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                      <th className="py-2.5 px-3 font-bold">Người dùng</th>
                      <th className="py-2.5 px-3 font-bold">Bộ phim</th>
                      <th className="py-2.5 px-3 font-bold">Tập đang xem</th>
                      <th className="py-2.5 px-3 font-bold">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {(stats?.recentActivity ?? []).map((act) => (
                      <tr key={act.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="py-2.5 px-3 font-semibold text-zinc-800 dark:text-zinc-200">
                          {act.username || act.email}
                        </td>
                        <td className="py-2.5 px-3">
                          <Link
                            href={`/phim/${act.movie_slug}`}
                            className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            {act.movie_name || act.movie_slug}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                          {act.episode_name || act.episode_slug}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-500">
                          {new Date(act.watched_at).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MOVIES & AUTO-ENRICHMENT */}
        {activeTab === "movies" && (
          <div className="space-y-6">
            {/* Auto-Enrich & Episode Cleanup Toolbar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Tự Động Cào & Gán Thông Tin Phim (Diễn Viên, Đạo Diễn, IMDb, Douban, View)</span>
                </h3>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={enrichSlugInput}
                    onChange={(e) => setEnrichSlugInput(e.target.value)}
                    placeholder="Nhập slug phim (VD: tro-choi-con-muc, dau-pha-thuong-khung)..."
                    className="flex-1 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    disabled={actionBusy || !enrichSlugInput.trim()}
                    onClick={() => handleEnrichMovie(enrichSlugInput)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-4 py-2 text-xs shadow disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Cào & Lưu CSDL Ngay</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-cyan-500" />
                    <span>Chuẩn Hóa Tên Tập Phim</span>
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Quét và sửa tự động mọi lỗi hiển thị Tập Tập 01, tap-01 trong CSDL.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleFixAllEpisodeNames}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 text-xs shadow disabled:opacity-50"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Chuẩn Hóa Tập Phim Trong DB</span>
                </button>
              </div>
            </div>

            {/* Edit Modal if active */}
            {editingMovie && (
              <form
                onSubmit={handleSaveMovieEdit}
                className="rounded-3xl bg-zinc-900 border border-amber-500/40 p-5 sm:p-6 space-y-4 text-white shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-amber-400">
                    Chỉnh sửa thông tin phim: {editingMovie.name} ({editingMovie.slug})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingMovie(null)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Đóng
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1">Tên phim</label>
                    <input
                      type="text"
                      value={editingMovie.name}
                      onChange={(e) =>
                        setEditingMovie({ ...editingMovie, name: e.target.value })
                      }
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Tên gốc</label>
                    <input
                      type="text"
                      value={editingMovie.original_name || ""}
                      onChange={(e) =>
                        setEditingMovie({
                          ...editingMovie,
                          original_name: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Đạo diễn</label>
                    <input
                      type="text"
                      value={editingMovie.director || ""}
                      onChange={(e) =>
                        setEditingMovie({
                          ...editingMovie,
                          director: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-zinc-400 mb-1">
                      Diễn viên (phân cách bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={editingMovie.casts || ""}
                      onChange={(e) =>
                        setEditingMovie({
                          ...editingMovie,
                          casts: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">IMDb ID (VD: tt10919420)</label>
                    <input
                      type="text"
                      value={editingMovie.imdb_id || ""}
                      onChange={(e) =>
                        setEditingMovie({
                          ...editingMovie,
                          imdb_id: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMovie(null)}
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="rounded-xl bg-amber-500 text-black px-5 py-2 text-xs font-extrabold"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            )}

            {/* Movies Table */}
            <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                  Danh Sách Phim Trong PostgreSQL ({movies.length})
                </h2>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={movieSearch}
                      onChange={(e) => setMovieSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setMoviePage(1);
                          fetchMovies(movieSearch, 1);
                        }
                      }}
                      placeholder="Tìm tên phim, diễn viên, slug..."
                      className="rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMoviePage(1);
                      fetchMovies(movieSearch, 1);
                    }}
                    className="rounded-xl bg-violet-600 text-white px-3 py-1.5 text-xs font-bold"
                  >
                    Tìm
                  </button>
                </div>
              </div>

              {loadingMovies ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  Đang tải danh sách phim...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                        <th className="py-2.5 px-3 font-bold">Phim</th>
                        <th className="py-2.5 px-3 font-bold">Tập / Năm</th>
                        <th className="py-2.5 px-3 font-bold">Diễn viên & Đạo diễn</th>
                        <th className="py-2.5 px-3 font-bold">IMDb / Douban</th>
                        <th className="py-2.5 px-3 font-bold">Trạng thái</th>
                        <th className="py-2.5 px-3 font-bold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                      {movies.map((m) => (
                        <tr
                          key={m.slug}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {m.thumb_url && (
                                <img
                                  src={m.thumb_url}
                                  alt={m.name}
                                  className="h-12 w-8 rounded object-cover shrink-0 bg-zinc-800"
                                />
                              )}
                              <div className="min-w-0">
                                <Link
                                  href={`/phim/${m.slug}`}
                                  className="font-bold text-zinc-900 dark:text-white hover:text-amber-500 line-clamp-1"
                                >
                                  {m.name}
                                </Link>
                                <p className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                                  {m.slug}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                              {m.current_episode || `${m.episode_count} tập`}
                            </span>
                            <span className="block text-[11px] text-zinc-400">
                              {m.year || "—"} • {m.quality || "HD"}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-[220px]">
                            {m.casts ? (
                              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2">
                                {m.casts}
                              </p>
                            ) : (
                              <span className="text-[11px] text-amber-500 italic">
                                Chưa cào diễn viên
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-0.5 text-[11px]">
                              <span className="block text-zinc-600 dark:text-zinc-400">
                                IMDb: <b>{m.imdb_id || "Auto"}</b>
                              </span>
                              <span className="block text-zinc-600 dark:text-zinc-400">
                                Douban: <b>{m.douban_id || "Auto"}</b>
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleMovieFlag(m, "is_featured")}
                                title="Đánh dấu nổi bật"
                                className={`rounded-lg px-2 py-1 text-[10px] font-bold flex items-center gap-1 ${
                                  m.is_featured
                                    ? "bg-amber-500 text-black"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                                }`}
                              >
                                <Star className="h-3 w-3" />
                                {m.is_featured ? "Nổi bật" : "Thường"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleMovieFlag(m, "is_hidden")}
                                title="Ẩn/Hiện phim"
                                className={`rounded-lg px-2 py-1 text-[10px] font-bold flex items-center gap-1 ${
                                  m.is_hidden
                                    ? "bg-rose-500/20 text-rose-500"
                                    : "bg-emerald-500/15 text-emerald-500"
                                }`}
                              >
                                {m.is_hidden ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                                {m.is_hidden ? "Đã ẩn" : "Hiển thị"}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEnrichMovie(m.slug)}
                                title="Tự động cào Diễn viên, IMDb, Douban, View"
                                className="rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-500 hover:text-black p-1.5 transition-colors"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMovie(m)}
                                title="Sửa thông tin"
                                className="rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-violet-600 hover:text-white p-1.5 transition-colors"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMovie(m.slug)}
                                title="Xóa khỏi DB"
                                className="rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white p-1.5 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Simple Pagination */}
              {movieTotalPages > 1 && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={moviePage <= 1}
                    onClick={() => setMoviePage((p) => Math.max(1, p - 1))}
                    className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    Trang trước
                  </button>
                  <span className="text-xs font-semibold text-zinc-500">
                    Trang {moviePage} / {movieTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={moviePage >= movieTotalPages}
                    onClick={() => setMoviePage((p) => p + 1)}
                    className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRENDING BXH CRAWLER */}
        {activeTab === "crawler" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-3 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span>Cào Bảng Xếp Hạng Đa Nền Tảng (Netflix, Douban, VieON, FPT Play, iQIYI)</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Kích hoạt crawler thu thập BXH trực tiếp từ các nền tảng lớn và cập nhật vào bảng <code className="text-amber-500">platform_rankings_cache</code> phục vụ cả Web và App Android.
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleRunCrawlerAction("crawl_rankings")}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold px-4 py-2.5 text-xs shadow-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${actionBusy ? "animate-spin" : ""}`} />
                    <span>Cào Mới Toàn Bộ 5 BXH Ngay</span>
                  </button>
                  <Link
                    href="/thinh-hanh"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-200"
                  >
                    <span>Mở Trang Thịnh Hành</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-3 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <span>Đồng Bộ & Làm Giàu Phim Mới Cập Nhật</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tự động lấy danh sách phim mới nhất từ KKPhim, lưu thông tin chi tiết + tập phim vào CSDL PostgreSQL và cào luôn Diễn viên, IMDb, Douban.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleRunCrawlerAction("sync_latest_movies")}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold px-4 py-2.5 text-xs shadow-lg disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Đồng Bộ & Cào Phim Mới Nhất</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cached Platforms Table */}
            <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Trạng Thái Cache BXH Trong PostgreSQL ({crawlerCaches.length} nền tảng)
              </h3>
              {loadingCrawler ? (
                <p className="text-xs text-zinc-400">Đang kiểm tra cache...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {crawlerCaches.map((c) => (
                    <div
                      key={c.platformId}
                      className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 p-4 space-y-1.5"
                    >
                      <span className="text-[10px] font-black uppercase text-amber-500">
                        {c.platformId}
                      </span>
                      <p className="text-sm font-extrabold text-zinc-900 dark:text-white">
                        {c.platformName}
                      </p>
                      <p className="text-xs font-semibold text-emerald-500">
                        {c.itemCount} phim trong BXH
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Cập nhật: {new Date(c.updatedAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: USERS MANAGEMENT */}
        {activeTab === "users" && (
          <div className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Quản Lý Tài Khoản Người Dùng ({usersList.length})
              </h2>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchUsers(userSearch);
                  }}
                  placeholder="Tìm email hoặc tên người dùng..."
                  className="rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-900 dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => fetchUsers(userSearch)}
                  className="rounded-xl bg-violet-600 text-white px-3 py-1.5 text-xs font-bold"
                >
                  Tìm
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <p className="py-10 text-center text-xs text-zinc-400">
                Đang tải danh sách người dùng...
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                      <th className="py-2.5 px-3 font-bold">Email / Tên hiển thị</th>
                      <th className="py-2.5 px-3 font-bold">Vai trò</th>
                      <th className="py-2.5 px-3 font-bold">Hoạt động</th>
                      <th className="py-2.5 px-3 font-bold">Trạng thái</th>
                      <th className="py-2.5 px-3 font-bold text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {usersList.map((u) => {
                      const isAdminRow = u.email.toLowerCase() === SOLE_ADMIN_EMAIL;
                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        >
                          <td className="py-3 px-3">
                            <p className="font-bold text-zinc-900 dark:text-white">
                              {u.email}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {u.username || "Chưa đặt username"} • Tham gia{" "}
                              {new Date(u.created_at).toLocaleDateString("vi-VN")}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            {isAdminRow ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-black text-amber-500">
                                <ShieldCheck className="h-3 w-3" />
                                ADMIN DUY NHẤT
                              </span>
                            ) : (
                              <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                                Thành viên
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                            Xem: <b>{u.historyCount}</b> • Yêu thích:{" "}
                            <b>{u.favoritesCount}</b> • Xem sau: <b>{u.watchlistCount}</b>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                u.status === "active"
                                  ? "bg-emerald-500/15 text-emerald-500"
                                  : "bg-rose-500/15 text-rose-500"
                              }`}
                            >
                              {u.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {!isAdminRow && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold ${
                                  u.status === "active"
                                    ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white"
                                    : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                                } transition-colors`}
                              >
                                {u.status === "active" ? (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    <span>Khóa</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="h-3 w-3" />
                                    <span>Mở khóa</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: COMMENTS & SYSTEM NOTIFICATIONS */}
        {activeTab === "engagement" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Broadcast Notification Form */}
            <form
              onSubmit={handleBroadcastNotification}
              className="rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-sm self-start"
            >
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                <span>Phát Thông Báo Hệ Thống</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Gửi thông báo trực tiếp tới tất cả người dùng trên cả Web và ứng dụng Android.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">
                    Tiêu đề thông báo
                  </label>
                  <input
                    type="text"
                    required
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="VD: Cập nhật tính năng BXH Thịnh Hành mới!"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">
                    Nội dung chi tiết
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    placeholder="Nhập nội dung thông báo gửi tới toàn bộ thành viên..."
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">
                    Slug phim đính kèm (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={notifMovieSlug}
                    onChange={(e) => setNotifMovieSlug(e.target.value)}
                    placeholder="VD: tro-choi-con-muc"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionBusy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold py-2.5 text-xs shadow-lg disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Gửi Thông Báo Toàn Hệ Thống</span>
              </button>
            </form>

            {/* Comments Moderation List */}
            <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-violet-500" />
                <span>Kiểm Duyệt Bình Luận Gần Đây ({commentsList.length})</span>
              </h3>

              {loadingEngagement ? (
                <p className="py-10 text-center text-xs text-zinc-400">
                  Đang tải bình luận...
                </p>
              ) : commentsList.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-400">
                  Chưa có bình luận nào trong hệ thống.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {commentsList.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 p-3.5 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {c.username || c.email}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <Link
                            href={`/phim/${c.movie_slug}`}
                            className="font-semibold text-violet-500 hover:underline"
                          >
                            {c.movie_name || c.movie_slug}
                          </Link>
                          <span className="text-[11px] text-zinc-400">
                            {new Date(c.created_at).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {c.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white p-1.5 transition-colors shrink-0"
                        title="Xóa bình luận"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
