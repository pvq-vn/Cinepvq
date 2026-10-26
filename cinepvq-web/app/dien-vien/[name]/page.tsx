"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/Skeleton";
import type { Movie } from "@/types/movie";
import {
  User,
  Film,
  Tv,
  Layers,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface ActorDetailResponse {
  status: boolean;
  actor: {
    name: string;
    role: "Diễn viên" | "Đạo diễn";
    movieCount: number;
    sampleMovies: string[];
    thumbUrl?: string;
  };
  movies: Movie[];
}

export default function ActorDetailPage() {
  const params = useParams<{ name: string }>();
  const actorName = useMemo(() => {
    try {
      return decodeURIComponent(params.name || "");
    } catch {
      return params.name || "";
    }
  }, [params.name]);

  const [filterType, setFilterType] = useState<"all" | "series" | "single">("all");

  const { data, isLoading, isError, refetch } = useQuery<ActorDetailResponse>({
    queryKey: ["actor-filmography", actorName],
    queryFn: async () => {
      const res = await fetch(
        `/api/actors?name=${encodeURIComponent(actorName)}`
      );
      if (!res.ok) throw new Error("Failed to fetch actor movies");
      return res.json();
    },
    enabled: Boolean(actorName && actorName.length >= 2),
    staleTime: 5 * 60 * 1000,
  });

  const movies = useMemo(() => data?.movies || [], [data?.movies]);

  const filteredMovies = useMemo(() => {
    if (filterType === "all") return movies;
    if (filterType === "single") {
      return movies.filter(
        (m) =>
          m.current_episode?.toLowerCase().includes("full") ||
          m.total_episodes === 1
      );
    }
    return movies.filter(
      (m) =>
        !m.current_episode?.toLowerCase().includes("full") &&
        m.total_episodes !== 1
    );
  }, [movies, filterType]);

  return (
    <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Back navigation */}
        <div>
          <Link
            href="/tim-kiem"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại Tìm kiếm &amp; Khám phá
          </Link>
        </div>

        {/* Actor Hero Profile Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/15 via-indigo-600/10 to-zinc-900/40 p-6 sm:p-10 border border-violet-500/25 shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-2xl shadow-violet-600/30 text-3xl sm:text-4xl font-black ring-4 ring-white/10 overflow-hidden">
              {data?.actor?.thumbUrl ? (
                <img
                  src={data.actor.thumbUrl}
                  alt={actorName}
                  className="h-full w-full object-cover opacity-85"
                />
              ) : (
                actorName.charAt(0).toUpperCase() || <User className="h-10 w-10" />
              )}
            </div>

            <div className="space-y-3 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/15 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-300 border border-violet-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{data?.actor?.role || "Diễn viên / Đạo diễn"}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {actorName}
              </h1>

              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
                Tổng hợp danh sách các bộ phim điện ảnh và truyền hình có sự tham gia của{" "}
                <strong className="text-zinc-900 dark:text-zinc-200">{actorName}</strong> trên hệ thống Cinépvq.
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 px-3.5 py-1.5 font-bold text-violet-600 dark:text-violet-400 border border-zinc-200/60 dark:border-zinc-800">
                  <Film className="h-3.5 w-3.5" />
                  {isLoading ? "Đang tải..." : `${movies.length} tác phẩm`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Film className="h-5 w-5 text-violet-500" />
            Danh Sách Phim Của {actorName}
          </h2>

          <div className="flex items-center gap-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200/60 dark:border-zinc-800/60">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterType === "all"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Tất cả ({movies.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("series")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterType === "series"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              Phim bộ
            </button>
            <button
              type="button"
              onClick={() => setFilterType("single")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterType === "single"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              Phim lẻ
            </button>
          </div>
        </div>

        {/* Movies Grid */}
        {isLoading ? (
          <MovieGridSkeleton count={10} />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              Không thể tải danh sách phim của {actorName}.
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </button>
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <User className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Chưa tìm thấy bộ phim nào phù hợp
            </h3>
            <p className="text-xs text-zinc-500 max-w-md">
              Hệ thống đang tiếp tục cập nhật dữ liệu phim của {actorName}. Bạn có thể thử tìm kiếm bằng tên tiếng Anh hoặc tên phiên âm khác.
            </p>
            <Link
              href={`/tim-kiem?q=${encodeURIComponent(actorName)}`}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
            >
              Tìm kiếm mở rộng cho &ldquo;{actorName}&rdquo;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredMovies.map((movie, idx) => (
              <MovieCard key={movie.slug} movie={movie} priority={idx < 5} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
