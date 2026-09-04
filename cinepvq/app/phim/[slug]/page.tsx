"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useFetchMovieDetail } from "@/hooks/useMovies";
import { extractCategoriesFromMovie } from "@/types/movie";
import { useUserStore } from "@/hooks/useUserStore";
import VideoPlayer from "@/components/VideoPlayer";
import SimilarMovies from "@/components/MovieDetail/SimilarMovies";
import MovieComments from "@/components/MovieDetail/MovieComments";
import { MovieDetailSkeleton } from "@/components/Skeleton";
import {
  Play,
  Heart,
  Check,
  Clock,
  Globe,
  Film,
  User,
  Tv,
  AlertCircle,
  RefreshCw,
  Share2,
} from "lucide-react";

export default function MovieDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: movie, isLoading, isError, refetch } = useFetchMovieDetail(slug);
  const { isFavorite, toggleFavorite, addHistory, mounted } = useUserStore();

  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>("");
  const [activeEpisodeSlug, setActiveEpisodeSlug] = useState<string>("");
  const [activeServerIndex, setActiveServerIndex] = useState<number>(0);
  const [markedWatched, setMarkedWatched] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const playerRef = useRef<HTMLDivElement>(null);

  // Error state
  if (isError) {
    return (
      <main className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Không tìm thấy thông tin phim
        </h2>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm">
          Bộ phim này có thể đã bị xóa hoặc đường dẫn không còn tồn tại.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-violet-500 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Thử lại
        </button>
      </main>
    );
  }

  // Loading state
  if (isLoading || !movie) {
    return <MovieDetailSkeleton />;
  }

  const favorited = mounted && isFavorite(movie.slug);
  const parsed = extractCategoriesFromMovie(movie);

  const servers = movie.episodes || [];
  const currentServer = servers[activeServerIndex] || servers[0];
  const episodeItems = currentServer?.items || [];

  // Start watching: select first episode or scroll to player
  const handleWatchNow = () => {
    if (!currentVideoUrl && episodeItems.length > 0) {
      const firstEp = episodeItems[0];
      setCurrentVideoUrl(firstEp.embed);
      setActiveEpisodeSlug(firstEp.slug);
      addHistory(movie, { slug: firstEp.slug, name: firstEp.name });
    }
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSelectEpisode = (ep: { name: string; slug: string; embed: string }) => {
    setCurrentVideoUrl(ep.embed);
    setActiveEpisodeSlug(ep.slug);
    addHistory(movie, { slug: ep.slug, name: ep.name });
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Extract cast list
  const castList = movie.casts
    ? movie.casts.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  return (
    <main className="flex-1 pb-20">
      {/* ── 1. Hero Cinematic Section ── */}
      <section className="relative w-full min-h-[60vh] max-h-[700px] overflow-hidden bg-zinc-950">
        {/* Backdrop Image */}
        <div className="absolute inset-0">
          <img
            src={movie.poster_url || movie.thumb_url}
            alt={movie.name}
            className="h-full w-full object-cover object-top opacity-35 filter blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
        </div>

        {/* Hero Content Container */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-12 sm:pt-28 sm:pb-16 flex flex-col md:flex-row items-center md:items-end gap-8">
          {/* Poster Card */}
          <div className="w-48 sm:w-56 md:w-64 aspect-[2/3] flex-shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 bg-zinc-900 group">
            <img
              src={movie.thumb_url || movie.poster_url}
              alt={movie.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>

          {/* Details & Action Buttons */}
          <div className="flex-1 space-y-4 text-center md:text-left text-white">
            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-semibold">
              {movie.quality && (
                <span className="rounded-md bg-violet-600 px-2.5 py-1 text-white shadow-md shadow-violet-600/30">
                  {movie.quality}
                </span>
              )}
              {movie.current_episode && (
                <span className="rounded-md bg-white/15 px-2.5 py-1 text-zinc-200 backdrop-blur-md">
                  {movie.current_episode}
                </span>
              )}
              {parsed.year && (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-zinc-300 backdrop-blur-md">
                  {parsed.year}
                </span>
              )}
              {movie.time && (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-zinc-300 backdrop-blur-md flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {movie.time}
                </span>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {movie.name}
              </h1>
              {movie.original_name && (
                <p className="mt-1 text-sm sm:text-base text-zinc-400 italic">
                  {movie.original_name}
                </p>
              )}
            </div>

            {/* Genres & Countries tags */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
              {parsed.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200"
                >
                  {genre}
                </span>
              ))}
              {parsed.countries.map((country) => (
                <span
                  key={country}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" />
                  {country}
                </span>
              ))}
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                onClick={handleWatchNow}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all"
              >
                <Play className="h-4 w-4 fill-current" />
                Xem ngay
              </button>

              <button
                onClick={() => toggleFavorite(movie)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold backdrop-blur-md active:scale-95 transition-all ${
                  favorited
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} />
                <span>{favorited ? "Đã lưu yêu thích" : "Thêm vào yêu thích"}</span>
              </button>

              <button
                onClick={() => setMarkedWatched((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold backdrop-blur-md active:scale-95 transition-all ${
                  markedWatched
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                    : "bg-white/10 hover:bg-white/20 text-zinc-300"
                }`}
              >
                <Check className="h-4 w-4" />
                <span>{markedWatched ? "Đã xem" : "Đánh dấu đã xem"}</span>
              </button>

              <button
                onClick={handleShare}
                aria-label="Chia sẻ phim"
                className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title={copiedLink ? "Đã sao chép link!" : "Chia sẻ phim"}
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            {copiedLink && (
              <p className="text-xs text-emerald-400 font-medium">
                ✓ Đã sao chép liên kết phim vào bộ nhớ tạm!
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Video Player & Episode List Section ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-12">
        <section ref={playerRef} className="space-y-6">
          {/* Player Container */}
          {currentVideoUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Tv className="h-4 w-4 text-violet-500" />
                  Đang phát:{" "}
                  <span className="text-violet-600 dark:text-violet-400">
                    Tập {activeEpisodeSlug.replace("tap-", "")}
                  </span>
                </h3>
                <span className="text-xs text-zinc-400">
                  {currentServer?.server_name || "Server chính"}
                </span>
              </div>
              <VideoPlayer videoUrl={currentVideoUrl} />
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-400">
                <Play className="h-7 w-7 fill-current translate-x-0.5" />
              </div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Sẵn sàng phát video
              </p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Bấm nút &ldquo;Xem ngay&rdquo; hoặc chọn một tập phim bên dưới để bắt đầu thưởng thức.
              </p>
              <button
                onClick={handleWatchNow}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Phát tập đầu tiên
              </button>
            </div>
          )}

          {/* Server tabs & Episode list */}
          {servers.length > 0 && (
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-5 sm:p-6 border border-zinc-200/60 dark:border-zinc-800/60 space-y-5">
              {/* Server selector tabs */}
              {servers.length > 1 && (
                <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-semibold text-zinc-500 mr-2">
                    Nguồn phát:
                  </span>
                  {servers.map((server, sIdx) => (
                    <button
                      key={server.server_name}
                      onClick={() => setActiveServerIndex(sIdx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeServerIndex === sIdx
                          ? "bg-violet-600 text-white shadow-md"
                          : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {server.server_name}
                    </button>
                  ))}
                </div>
              )}

              {/* Episode buttons */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Danh sách tập ({episodeItems.length} tập)
                  </h4>
                </div>

                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-1">
                  {episodeItems.map((ep) => {
                    const isActive = ep.slug === activeEpisodeSlug;
                    return (
                      <button
                        key={ep.slug}
                        onClick={() => handleSelectEpisode(ep)}
                        className={`
                          min-w-[46px] rounded-xl px-3.5 py-2 text-xs font-bold transition-all
                          ${
                            isActive
                              ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105"
                              : "bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600 border border-zinc-200 dark:border-zinc-700/60"
                          }
                        `}
                      >
                        {ep.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 3. Synopsis & Detailed Metadata ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main: Synopsis & Cast */}
          <div className="lg:col-span-2 space-y-8">
            {/* Synopsis */}
            {movie.description && (
              <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Film className="h-5 w-5 text-violet-500" />
                  Nội Dung Phim
                </h3>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: movie.description }}
                />
              </section>
            )}

            {/* Cast List */}
            {castList.length > 0 && (
              <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <User className="h-5 w-5 text-violet-500" />
                  Diễn Viên
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {castList.map((actor) => (
                    <div
                      key={actor}
                      className="flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-800 px-3.5 py-2 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-sm"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/10 text-violet-600 text-[10px] font-bold">
                        {actor.charAt(0)}
                      </div>
                      <span>{actor}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Comments */}
            <MovieComments movieSlug={movie.slug} />
          </div>

          {/* Sidebar: Detailed Movie Information */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                Thông Tin Chi Tiết
              </h3>

              <dl className="space-y-3 text-xs">
                {movie.director && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Đạo diễn:</dt>
                    <dd className="font-semibold text-zinc-800 dark:text-zinc-200 text-right">
                      {movie.director}
                    </dd>
                  </div>
                )}

                {parsed.countries.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Quốc gia:</dt>
                    <dd className="font-semibold text-zinc-800 dark:text-zinc-200 text-right">
                      {parsed.countries.join(", ")}
                    </dd>
                  </div>
                )}

                {parsed.year && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Năm phát hành:</dt>
                    <dd className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {parsed.year}
                    </dd>
                  </div>
                )}

                {movie.quality && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Chất lượng:</dt>
                    <dd className="font-semibold text-violet-600 dark:text-violet-400">
                      {movie.quality}
                    </dd>
                  </div>
                )}

                {movie.language && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Ngôn ngữ:</dt>
                    <dd className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {movie.language}
                    </dd>
                  </div>
                )}

                {movie.time && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Thời lượng:</dt>
                    <dd className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {movie.time}
                    </dd>
                  </div>
                )}

                {movie.total_episodes ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Số tập:</dt>
                    <dd className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {movie.total_episodes} tập
                    </dd>
                  </div>
                ) : null}

                {movie.current_episode && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Tình trạng:</dt>
                    <dd className="font-semibold text-amber-600 dark:text-amber-400">
                      {movie.current_episode}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* ── 4. Similar Movies ── */}
        <SimilarMovies
          genreSlug={
            parsed.genres.length > 0
              ? parsed.genres[0].toLowerCase().replace(/\s+/g, "-")
              : undefined
          }
          currentSlug={movie.slug}
        />
      </div>
    </main>
  );
}
