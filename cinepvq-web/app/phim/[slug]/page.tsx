"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFetchMovieDetail } from "@/hooks/useMovies";
import { searchMovies } from "@/services/api";
import { extractCategoriesFromMovie } from "@/types/movie";
import { useUserStore } from "@/hooks/useUserStore";
import {
  useGlobalPlayer,
  normalizeAudioTrackKind,
  type AudioServerInfo,
} from "@/contexts/GlobalPlayerContext";
import { episodeProgressStore } from "@/services/userStore";
import SimilarMovies from "@/components/MovieDetail/SimilarMovies";
import MovieComments from "@/components/MovieDetail/MovieComments";
import { MovieDetailSkeleton } from "@/components/Skeleton";
import {
  Play,
  Heart,
  Bookmark,
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
import { normalizeEpisodeLabel } from "@/lib/format";

// ─── Helper Functions ────────────────────────────────────────────────────────

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

function isElementInFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
      (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
  );
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
  const {
    isFavorite,
    toggleFavorite,
    isWatchlist,
    toggleWatchlist,
    addHistory,
    history,
    mounted,
    settings,
  } = useUserStore();
  const {
    session,
    mode,
    startPlayback,
    setMode,
    registerEpisodeHandlers,
    expandScrollTrigger,
    videoRef,
    currentTime,
    isPlaying,
    startEpisodeTransition,
    flushCurrentEpisodeProgress,
    registerServerHandlers,
    setPendingAudioWarning,
    episodeTransition,
  } = useGlobalPlayer();

  // User-selected Episode & Server states
  const [selectedEpisodeSlug, setSelectedEpisodeSlug] = useState<string | null>(null);
  const [activeServerIndex, setActiveServerIndex] = useState<number>(0);
  const [pendingResumeOverride, setPendingResumeOverride] = useState<{
    episodeSlug: string;
    time: number;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [isWatchingManual, setIsWatchingManual] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return Boolean(
        params.get("ep") ||
        window.location.hash === "#player" ||
        params.get("watch") === "true"
      );
    }
    return false;
  });

  const isWatching = isWatchingManual || Boolean(session && session.movieSlug === slug);

  // Auto-scroll to top instantly when watching to ensure player is in view
  useEffect(() => {
    if (isWatching) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [isWatching]);

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

  const hasResumeProgress = useMemo(() => {
    if (!savedHistory || !savedHistory.episodeSlug) return false;
    const epIndex = episodeItems.findIndex((e) => e.slug === savedHistory.episodeSlug);
    if (episodeItems.length > 0 && epIndex === -1) return false;

    const savedTime =
      episodeProgressStore.get(movie?.slug || "", savedHistory.episodeSlug, currentSeason) ||
      savedHistory.currentTime ||
      0;

    if (epIndex > 0) return true;
    return typeof savedTime === "number" && savedTime > 0;
  }, [savedHistory, episodeItems, movie?.slug, currentSeason]);

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

    // 1.5 Active global player session for this movie (keeps running episode intact)
    if (session && session.movieSlug === (movie?.slug || slug) && session.episodeSlug) {
      const found = episodeItems.find((e) => e.slug === session.episodeSlug);
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
  }, [episodeItems, selectedEpisodeSlug, session, movie?.slug, slug, searchParams, savedHistory]);

  const currentVideoUrl = activeEpisode?.embed || "";
  const activeEpisodeSlug = activeEpisode?.slug || "";

  // Initial resume time for VideoPlayer — keyed strictly by episode to prevent cross-episode leakage
  const movieSlug = movie?.slug;
  const resumeTime =
    pendingResumeOverride && pendingResumeOverride.episodeSlug === activeEpisodeSlug
      ? pendingResumeOverride.time
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

  // ─── Scroll to Player Helper (Respects fixed navbar and current visibility) ─
  const scrollToPlayer = useCallback(() => {
    const slot = document.getElementById("cinepvq-player-slot") || playerRef.current;
    if (!slot) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const rect = slot.getBoundingClientRect();
    const navbarHeight = 70; // 64px fixed Navbar + padding
    // If player is already nicely visible in viewport, do not cause sudden jump
    const isVisible = rect.top >= navbarHeight - 30 && rect.top <= window.innerHeight * 0.45;
    if (!isVisible) {
      const targetY = window.scrollY + rect.top - navbarHeight;
      window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
    }
  }, []);

  // ─── Select Episode Handler ──────────────────────────────────────────────
  const handleSelectEpisode = useCallback(
    (ep: EpisodeItem, initialSeek?: number) => {
      // Transition lock: ignore rapid multiple clicks during transition
      if (!startEpisodeTransition(ep.slug)) {
        return;
      }

      // Flush current playing episode progress to disk/store before switching
      flushCurrentEpisodeProgress();
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }

      setIsWatchingManual(true);
      setNextEpisodeCountdown(null);
      setSelectedEpisodeSlug(ep.slug);

      // Resolve resume progress for target episode:
      // Always compute target episode's saved time from store if initialSeek is omitted
      const mSlug = movie?.slug || slug;
      const targetSaved =
        typeof initialSeek === "number"
          ? initialSeek
          : mSlug && ep.slug
          ? episodeProgressStore.get(mSlug, ep.slug, currentSeason) || 0
          : 0;

      setPendingResumeOverride({
        episodeSlug: ep.slug,
        time: targetSaved,
      });
      lastSavedTimeRef.current = targetSaved;

      // Keep active chunk in sync
      if (episodeChunks.length > 0) {
        const epIdx = episodeItems.findIndex((e) => e.slug === ep.slug);
        if (epIdx >= 0) {
          const chunkIdx = Math.floor(epIdx / CHUNK_SIZE);
          setActiveChunkIndex(chunkIdx);
        }
      }

      if (movie) {
        const mSlug = movie.slug || slug;
        const targetTime =
          typeof initialSeek === "number"
            ? initialSeek
            : episodeProgressStore.get(mSlug, ep.slug, currentSeason) || 0;
        addHistory(movie, { slug: ep.slug, name: ep.name }, targetTime);
      }

      // Shallow URL sync (?ep=tap-X) without full navigation
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ep", ep.slug);
        window.history.replaceState(null, "", url.toString());
      }

      // Never jump scroll if user is already in fullscreen mode
      const isFs = isElementInFullscreen();
      if (!isFs) {
        setTimeout(() => {
          scrollToPlayer();
        }, 150);
      }
    },
    [
      startEpisodeTransition,
      flushCurrentEpisodeProgress,
      videoRef,
      movie,
      slug,
      currentSeason,
      episodeItems,
      episodeChunks,
      addHistory,
      scrollToPlayer,
    ]
  );

  // ─── Switch Server Handler (Vietsub, Thuyết minh, Lồng tiếng) ──────────────
  const handleSwitchServer = useCallback(
    (targetIndex: number) => {
      if (targetIndex === activeServerIndex) return;
      const oldServer = servers[activeServerIndex];
      const targetServer = servers[targetIndex];
      if (!targetServer || !oldServer) return;

      // 1. Capture current timestamp & playing state
      const video = videoRef.current;
      const curTime = video ? video.currentTime : currentTime || 0;

      // 2. Map current episode to target server
      if (!activeEpisode) return;
      const curSlug = activeEpisode.slug;
      const curName = activeEpisode.name;
      const curNum = parseInt(curName.replace(/\D/g, ""), 10);

      const targetItems = targetServer.items || [];
      const matchedEp =
        targetItems.find((e) => e.slug === curSlug) ||
        targetItems.find((e) => e.slug.toLowerCase() === curSlug.toLowerCase()) ||
        targetItems.find((e) => e.name === curName) ||
        targetItems.find((e) => e.name.toLowerCase() === curName.toLowerCase()) ||
        (isNaN(curNum)
          ? undefined
          : targetItems.find((e) => {
              const eNum =
                parseInt(e.name.replace(/\D/g, ""), 10) ||
                parseInt(e.slug.replace(/\D/g, ""), 10);
              return !isNaN(eNum) && eNum === curNum;
            }));

      if (!matchedEp) {
        console.warn(
          `[ServerSwitch] Không tìm thấy tập tương ứng trên server ${targetServer.server_name}`
        );
        return; // Không được âm thầm phát tập khác
      }

      // 3. Audio track kind change detection:
      // Warning appears when switching between different kinds: Vietsub <-> Thuyết minh <-> Lồng tiếng
      const oldKind = normalizeAudioTrackKind(oldServer.server_name);
      const targetKind = normalizeAudioTrackKind(targetServer.server_name);
      if (oldKind !== targetKind && oldKind !== "other" && targetKind !== "other") {
        setPendingAudioWarning(true);
      }

      // 4. Set resume override specifically for target matched episode slug
      setPendingResumeOverride({
        episodeSlug: matchedEp.slug,
        time: curTime,
      });

      setActiveServerIndex(targetIndex);
      setSelectedEpisodeSlug(matchedEp.slug);
    },
    [
      activeServerIndex,
      servers,
      videoRef,
      currentTime,
      activeEpisode,
      setPendingAudioWarning,
    ]
  );

  // Register available servers and switch callback with GlobalPlayer
  useEffect(() => {
    if (servers.length === 0) return;
    const serverInfos: AudioServerInfo[] = servers.map((s, idx) => ({
      index: idx,
      serverName: s.server_name,
      name: s.server_name,
      kind: normalizeAudioTrackKind(s.server_name),
    }));

    registerServerHandlers({
      servers: serverInfos,
      activeIndex: activeServerIndex,
      onSwitchServer: handleSwitchServer,
    });
  }, [servers, activeServerIndex, handleSwitchServer, registerServerHandlers]);

  // ─── Video Time Update ───────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(
    (cur: number, dur: number) => {
      // Transition lock guard: do not record progress while transitioning between episodes!
      if (episodeTransition.isTransitioning) return;
      // Only record progress when playback actually advances (> 0s) and moved at least 5s
      if (cur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 5) {
        lastSavedTimeRef.current = cur;
        const currentEp = episodeItems.find((e) => e.slug === activeEpisodeSlug);
        if (currentEp && movie) {
          addHistory(movie, { slug: currentEp.slug, name: currentEp.name }, cur, dur);
        }
      }
    },
    [episodeTransition.isTransitioning, episodeItems, activeEpisodeSlug, movie, addHistory]
  );

  // ─── Video Ended: Next Episode Countdown ─────────────────────────────────
  const currentEpIndex = episodeItems.findIndex((e) => e.slug === activeEpisodeSlug);
  const prevEpisode =
    currentEpIndex > 0 ? episodeItems[currentEpIndex - 1] : null;
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < episodeItems.length - 1
      ? episodeItems[currentEpIndex + 1]
      : null;

  const handleVideoEnded = useCallback(() => {
    // Only auto-advance if settings.autoPlay is enabled and nextEpisode exists
    if (settings?.autoPlay && nextEpisode) {
      setNextEpisodeCountdown(5);
    }
  }, [nextEpisode, settings?.autoPlay]);

  useEffect(() => {
    if (nextEpisodeCountdown === null) return;

    const timer = setTimeout(() => {
      if (nextEpisodeCountdown <= 1) {
        setNextEpisodeCountdown(null);
        if (nextEpisode) {
          handleSelectEpisode(nextEpisode);
        }
      } else {
        setNextEpisodeCountdown(nextEpisodeCountdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [nextEpisodeCountdown, nextEpisode, handleSelectEpisode]);

  // ─── Primary Hero Actions ────────────────────────────────────────────────
  const handleWatchNow = useCallback(() => {
    setIsWatchingManual(true);
    if (episodeItems.length > 0) {
      handleSelectEpisode(episodeItems[0], 0);
    }
    setTimeout(() => {
      scrollToPlayer();
    }, 150);
  }, [episodeItems, handleSelectEpisode, scrollToPlayer]);

  const handleResumeWatching = useCallback(() => {
    setIsWatchingManual(true);
    if (savedHistory?.episodeSlug) {
      const ep = episodeItems.find((e) => e.slug === savedHistory.episodeSlug);
      if (ep) {
        const savedTime =
          episodeProgressStore.get(movie?.slug || "", ep.slug, currentSeason) ||
          savedHistory.currentTime ||
          0;
        handleSelectEpisode(ep, savedTime);
        setTimeout(() => {
          scrollToPlayer();
        }, 150);
        return;
      }
    }
    handleWatchNow();
  }, [savedHistory, episodeItems, movie?.slug, currentSeason, handleSelectEpisode, handleWatchNow, scrollToPlayer]);

  const handleShare = useCallback(() => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, []);

  // ─── Global Player Synchronization ───────────────────────────────────────
  useEffect(() => {
    if (!isWatching || !movie || !activeEpisode || !currentVideoUrl) return;

    // If global player session is already active for this movie with the exact same episode, videoUrl, and server:
    if (
      session?.movieSlug === (movie.slug || slug) &&
      session?.episodeSlug === activeEpisodeSlug &&
      session?.videoUrl === currentVideoUrl &&
      session?.serverName === (currentServer?.server_name || "Vietsub")
    ) {
      if (mode !== "detail") {
        setMode("detail");
      }
      return;
    }

    const isEpisodeChange = session?.episodeSlug !== activeEpisodeSlug;
    const shouldAutoPlay = isEpisodeChange
      ? true
      : videoRef.current
      ? !videoRef.current.paused
      : isPlaying;

    startPlayback({
      videoUrl: currentVideoUrl,
      movieSlug: movie.slug || slug,
      movieTitle: movie.name || movie.original_name,
      imdbId: movie.imdb_id || undefined,
      season: currentSeason,
      episode:
        parseInt(
          episodeItems.find((e) => e.slug === activeEpisodeSlug)?.name || ""
        ) ||
        parseInt(activeEpisodeSlug.replace(/\D/g, "")) ||
        1,
      serverName: currentServer?.server_name || "Vietsub",
      episodeSlug: activeEpisodeSlug,
      type: isMovie ? "movie" : "series",
      poster: movie.poster_url || movie.thumb_url,
      initialTime: resumeTime,
      autoPlay: shouldAutoPlay,
      episodes: episodeItems.map((e) => ({
        name: e.name,
        slug: e.slug,
        embed: e.embed,
      })),
      currentEpisodeIndex: episodeItems.findIndex((e) => e.slug === activeEpisodeSlug),
    });
  }, [
    isWatching,
    movie,
    slug,
    activeEpisode,
    activeEpisodeSlug,
    selectedEpisodeSlug,
    currentVideoUrl,
    currentSeason,
    episodeItems,
    currentServer,
    isMovie,
    resumeTime,
    session?.movieSlug,
    session?.episodeSlug,
    session?.videoUrl,
    session?.serverName,
    mode,
    startPlayback,
    setMode,
    videoRef,
    isPlaying,
  ]);

  // Register episode navigation handlers with GlobalPlayer
  useEffect(() => {
    registerEpisodeHandlers({
      hasPrevEpisode: Boolean(prevEpisode),
      hasNextEpisode: Boolean(nextEpisode),
      onPrevEpisode: () => {
        if (prevEpisode) handleSelectEpisode(prevEpisode);
      },
      onNextEpisode: () => {
        if (nextEpisode) handleSelectEpisode(nextEpisode);
      },
      onTimeUpdate: handleTimeUpdate,
      onEnded: handleVideoEnded,
    });
  }, [
    prevEpisode,
    nextEpisode,
    handleSelectEpisode,
    handleTimeUpdate,
    handleVideoEnded,
    registerEpisodeHandlers,
  ]);

  // Scroll to player when expanding from mini player or restoring from native PiP
  useEffect(() => {
    if (!expandScrollTrigger) return;
    const timer = setTimeout(() => {
      scrollToPlayer();
    }, 150);
    return () => clearTimeout(timer);
  }, [expandScrollTrigger, scrollToPlayer]);

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
  const inWatchlist = mounted && isWatchlist(movie.slug);

  const castList = movie.casts
    ? movie.casts.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  return (
    <main className="flex-1 pb-20">
      {!isWatching ? (
        <>
          {/* ── 1. Hero Cinematic Banner ── */}
          <section className="relative w-full min-h-[50vh] overflow-hidden bg-zinc-950">
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
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-12 sm:pt-28 sm:pb-16 flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8">
          {/* Poster Card */}
          <div className="w-44 sm:w-56 md:w-64 aspect-[2/3] flex-shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 bg-zinc-900 group">
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
            <div className="pt-3 flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3">
              {/* Resume vs Watch Now button */}
              {hasResumeProgress ? (
                <>
                  <button
                    onClick={handleResumeWatching}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Tiếp tục xem</span>
                  </button>

                  <button
                    onClick={handleWatchNow}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-zinc-300 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Xem từ đầu</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleWatchNow}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Xem ngay</span>
                </button>
              )}

              {/* Favorite Button */}
              <button
                type="button"
                onClick={() => toggleFavorite(movie)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold backdrop-blur-md active:scale-95 transition-all ${
                  favorited
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} />
                <span>{favorited ? "Đã yêu thích" : "Yêu thích"}</span>
              </button>

              {/* Watchlist Button */}
              <button
                type="button"
                onClick={() => toggleWatchlist(movie)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold backdrop-blur-md active:scale-95 transition-all ${
                  inWatchlist
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${inWatchlist ? "fill-current" : ""}`} />
                <span>{inWatchlist ? "Đã lưu xem sau" : "Xem sau"}</span>
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                aria-label="Chia sẻ phim"
                className="inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
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

      {/* ── STATE 1 Content: Chưa bấm xem (Thông tin phim trước, KHÔNG mount Player, KHÔNG mount danh sách tập) ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-10">
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

          {/* Similar Movies */}
          <SimilarMovies
            genreName={parsed.genres[0]}
            currentSlug={movie.slug}
          />
        </div>
        </>
      ) : (
        /* ── STATE 2: Đang xem phim (Player nằm ngay trên cùng, KHÔNG có banner che khuất) ── */
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 space-y-8">
          <section ref={playerRef} className="space-y-4 scroll-mt-20 sm:scroll-mt-24">
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
                            : normalizeEpisodeLabel(
                                episodeItems.find((e) => e.slug === activeEpisodeSlug)?.name ||
                                activeEpisodeSlug.replace("tap-", "")
                              )}
                        </span>
                      </h3>
                      <span className="text-[11px] text-zinc-500">
                        {currentServer?.server_name || "Server chính"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Back to Movie Info toggle button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsWatchingManual(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                      title="Xem thông tin chi tiết phim"
                    >
                      <Film className="h-3.5 w-3.5 text-violet-500" />
                      <span>Thông tin phim</span>
                    </button>

                    {/* Next Episode Action Button */}
                    {nextEpisode && (
                      <button
                        onClick={() => handleSelectEpisode(nextEpisode)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600/10 hover:bg-violet-600 text-violet-600 hover:text-white dark:text-violet-300 dark:hover:text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <span>Tập tiếp theo ({normalizeEpisodeLabel(nextEpisode.name)})</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-Source Video Player Host Slot — represents entire player area: [Source toolbar] + [Video 16:9] */}
                <div
                  id="cinepvq-player-slot"
                  className="relative w-full space-y-2 overflow-visible"
                >
                  {/* Source Toolbar spacer: reserves exact height for active source badge & switcher */}
                  <div
                    className="flex items-center justify-between gap-2 px-1 text-xs min-h-[32px] sm:min-h-[36px] min-w-0 invisible pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 font-semibold border truncate max-w-[190px] sm:max-w-xs">
                        Nguồn phát: Đang tải...
                      </span>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 font-medium border whitespace-nowrap">
                        Đổi nguồn
                      </span>
                    </div>
                  </div>

                  {/* Video 16:9 viewport layout spacer (invisible to avoid ghost frame & black bar) */}
                  <div
                    className="relative w-full aspect-video pointer-events-none invisible select-none"
                    aria-hidden="true"
                  />
                </div>

                {/* Auto Next Episode Countdown Notification Banner */}
                {nextEpisodeCountdown !== null && nextEpisode && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-violet-600/15 border border-violet-500/30 text-xs shadow-md">
                    <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                      <Clock className="h-4 w-4 text-violet-500 dark:text-violet-400 animate-pulse" />
                      <span>
                        Tập tiếp theo (<strong>{normalizeEpisodeLabel(nextEpisode.name)}</strong>) sẽ tự động phát sau{" "}
                        <strong className="text-violet-600 dark:text-violet-400 text-sm">
                          {nextEpisodeCountdown}s
                        </strong>
                        ...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          handleSelectEpisode(nextEpisode);
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
                      onClick={() => handleSwitchServer(sIdx)}
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

              {/* 3. Episode Grid Section */}
              <div className="space-y-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    const isWatched = (watchedSeconds || 0) > 0;

                    return (
                      <button
                        key={ep.slug}
                        onClick={() => handleSelectEpisode(ep, watchedSeconds || 0)}
                        className={`
                          relative min-w-[46px] rounded-xl px-3.5 py-2 text-xs font-bold transition-all
                          ${
                            isActive
                              ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105 opacity-100 grayscale-0 z-10"
                              : isWatched
                              ? "opacity-70 grayscale-[25%] bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 hover:opacity-100 hover:grayscale-0 hover:text-violet-600 border border-zinc-200/60 dark:border-zinc-800/60"
                              : "bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600 border border-zinc-200 dark:border-zinc-700/60"
                          }
                        `}
                        title={
                          isWatched
                            ? `Đã xem đến ${formatTime(watchedSeconds)}`
                            : normalizeEpisodeLabel(ep.name)
                        }
                      >
                        {ep.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* In State 2: Actors, Comments and Similar Movies */}
          <div className="space-y-8">
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

            {/* Similar Movies */}
            <SimilarMovies
              genreName={parsed.genres[0]}
              currentSlug={movie.slug}
            />
          </div>
        </div>
      )}
    </main>
  );
}
