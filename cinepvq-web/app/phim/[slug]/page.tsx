"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFetchMovieDetail } from "@/hooks/useMovies";
import { searchMovies } from "@/services/api";
import { extractCategoriesFromMovie } from "@/types/movie";
import { useUserStore } from "@/hooks/useUserStore";
import { episodeProgressStore } from "@/services/userStore";
import VideoPlayer from "@/components/VideoPlayer";
import SimilarMovies from "@/components/MovieDetail/SimilarMovies";
import MovieComments from "@/components/MovieDetail/MovieComments";
import { MovieDetailSkeleton } from "@/components/Skeleton";
import {
  Play,
  Heart,
  Clock,
  Globe,
  Film,
  User,
  Tv,
  AlertCircle,
  RefreshCw,
  Share2,
  ChevronRight,
  RotateCcw,
  Layers,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import type { EpisodeItem } from "@/types/movie";

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Normalizes season number from title, slug, or server name.
 * Handles "Season 2", "Phần 2", "Mùa 2", "SS2", etc.
 */
function parseSeasonNumber(title?: string, slug?: string): number {
  if (!title && !slug) return 1;
  const str = `${title || ""} ${slug || ""}`.toLowerCase();
  const match =
    str.match(/(?:phần|phan|season|mùa|mua|ss)\s*(\d+)/i) ||
    str.match(/(?:phần|phan|season|mùa|mua|ss)-(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) || num <= 0 ? 1 : num;
  }
  return 1;
}

/**
 * Strips season suffixes to extract core franchise title for related search.
 * e.g., "Loki Phần 2" -> "Loki", "Phù Thủy Áo Trắng: Mùa 3" -> "Phù Thủy Áo Trắng"
 */
function extractBaseTitle(title?: string): string {
  if (!title) return "";
  return title
    .replace(/(?:[-:\s]+)?(?:phần|phan|season|mùa|mua|ss)\s*\d+.*$/i, "")
    .trim();
}

/**
 * Formats seconds into mm:ss or hh:mm:ss.
 */
function formatTime(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

const CHUNK_SIZE = 30;

export default function MovieDetailPage() {
  const searchParams = useSearchParams();
  const { slug } = useParams<{ slug: string }>();

  const { data: movie, isLoading, isError, refetch } = useFetchMovieDetail(slug);
  const { isFavorite, toggleFavorite, addHistory, history, mounted } = useUserStore();

  // User-selected Episode & Server states
  const [selectedEpisodeSlug, setSelectedEpisodeSlug] = useState<string | null>(null);
  const [activeServerIndex, setActiveServerIndex] = useState<number>(0);
  const [customResumeTime, setCustomResumeTime] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);

  const playerRef = useRef<HTMLDivElement>(null);
  const lastSavedTimeRef = useRef<number>(0);

  // Servers & Episodes from API
  const servers = useMemo(() => movie?.episodes || [], [movie?.episodes]);
  const currentServer = servers[activeServerIndex] || servers[0];
  const episodeItems = useMemo(() => currentServer?.items || [], [currentServer]);

  // Detected Season Number
  const currentSeason = useMemo(
    () => parseSeasonNumber(movie?.name, movie?.slug),
    [movie?.name, movie?.slug]
  );

  const movieTitle = movie?.name || "";
  const baseTitle = extractBaseTitle(movieTitle);
  const hasSeasonIndicator = Boolean(
    movieTitle && /(?:phần|phan|season|mùa|mua|ss)\s*\d+/i.test(movieTitle)
  );

  // Optional: Discover other seasons of the same franchise (only if title has a season pattern)
  const { data: franchiseSearchResults } = useQuery({
    queryKey: ["franchise-seasons", baseTitle],
    queryFn: async () => {
      if (!baseTitle || !hasSeasonIndicator) return [];
      const res = await searchMovies(baseTitle, 1);
      return res.data?.items || [];
    },
    enabled: Boolean(hasSeasonIndicator && baseTitle.length > 2),
    staleTime: 10 * 60 * 1000,
  });

  // Filter franchise seasons list
  const franchiseSeasons = useMemo(() => {
    if (!franchiseSearchResults || franchiseSearchResults.length <= 1) return [];
    const seasonsList: { season: number; name: string; slug: string }[] = [];
    for (const item of franchiseSearchResults) {
      const sNum = parseSeasonNumber(item.name, item.slug);
      if (!seasonsList.some((s) => s.season === sNum || s.slug === item.slug)) {
        seasonsList.push({
          season: sNum,
          name: `Phần ${sNum}`,
          slug: item.slug,
        });
      }
    }
    seasonsList.sort((a, b) => a.season - b.season);
    return seasonsList.length > 1 ? seasonsList : [];
  }, [franchiseSearchResults]);

  // Parsed metadata
  const parsed = useMemo(() => {
    if (!movie) return { formats: [], genres: [], year: "", countries: [] };
    return extractCategoriesFromMovie(movie);
  }, [movie]);

  const isMovie = useMemo(() => {
    if (!movie) return false;
    return (
      movie.total_episodes === 1 ||
      episodeItems.length <= 1 ||
      Boolean(parsed.formats?.some((f) => f.toLowerCase().includes("lẻ")))
    );
  }, [movie, episodeItems.length, parsed.formats]);

  // Check saved watch history for resume
  const savedHistory = useMemo(() => {
    if (!mounted || !movie) return null;
    return history.find((h) => h.slug === movie.slug) || null;
  }, [mounted, movie, history]);

  // ─── Purely Derived Active Episode (No setState in effect) ────────────────
  const activeEpisode = useMemo(() => {
    if (episodeItems.length === 0) return null;

    // 1. User clicked an episode directly (with robust slug or numeric match)
    if (selectedEpisodeSlug) {
      const found =
        episodeItems.find((e) => e.slug === selectedEpisodeSlug) ||
        episodeItems.find((e) => e.slug.toLowerCase() === selectedEpisodeSlug.toLowerCase()) ||
        episodeItems.find((e) => {
          const curNum = parseInt(selectedEpisodeSlug.replace(/\D/g, ""), 10);
          const eNum = parseInt(e.slug.replace(/\D/g, ""), 10) || parseInt(e.name.replace(/\D/g, ""), 10);
          return !isNaN(curNum) && !isNaN(eNum) && curNum === eNum;
        });
      if (found) return found;
    }

    // 2. URL parameter ?ep=tap-X
    const urlEpSlug = searchParams.get("ep") || searchParams.get("episode");
    if (urlEpSlug) {
      const found = episodeItems.find(
        (e) => e.slug === urlEpSlug || e.name === urlEpSlug || e.slug === `tap-${urlEpSlug}`
      );
      if (found) return found;
    }

    // 3. Saved history episode
    if (savedHistory?.episodeSlug) {
      const found = episodeItems.find((e) => e.slug === savedHistory.episodeSlug);
      if (found) return found;
    }

    // 4. Default: First episode
    return episodeItems[0] || null;
  }, [episodeItems, selectedEpisodeSlug, searchParams, savedHistory]);

  const currentVideoUrl = activeEpisode?.embed || "";
  const activeEpisodeSlug = activeEpisode?.slug || "";

  // Initial resume time for VideoPlayer
  const movieSlug = movie?.slug;
  const resumeTime =
    customResumeTime !== null
      ? customResumeTime
      : activeEpisodeSlug && movieSlug
      ? episodeProgressStore.get(movieSlug, activeEpisodeSlug, currentSeason) ||
        (savedHistory?.episodeSlug === activeEpisodeSlug ? savedHistory.currentTime || 0 : 0)
      : 0;

  // Episode chunking for large series (> 30 episodes)
  const episodeChunks = useMemo(() => {
    if (episodeItems.length <= CHUNK_SIZE) return [];
    const chunks: { label: string; items: EpisodeItem[]; startIdx: number }[] = [];
    for (let i = 0; i < episodeItems.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, episodeItems.length);
      chunks.push({
        label: `Tập ${i + 1} - ${end}`,
        items: episodeItems.slice(i, end),
        startIdx: i,
      });
    }
    return chunks;
  }, [episodeItems]);

  const visibleEpisodes = useMemo(() => {
    if (episodeChunks.length === 0) return episodeItems;
    return episodeChunks[activeChunkIndex]?.items || episodeItems;
  }, [episodeChunks, activeChunkIndex, episodeItems]);

  // ─── Select Episode Handler ──────────────────────────────────────────────
  const handleSelectEpisode = useCallback(
    (ep: EpisodeItem, initialSeek = 0) => {
      setNextEpisodeCountdown(null);
      setSelectedEpisodeSlug(ep.slug);
      setCustomResumeTime(initialSeek);
      lastSavedTimeRef.current = initialSeek;

      // Keep active chunk in sync
      if (episodeChunks.length > 0) {
        const epIdx = episodeItems.findIndex((e) => e.slug === ep.slug);
        if (epIdx >= 0) {
          const chunkIdx = Math.floor(epIdx / CHUNK_SIZE);
          setActiveChunkIndex(chunkIdx);
        }
      }

      if (movie) {
        addHistory(movie, { slug: ep.slug, name: ep.name }, initialSeek);
      }

      // Shallow URL sync (?ep=tap-X) without full navigation
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ep", ep.slug);
        window.history.replaceState(null, "", url.toString());
      }

      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [movie, episodeItems, episodeChunks, addHistory]
  );

  // ─── Video Time Update ───────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(
    (cur: number, dur: number) => {
      // Only record progress when playback actually advances (> 0s) and moved at least 5s
      if (cur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 5) {
        lastSavedTimeRef.current = cur;
        const currentEp = episodeItems.find((e) => e.slug === activeEpisodeSlug);
        if (currentEp && movie) {
          addHistory(movie, { slug: currentEp.slug, name: currentEp.name }, cur, dur);
        }
      }
    },
    [episodeItems, activeEpisodeSlug, movie, addHistory]
  );

  // ─── Video Ended: Next Episode Countdown ─────────────────────────────────
  const currentEpIndex = episodeItems.findIndex((e) => e.slug === activeEpisodeSlug);
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < episodeItems.length - 1
      ? episodeItems[currentEpIndex + 1]
      : null;

  const handleVideoEnded = useCallback(() => {
    if (nextEpisode) {
      setNextEpisodeCountdown(5);
    }
  }, [nextEpisode]);

  useEffect(() => {
    if (nextEpisodeCountdown === null) return;

    const timer = setTimeout(() => {
      if (nextEpisodeCountdown <= 1) {
        setNextEpisodeCountdown(null);
        if (nextEpisode) {
          handleSelectEpisode(nextEpisode, 0);
        }
      } else {
        setNextEpisodeCountdown(nextEpisodeCountdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [nextEpisodeCountdown, nextEpisode, handleSelectEpisode]);

  // ─── Primary Hero Actions ────────────────────────────────────────────────
  const handleWatchNow = useCallback(() => {
    if (episodeItems.length > 0) {
      handleSelectEpisode(episodeItems[0], 0);
    }
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [episodeItems, handleSelectEpisode]);

  const handleResumeWatching = useCallback(() => {
    if (savedHistory?.episodeSlug) {
      const ep = episodeItems.find((e) => e.slug === savedHistory.episodeSlug);
      if (ep) {
        const savedTime =
          episodeProgressStore.get(movie?.slug || "", ep.slug, currentSeason) ||
          savedHistory.currentTime ||
          0;
        handleSelectEpisode(ep, savedTime);
        playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    handleWatchNow();
  }, [savedHistory, episodeItems, movie?.slug, currentSeason, handleSelectEpisode, handleWatchNow]);

  const handleShare = useCallback(() => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, []);

  // ─── Error State ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <main className="flex-1 min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Không tìm thấy thông tin phim
        </h2>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm">
          Bộ phim này có thể đã bị gỡ bỏ hoặc đường dẫn không còn tồn tại trên hệ thống.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-violet-500 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
          <Link
            href="/tim-kiem"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Khám phá phim khác
          </Link>
        </div>
      </main>
    );
  }

  // ─── Loading State ───────────────────────────────────────────────────────
  if (isLoading || !movie) {
    return <MovieDetailSkeleton />;
  }

  const favorited = mounted && isFavorite(movie.slug);

  const castList = movie.casts
    ? movie.casts.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  return (
    <main className="flex-1 pb-20">
      {/* ── 1. Hero Cinematic Banner ── */}
      <section className="relative w-full min-h-[62vh] max-h-[720px] overflow-hidden bg-zinc-950">
        {/* Multi-layer Backdrop Image */}
        <div className="absolute inset-0">
          <img
            src={movie.poster_url || movie.thumb_url}
            alt={movie.name}
            className="h-full w-full object-cover object-top opacity-35 filter blur-[2px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/75 to-zinc-950/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent" />
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
            {/* Badges Bar */}
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
              {currentSeason > 1 && (
                <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 font-bold">
                  Phần {currentSeason}
                </span>
              )}
            </div>

            {/* Movie Title */}
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

            {/* Genres & Countries */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
              {parsed.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
              {parsed.countries.map((country) => (
                <span
                  key={country}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 flex items-center gap-1 backdrop-blur-sm"
                >
                  <Globe className="h-3 w-3" />
                  {country}
                </span>
              ))}
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center justify-center md:justify-start gap-3">
              {/* Resume vs Watch Now button */}
              {savedHistory && savedHistory.episodeSlug ? (
                <>
                  <button
                    onClick={handleResumeWatching}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>
                      Tiếp tục xem: Tập{" "}
                      {savedHistory.episodeName ||
                        savedHistory.episodeSlug.replace("tap-", "")}
                    </span>
                    {savedHistory.currentTime && savedHistory.currentTime > 15 ? (
                      <span className="text-xs text-violet-200 font-normal">
                        ({formatTime(savedHistory.currentTime)})
                      </span>
                    ) : null}
                  </button>

                  <button
                    onClick={handleWatchNow}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Xem từ đầu</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleWatchNow}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{isMovie ? "Xem phim" : "Xem ngay (Tập 1)"}</span>
                </button>
              )}

              {/* Favorite Button */}
              <button
                onClick={() => toggleFavorite(movie)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold backdrop-blur-md active:scale-95 transition-all ${
                  favorited
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} />
                <span>{favorited ? "Đã yêu thích" : "Thêm yêu thích"}</span>
              </button>

              {/* Share Button */}
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
                ✓ Đã sao chép liên kết tập phim vào bộ nhớ tạm!
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Video Player & Episode List ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-10">
        <section ref={playerRef} className="space-y-4">
          {/* Player Header Bar */}
          {currentVideoUrl ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-100 dark:bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/10 text-violet-600 dark:text-violet-400">
                    <Tv className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Đang phát:{" "}
                      <span className="text-violet-600 dark:text-violet-400">
                        {isMovie
                          ? "Bản Full"
                          : `Tập ${
                              episodeItems.find((e) => e.slug === activeEpisodeSlug)?.name ||
                              activeEpisodeSlug.replace("tap-", "")
                            }`}
                      </span>
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      {currentServer?.server_name || "Server chính"}
                    </span>
                  </div>
                </div>

                {/* Next Episode Action Button */}
                {nextEpisode && (
                  <button
                    onClick={() => handleSelectEpisode(nextEpisode, 0)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600/10 hover:bg-violet-600 text-violet-600 hover:text-white dark:text-violet-300 dark:hover:text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm"
                  >
                    <span>Tập tiếp theo (Tập {nextEpisode.name})</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Multi-Source Video Player */}
              <VideoPlayer
                videoUrl={currentVideoUrl}
                movieSlug={movie.slug || slug}
                movieTitle={movie.name || movie.original_name}
                imdbId={movie.imdb_id || undefined}
                season={currentSeason}
                episode={
                  parseInt(
                    episodeItems.find((e) => e.slug === activeEpisodeSlug)?.name || ""
                  ) ||
                  parseInt(activeEpisodeSlug.replace(/\D/g, "")) ||
                  1
                }
                serverName={currentServer?.server_name || "Vietsub"}
                episodeSlug={activeEpisodeSlug}
                type={isMovie ? "movie" : "series"}
                poster={movie.poster_url || movie.thumb_url}
                initialTime={resumeTime}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnded}
              />

              {/* Auto Next Episode Countdown Notification Banner */}
              {nextEpisodeCountdown !== null && nextEpisode && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-violet-600/15 border border-violet-500/30 text-xs shadow-md">
                  <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <Clock className="h-4 w-4 text-violet-500 dark:text-violet-400 animate-pulse" />
                    <span>
                      Tập tiếp theo (<strong>Tập {nextEpisode.name}</strong>) sẽ tự động phát sau{" "}
                      <strong className="text-violet-600 dark:text-violet-400 text-sm">
                        {nextEpisodeCountdown}s
                      </strong>
                      ...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleSelectEpisode(nextEpisode, 0);
                        setNextEpisodeCountdown(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors shadow"
                    >
                      Phát ngay
                    </button>
                    <button
                      onClick={() => setNextEpisodeCountdown(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 p-6 text-center shadow-lg">
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
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {isMovie ? "Bắt đầu xem" : "Phát tập 1"}
              </button>
            </div>
          )}

          {/* Episode & Season Controls Section */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-5 sm:p-6 border border-zinc-200/70 dark:border-zinc-800/70 space-y-5">
            {/* 1. Franchise Season Selector (if multi-season franchise discovered) */}
            {franchiseSeasons.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
                <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1 mr-1">
                  <Layers className="h-3.5 w-3.5 text-violet-500" />
                  Mùa phim:
                </span>
                {franchiseSeasons.map((fs) => {
                  const isCurrent = fs.slug === movie.slug;
                  return (
                    <Link
                      key={fs.slug}
                      href={`/phim/${fs.slug}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                          : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600 border border-zinc-200 dark:border-zinc-700/80"
                      }`}
                    >
                      {fs.name} {isCurrent && "✓"}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 2. Audio Track / Server selector tabs (Vietsub, Thuyết minh, Lồng tiếng) */}
            {servers.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <span className="text-xs font-semibold text-zinc-500 mr-1">
                  Bản dịch / Nguồn:
                </span>
                {servers.map((server, sIdx) => (
                  <button
                    key={server.server_name}
                    onClick={() => {
                      setActiveServerIndex(sIdx);
                      // Preserve matching episode in new server
                      const targetServer = servers[sIdx];
                      if (targetServer && targetServer.items && activeEpisode) {
                        const curName = activeEpisode.name;
                        const curSlug = activeEpisode.slug;
                        const curNum = parseInt(curName.replace(/\D/g, ""), 10);
                        const match = targetServer.items.find((e) => {
                          if (e.slug === curSlug || e.name === curName) return true;
                          if (e.slug.toLowerCase() === curSlug.toLowerCase()) return true;
                          const eNum = parseInt(e.name.replace(/\D/g, ""), 10);
                          return !isNaN(curNum) && !isNaN(eNum) && curNum === eNum;
                        });
                        if (match) {
                          setSelectedEpisodeSlug(match.slug);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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

            {/* 3. Episode Selector */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5 text-violet-500" />
                  Danh sách tập ({episodeItems.length} tập)
                </h4>

                {/* Chunk selector tabs for series with > 30 episodes */}
                {episodeChunks.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                    {episodeChunks.map((chunk, cIdx) => (
                      <button
                        key={chunk.label}
                        onClick={() => setActiveChunkIndex(cIdx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                          activeChunkIndex === cIdx
                            ? "bg-violet-600/15 text-violet-600 dark:text-violet-400 border border-violet-500/30"
                            : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                      >
                        {chunk.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Episode Grid */}
              <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pr-1">
                {visibleEpisodes.map((ep) => {
                  const isActive = ep.slug === activeEpisodeSlug;
                  const watchedSeconds = episodeProgressStore.get(
                    movie.slug,
                    ep.slug,
                    currentSeason
                  );

                  return (
                    <button
                      key={ep.slug}
                      onClick={() => handleSelectEpisode(ep, watchedSeconds || 0)}
                      className={`
                        relative min-w-[46px] rounded-xl px-3.5 py-2 text-xs font-bold transition-all
                        ${
                          isActive
                            ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105"
                            : "bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600 border border-zinc-200 dark:border-zinc-700/60"
                        }
                      `}
                      title={
                        watchedSeconds > 0
                          ? `Đã xem đến ${formatTime(watchedSeconds)}`
                          : `Tập ${ep.name}`
                      }
                    >
                      {ep.name}
                      {watchedSeconds > 15 && !isActive && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Synopsis & Cast & Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Area: Synopsis & Cast & Comments */}
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

            {/* Comments Component */}
            <MovieComments movieSlug={movie.slug} />
          </div>

          {/* Sidebar Area: Detailed Technical Metadata */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
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

                {movie.imdb_id && (
                  <div className="flex justify-between gap-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                    <dt className="text-zinc-500">IMDb ID:</dt>
                    <dd className="font-mono font-bold text-amber-500">
                      {movie.imdb_id}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* ── 4. Similar Movies (Clean Taxonomy Mapping) ── */}
        <SimilarMovies
          genreName={parsed.genres[0]}
          currentSlug={movie.slug}
        />
      </div>
    </main>
  );
}
