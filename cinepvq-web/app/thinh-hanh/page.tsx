"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getLatestMovies,
  getMoviesByCategory,
  getMoviesByGenre,
} from "@/services/api";
import MovieCard from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/Skeleton";
import { Flame, Trophy, Award, Sparkles, TrendingUp, RefreshCw } from "lucide-react";
import type { Movie } from "@/types/movie";

type TabKey = "all" | "series" | "single" | "anime" | "action" | "romance";

export default function TrendingPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Overall trending (latest updated movies)
  const {
    data: allData,
    isLoading: allLoading,
    isError: allError,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ["trending-all"],
    queryFn: async () => (await getLatestMovies(1)).data,
    staleTime: 5 * 60 * 1000,
  });

  // Series trending
  const { data: seriesData, isLoading: seriesLoading } = useQuery({
    queryKey: ["trending-series"],
    queryFn: async () => (await getMoviesByCategory("phim-bo", 1)).data,
    staleTime: 5 * 60 * 1000,
  });

  // Single movies trending
  const { data: singleData, isLoading: singleLoading } = useQuery({
    queryKey: ["trending-single"],
    queryFn: async () => (await getMoviesByCategory("phim-le", 1)).data,
    staleTime: 5 * 60 * 1000,
  });

  // Anime trending
  const { data: animeData, isLoading: animeLoading } = useQuery({
    queryKey: ["trending-anime"],
    queryFn: async () => (await getMoviesByCategory("hoat-hinh", 1)).data,
    staleTime: 5 * 60 * 1000,
  });

  // Action trending
  const { data: actionData, isLoading: actionLoading } = useQuery({
    queryKey: ["trending-action"],
    queryFn: async () => (await getMoviesByGenre("hanh-dong", 1)).data,
    staleTime: 5 * 60 * 1000,
  });

  // Romance trending
  const { data: romanceData, isLoading: romanceLoading } = useQuery({
    queryKey: ["trending-romance"],
    queryFn: async () => (await getMoviesByGenre("tinh-cam", 1)).data,
    staleTime: 5 * 60 * 1000,
  });

  const getActiveMovies = (): { movies: Movie[]; loading: boolean } => {
    switch (activeTab) {
      case "series":
        return { movies: seriesData?.items ?? [], loading: seriesLoading };
      case "single":
        return { movies: singleData?.items ?? [], loading: singleLoading };
      case "anime":
        return { movies: animeData?.items ?? [], loading: animeLoading };
      case "action":
        return { movies: actionData?.items ?? [], loading: actionLoading };
      case "romance":
        return { movies: romanceData?.items ?? [], loading: romanceLoading };
      default:
        return { movies: allData?.items ?? [], loading: allLoading };
    }
  };

  const { movies: currentMovies, loading: currentLoading } = getActiveMovies();

  const top3 = currentMovies.slice(0, 3);
  const remaining = currentMovies.slice(3, 15);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "all", label: "Tổng hợp", icon: "🔥" },
    { key: "series", label: "Phim bộ", icon: "📺" },
    { key: "single", label: "Phim lẻ", icon: "🎬" },
    { key: "anime", label: "Hoạt hình", icon: "⚡" },
    { key: "action", label: "Hành động", icon: "💥" },
    { key: "romance", label: "Tình cảm", icon: "💖" },
  ];

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500 mb-3">
            <Flame className="h-4 w-4 fill-current" />
            Bảng xếp hạng xu hướng
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
            Thịnh Hành & Bảng Xếp Hạng
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Các tác phẩm điện ảnh và truyền hình đang thu hút sự chú ý lớn nhất từ cộng đồng khán giả.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex-shrink-0
                ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25 scale-[1.02]"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {allError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-sm font-semibold text-red-500">
              Không thể tải bảng xếp hạng lúc này.
            </p>
            <button
              onClick={() => refetchAll()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </button>
          </div>
        )}

        {/* Loading */}
        {currentLoading && <MovieGridSkeleton count={10} />}

        {/* Content */}
        {!currentLoading && !allError && (
          <div className="space-y-12">
            {/* Top 3 Podium (Top 1, 2, 3) */}
            {top3.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    Top 3 Tác Phẩm Nổi Bật Nhất
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {top3.map((movie, idx) => {
                    const rank = idx + 1;
                    const badgeColor =
                      rank === 1
                        ? "from-amber-400 to-yellow-600 text-black ring-amber-400"
                        : rank === 2
                          ? "from-slate-300 to-zinc-500 text-black ring-zinc-300"
                          : "from-amber-600 to-amber-800 text-white ring-amber-600";

                    return (
                      <div
                        key={movie.slug}
                        className="relative flex flex-col p-3 rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-500/50 transition-all shadow-md hover:shadow-xl group"
                      >
                        {/* Crown / Trophy icon for Top 1 */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r ${badgeColor} shadow-md`}
                          >
                            <Award className="h-3.5 w-3.5" />
                            TOP {rank}
                          </span>
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            Thịnh hành
                          </span>
                        </div>

                        <MovieCard movie={movie} variant="ranking" rank={rank} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remaining Rankings: 4 to 15 */}
            {remaining.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    Bảng Xếp Hạng Tiếp Theo (Top 4 - 15)
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
                  {remaining.map((movie, idx) => (
                    <MovieCard
                      key={movie.slug}
                      movie={movie}
                      variant="ranking"
                      rank={idx + 4}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
