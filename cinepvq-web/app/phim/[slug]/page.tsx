"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFetchMovieDetail } from "@/hooks/useMovies";
import { searchMovies } from "@/services/api";
import { extractCategoriesFromMovie, type MovieEnrichmentData } from "@/types/movie";
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
  Eye,
  Star,
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

function formatCompactViews(views: number): string {
  if (!views || views <= 0) return "0";
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return views.toLocaleString("vi-VN");
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

  const isWatching =
    mode !== "mini" &&
    Boolean(
      isWatchingManual ||
      searchParams.get("watch") === "true" ||
      searchParams.get("ep") ||
      (session && session.movieSlug === slug && mode === "detail")
    );

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

  // Optional: Discover other seasons of the same franchise
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

  // ─── Progressive Enrichment & Live Ratings/Views Query ───────────────────
  const { data: enriched, isFetching: isEnriching } = useQuery<MovieEnrichmentData | null>({
    queryKey: ["movie-enrichment", movie?.slug || slug],
    queryFn: async () => {
      const mSlug = movie?.slug || slug;
      if (!mSlug) return null;
      const params = new URLSearchParams();
      if (movie?.name) params.set("title", movie.name);
      if (movie?.original_name) params.set("originalTitle", movie.original_name);
      if (parsed.year) params.set("year", String(parsed.year));
      params.set("type", isMovie ? "movie" : "series");
      if (movie?.imdb_id) params.set("imdbId", movie.imdb_id);
      if (movie?.tmdb_id) params.set("tmdbId", String(movie.tmdb_id));
      if (movie?.thumb_url) params.set("thumbUrl", movie.thumb_url);
      if (movie?.poster_url) params.set("posterUrl", movie.poster_url);

      const res = await fetch(`/api/movies/${encodeURIComponent(mSlug)}/enrich?${params.toString()}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.data as MovieEnrichmentData) || null;
    },
    enabled: Boolean(movie && (movie.slug || slug)),
    staleTime: 2 * 60 * 1000,
  });

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

  // ─── Purely Derived Active Episode (User selection takes Priority #1) ────
  const activeEpisode = useMemo(() => {
    if (episodeItems.length === 0) return null;

    // 1. User clicked an episode directly (MUST take priority #1 so episode switch is instant)
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

    // 2. Active global player session for this movie
    if (session && session.movieSlug === (movie?.slug || slug) && session.episodeSlug) {
      const found =
        episodeItems.find((e) => e.slug === session.episodeSlug) ||
        episodeItems.find((e) => {
          const sNum = parseInt((session.episodeSlug || "").replace(/\D/g, ""), 10);
          const eNum = parseInt(e.slug.replace(/\D/g, ""), 10) || parseInt(e.name.replace(/\D/g, ""), 10);
          return !isNaN(sNum) && !isNaN(eNum) && sNum === eNum;
        });
      if (found) return found;
    }

    // 3. URL parameter ?ep=tap-X
    const urlEpSlug = searchParams.get("ep") || searchParams.get("episode");
    if (urlEpSlug) {
      const found = episodeItems.find(
        (e) => e.slug === urlEpSlug || e.name === urlEpSlug || e.slug === `tap-${urlEpSlug}`
      );
      if (found) return found;
    }

    // 4. Saved history episode
    if (savedHistory?.episodeSlug) {
      const found = episodeItems.find((e) => e.slug === savedHistory.episodeSlug);
      if (found) return found;
    }

    // 5. Default: First episode
    return episodeItems[0] || null;
  }, [episodeItems, selectedEpisodeSlug, session, movie?.slug, slug, searchParams, savedHistory]);

  const currentVideoUrl = activeEpisode?.embed || activeEpisode?.m3u8 || "";
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
    const navbarHeight = 70;
    const isVisible = rect.top >= navbarHeight - 30 && rect.top <= window.innerHeight * 0.45;
    if (!isVisible) {
      const targetY = window.scrollY + rect.top - navbarHeight;
      window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
    }
  }, []);

  // When expanding from mini player to detail mode, ensure watching view and scroll into view
  useEffect(() => {
    if (expandScrollTrigger > 0) {
      setIsWatchingManual(true);
      setTimeout(() => {
        scrollToPlayer();
      }, 100);
    }
  }, [expandScrollTrigger, scrollToPlayer]);

  // Synchronize selectedEpisodeSlug ONLY when session.episodeSlug itself changes (e.g. from mini-player auto-advance)
  useEffect(() => {
    if (session?.movieSlug === (movie?.slug || slug) && session?.episodeSlug) {
      setSelectedEpisodeSlug(session.episodeSlug);
    }
  }, [session?.movieSlug, session?.episodeSlug, movie?.slug, slug]);

  // Keep active chunk synced with activeEpisodeSlug
  useEffect(() => {
    if (episodeChunks.length > 0 && activeEpisodeSlug) {
      const epIdx = episodeItems.findIndex((e) => e.slug === activeEpisodeSlug);
      if (epIdx >= 0) {
        const chunkIdx = Math.floor(epIdx / CHUNK_SIZE);
        setActiveChunkIndex(chunkIdx);
      }
    }
  }, [activeEpisodeSlug, episodeChunks.length, episodeItems]);

  // ─── Select Episode Handler ──────────────────────────────────────────────
  const handleSelectEpisode = useCallback(
    (ep: EpisodeItem, initialSeek?: number) => {
      if (!startEpisodeTransition(ep.slug)) {
        return;
      }

      // Flush current playing episode progress to disk/store before switching
      flushCurrentEpisodeProgress();
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }

      setMode("detail");
      setIsWatchingManual(true);
      setNextEpisodeCountdown(null);
      setSelectedEpisodeSlug(ep.slug);

      // Resolve resume progress strictly for the target episode
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

      if (episodeChunks.length > 0) {
        const epIdx = episodeItems.findIndex((e) => e.slug === ep.slug);
        if (epIdx >= 0) {
          setActiveChunkIndex(Math.floor(epIdx / CHUNK_SIZE));
        }
      }

      const normalizedName = normalizeEpisodeLabel(ep.name, ep.slug);

      if (movie) {
        addHistory(movie, { slug: ep.slug, name: normalizedName }, targetSaved);

        // Immediately update GlobalPlayerSession in the same event tick so activeEpisode & player sync at 0ms
        startPlayback({
          videoUrl: ep.embed || ep.m3u8 || "",
          knownHlsUrl: ep.m3u8,
          movieSlug: mSlug,
          movieTitle: movie.name || movie.original_name,
          imdbId: movie.imdb_id || enriched?.imdbId || undefined,
          tmdbId: movie.tmdb_id ? String(movie.tmdb_id) : enriched?.tmdbId || undefined,
          season: currentSeason,
          episode:
            parseInt(ep.name.replace(/\D/g, ""), 10) ||
            parseInt(ep.slug.replace(/\D/g, ""), 10) ||
            1,
          episodeTitle: normalizedName,
          serverName: currentServer?.server_name || "Vietsub",
          episodeSlug: ep.slug,
          type: isMovie ? "movie" : "series",
          poster: movie.poster_url || movie.thumb_url,
          initialTime: targetSaved,
          autoPlay: true,
          episodes: episodeItems.map((e) => ({
            name: normalizeEpisodeLabel(e.name, e.slug),
            slug: e.slug,
            embed: e.embed,
            m3u8: e.m3u8,
          })),
          currentEpisodeIndex: episodeItems.findIndex((e) => e.slug === ep.slug),
        });
      }

      // Shallow URL sync (?ep=tap-X) without full navigation
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ep", ep.slug);
        window.history.replaceState(null, "", url.toString());
      }

      const isFs = isElementInFullscreen();
      if (!isFs) {
        setTimeout(() => {
          scrollToPlayer();
        }, 120);
      }
    },
    [
      startEpisodeTransition,
      flushCurrentEpisodeProgress,
      videoRef,
      setMode,
      movie,
      slug,
      currentSeason,
      episodeItems,
      episodeChunks.length,
      addHistory,
      startPlayback,
      enriched?.imdbId,
      enriched?.tmdbId,
      currentServer,
      isMovie,
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
      const curTime = video && video.currentTime > 0 ? video.currentTime : currentTime || 0;

      // 2. Map current episode to target server
      if (!activeEpisode) return;
      const curSlug = activeEpisode.slug;
      const curName = activeEpisode.name;
      const curNum =
        parseInt(curName.replace(/\D/g, ""), 10) ||
        parseInt(curSlug.replace(/\D/g, ""), 10);

      const targetItems = targetServer.items || [];
      const matchedEp =
        targetItems.find((e) => e.slug === curSlug) ||
        targetItems.find((e) => e.slug.toLowerCase() === curSlug.toLowerCase()) ||
        targetItems.find((e) => e.name === curName) ||
        targetItems.find((e) => e.name.toLowerCase() === curName.toLowerCase()) ||
        (isNaN(curNum)
          ? targetItems[0]
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
        return;
      }

      // 3. Always show audio desync warning when switching between different translation servers
      if (oldServer.server_name !== targetServer.server_name) {
        setPendingAudioWarning(true);
      }

      // 4. Set resume override specifically for target matched episode slug
      setPendingResumeOverride({
        episodeSlug: matchedEp.slug,
        time: curTime,
      });
      setActiveServerIndex(targetIndex);
      setSelectedEpisodeSlug(matchedEp.slug);

      // 5. Immediately switch GlobalPlayerSession to the new server's stream while preserving curTime
      if (movie) {
        const mSlug = movie.slug || slug;
        const normalizedName = normalizeEpisodeLabel(matchedEp.name, matchedEp.slug);
        startPlayback({
          videoUrl: matchedEp.embed || matchedEp.m3u8 || "",
          knownHlsUrl: matchedEp.m3u8,
          movieSlug: mSlug,
          movieTitle: movie.name || movie.original_name,
          imdbId: movie.imdb_id || enriched?.imdbId || undefined,
          tmdbId: movie.tmdb_id ? String(movie.tmdb_id) : enriched?.tmdbId || undefined,
          season: currentSeason,
          episode:
            parseInt(matchedEp.name.replace(/\D/g, ""), 10) ||
            parseInt(matchedEp.slug.replace(/\D/g, ""), 10) ||
            1,
          episodeTitle: normalizedName,
          serverName: targetServer.server_name,
          episodeSlug: matchedEp.slug,
          type: isMovie ? "movie" : "series",
          poster: movie.poster_url || movie.thumb_url,
          initialTime: curTime,
          autoPlay: true,
          episodes: targetItems.map((e) => ({
            name: normalizeEpisodeLabel(e.name, e.slug),
            slug: e.slug,
            embed: e.embed,
            m3u8: e.m3u8,
          })),
          currentEpisodeIndex: targetItems.findIndex((e) => e.slug === matchedEp.slug),
        });
      }
    },
    [
      activeServerIndex,
      servers,
      videoRef,
      currentTime,
      activeEpisode,
      setPendingAudioWarning,
      movie,
      slug,
      startPlayback,
      enriched?.imdbId,
      enriched?.tmdbId,
      currentSeason,
      isMovie,
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
      if (episodeTransition.isTransitioning) return;
      if (cur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 5) {
        lastSavedTimeRef.current = cur;
        const currentEp = episodeItems.find((e) => e.slug === activeEpisodeSlug);
        if (currentEp && movie) {
          addHistory(
            movie,
            {
              slug: currentEp.slug,
              name: normalizeEpisodeLabel(currentEp.name, currentEp.slug),
            },
            cur,
            dur
          );
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
    setMode("detail");
    setIsWatchingManual(true);
    if (episodeItems.length > 0) {
      handleSelectEpisode(episodeItems[0], 0);
    }
    setTimeout(() => {
      scrollToPlayer();
    }, 150);
  }, [episodeItems, handleSelectEpisode, scrollToPlayer, setMode]);

  const handleResumeWatching = useCallback(() => {
    setMode("detail");
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
  }, [savedHistory, episodeItems, movie?.slug, currentSeason, handleSelectEpisode, handleWatchNow, scrollToPlayer, setMode]);

  const handleShare = useCallback(() => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, []);

  // ─── Global Player Synchronization (Initial load via ?watch=true or ?ep=...) ─
  useEffect(() => {
    if (!isWatching || !movie || !activeEpisode || !currentVideoUrl) return;

    const targetServerName = currentServer?.server_name || "Vietsub";
    if (
      session?.movieSlug === (movie.slug || slug) &&
      session?.episodeSlug === activeEpisodeSlug &&
      session?.videoUrl === currentVideoUrl &&
      session?.serverName === targetServerName
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

    const normalizedName = normalizeEpisodeLabel(activeEpisode.name, activeEpisodeSlug);

    startPlayback({
      videoUrl: currentVideoUrl,
      knownHlsUrl: activeEpisode.m3u8,
      movieSlug: movie.slug || slug,
      movieTitle: movie.name || movie.original_name,
      imdbId: movie.imdb_id || enriched?.imdbId || undefined,
      tmdbId: movie.tmdb_id ? String(movie.tmdb_id) : enriched?.tmdbId || undefined,
      season: currentSeason,
      episode:
        parseInt(activeEpisode.name.replace(/\D/g, ""), 10) ||
        parseInt(activeEpisodeSlug.replace(/\D/g, ""), 10) ||
        1,
      episodeTitle: normalizedName,
      serverName: targetServerName,
      episodeSlug: activeEpisodeSlug,
      type: isMovie ? "movie" : "series",
      poster: movie.poster_url || movie.thumb_url,
      initialTime: resumeTime,
      autoPlay: shouldAutoPlay,
      episodes: episodeItems.map((e) => ({
        name: normalizeEpisodeLabel(e.name, e.slug),
        slug: e.slug,
        embed: e.embed,
        m3u8: e.m3u8,
      })),
      currentEpisodeIndex: episodeItems.findIndex((e) => e.slug === activeEpisodeSlug),
    });
  }, [
    isWatching,
    movie,
    slug,
    activeEpisode,
    activeEpisodeSlug,
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
    enriched?.imdbId,
    enriched?.tmdbId,
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
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-violet-500 transition-colors"
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

  // Merge initial static cast with enriched cast
  const castList = (() => {
    const initialNames = movie.casts
      ? movie.casts
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c && !/^(đang cập nhật|n\/a)$/i.test(c))
      : [];
    const enrichedNames = enriched?.casts?.map((c) => c.name).filter(Boolean) || [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...enrichedNames, ...initialNames]) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    return out;
  })();

  const directorList = (() => {
    const rawDirector = enriched?.director || movie.director || "";
    return rawDirector
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d && !/^(đang cập nhật|n\/a)$/i.test(d));
  })();

  const imdbScore = enriched?.ratings?.imdb?.score || movie.imdb?.vote_average || null;
  const doubanScore = enriched?.ratings?.douban?.score || movie.douban?.score || null;
  const tmdbScore =
    enriched?.ratings?.tmdb?.score ||
    (movie.tmdb?.vote_average ? Number(movie.tmdb.vote_average.toFixed(1)) : null);
  const totalAggregatedViews = enriched?.views?.total || movie.view || 0;

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
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-top opacity-35 scale-105"
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
                  fetchPriority="high"
                  decoding="async"
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
                    <span className="rounded-md bg-white/15 px-2.5 py-1 text-zinc-200">
                      {movie.current_episode}
                    </span>
                  )}
                  {parsed.year && (
                    <span className="rounded-md bg-white/10 px-2.5 py-1 text-zinc-300">
                      {parsed.year}
                    </span>
                  )}
                  {movie.time && (
                    <span className="rounded-md bg-white/10 px-2.5 py-1 text-zinc-300 flex items-center gap-1">
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

                {/* Real-time Enriched Ratings & Multi-Platform Views Bar */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
                  {imdbScore && imdbScore > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 font-bold text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>IMDb {imdbScore.toFixed(1)}</span>
                    </span>
                  ) : null}

                  {doubanScore && doubanScore > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 font-bold text-emerald-300">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-[10px] font-black text-zinc-950">
                        豆
                      </span>
                      <span>Douban {doubanScore.toFixed(1)}</span>
                    </span>
                  ) : null}

                  {tmdbScore && tmdbScore > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 px-2.5 py-1 font-bold text-sky-300">
                      <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                      <span>TMDB {tmdbScore.toFixed(1)}</span>
                    </span>
                  ) : null}

                  {totalAggregatedViews > 0 ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/15 px-2.5 py-1 font-semibold text-zinc-200"
                      title={
                        enriched?.views?.sources
                          ? `Tổng hợp đa nền tảng: ${enriched.views.sources
                              .map((s) => `${s.platform}: ${s.views.toLocaleString("vi-VN")}`)
                              .join(" • ")}`
                          : "Tổng lượt xem đa nền tảng"
                      }
                    >
                      <Eye className="h-3.5 w-3.5 text-violet-400" />
                      <span>{formatCompactViews(totalAggregatedViews)} lượt xem</span>
                    </span>
                  ) : null}

                  {isEnriching && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 px-2.5 py-1 text-[11px] font-medium text-violet-300 animate-pulse">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Đang cập nhật điểm &amp; lượt xem đa nền tảng...</span>
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
                    <Link
                      key={genre}
                      href={`/tim-kiem?genre=${encodeURIComponent(genre)}`}
                      className="rounded-full bg-white/10 hover:bg-violet-600/40 px-3 py-1 text-xs font-medium text-zinc-200 transition-colors"
                    >
                      {genre}
                    </Link>
                  ))}
                  {parsed.countries.map((country) => (
                    <Link
                      key={country}
                      href={`/tim-kiem?country=${encodeURIComponent(country)}`}
                      className="rounded-full bg-white/10 hover:bg-violet-600/40 px-3 py-1 text-xs font-medium text-zinc-200 flex items-center gap-1 transition-colors"
                    >
                      <Globe className="h-3 w-3" />
                      {country}
                    </Link>
                  ))}
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-3 flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3">
                  {hasResumeProgress ? (
                    <>
                      <button
                        onClick={handleResumeWatching}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        <span>
                          Tiếp tục xem{" "}
                          {savedHistory?.episodeName
                            ? `(${normalizeEpisodeLabel(savedHistory.episodeName, savedHistory.episodeSlug)})`
                            : ""}
                        </span>
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
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold active:scale-95 transition-colors ${
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
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold active:scale-95 transition-colors ${
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

          {/* ── STATE 1 Content: Thông tin phim, Diễn viên, Đánh giá đa nền tảng ── */}
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

                {/* Clickable Cast List */}
                <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <User className="h-5 w-5 text-violet-500" />
                      Diễn Viên &amp; Đạo Diễn
                    </h3>
                    {isEnriching && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-violet-500 font-medium">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Đang đồng bộ danh sách diễn viên...
                      </span>
                    )}
                  </div>

                  {castList.length > 0 || directorList.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5">
                      {directorList.map((director) => (
                        <Link
                          key={`dir-${director}`}
                          href={`/dien-vien/${encodeURIComponent(director)}`}
                          className="group flex items-center gap-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 border border-amber-500/30 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors shadow-sm"
                          title={`Xem danh sách phim của đạo diễn ${director}`}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
                            ĐD
                          </div>
                          <span className="group-hover:underline">{director}</span>
                        </Link>
                      ))}
                      {castList.map((actor) => (
                        <Link
                          key={actor}
                          href={`/dien-vien/${encodeURIComponent(actor)}`}
                          className="group flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 px-3.5 py-2 border border-zinc-200/60 dark:border-zinc-700/60 hover:border-violet-500 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-sm"
                          title={`Xem toàn bộ phim của diễn viên ${actor}`}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/10 group-hover:bg-white/20 text-violet-600 group-hover:text-white text-[10px] font-bold transition-colors">
                            {actor.charAt(0)}
                          </div>
                          <span>{actor}</span>
                        </Link>
                      ))}
                    </div>
                  ) : isEnriching ? (
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Thông tin diễn viên đang được cập nhật.
                    </p>
                  )}
                </section>

                {/* Comments Component */}
                <MovieComments movieSlug={movie.slug} />
              </div>

              {/* Sidebar Area: Detailed Technical Metadata & Multi-platform Stats */}
              <div className="space-y-6">
                <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      Thông Tin &amp; Xếp Hạng
                    </span>
                    {isEnriching && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-violet-500" />
                    )}
                  </h3>

                  {/* Multi-platform View Breakdown Card */}
                  {(totalAggregatedViews > 0 || isEnriching) && (
                    <div className="rounded-xl bg-white dark:bg-zinc-950/70 p-3.5 border border-zinc-200/70 dark:border-zinc-800/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-violet-500" />
                          Tổng lượt xem:
                        </span>
                        <span className="font-extrabold text-sm text-violet-600 dark:text-violet-400">
                          {totalAggregatedViews > 0
                            ? totalAggregatedViews.toLocaleString("vi-VN")
                            : "Đang tải..."}
                        </span>
                      </div>

                      {enriched?.views?.sources && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
                          {enriched.views.sources.map((src) => (
                            <div
                              key={src.platform}
                              className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded-lg"
                            >
                              <span className="text-zinc-500 truncate">{src.platform}</span>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {formatCompactViews(src.views)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <dl className="space-y-3 text-xs">
                    {directorList.length > 0 && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-zinc-500">Đạo diễn:</dt>
                        <dd className="font-semibold text-zinc-800 dark:text-zinc-200 text-right flex flex-wrap justify-end gap-1">
                          {directorList.map((dir, i) => (
                            <Link
                              key={dir}
                              href={`/dien-vien/${encodeURIComponent(dir)}`}
                              className="hover:text-violet-500 hover:underline"
                            >
                              {dir}
                              {i < directorList.length - 1 ? "," : ""}
                            </Link>
                          ))}
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

                    {(imdbScore || movie.imdb_id || enriched?.imdbId) && (
                      <div className="flex justify-between gap-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                        <dt className="text-zinc-500">Điểm IMDb:</dt>
                        <dd className="font-bold text-amber-500">
                          {imdbScore ? `★ ${imdbScore.toFixed(1)} / 10` : movie.imdb_id || enriched?.imdbId}
                        </dd>
                      </div>
                    )}

                    {(doubanScore || enriched?.doubanId) && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-zinc-500">Điểm Douban:</dt>
                        <dd className="font-bold text-emerald-500">
                          {doubanScore ? `★ ${doubanScore.toFixed(1)} / 10` : `ID: ${enriched?.doubanId}`}
                        </dd>
                      </div>
                    )}

                    {tmdbScore && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-zinc-500">Điểm TMDB:</dt>
                        <dd className="font-bold text-sky-500">
                          ★ {tmdbScore.toFixed(1)} / 10
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
        /* ── STATE 2: Đang xem phim (Player nằm ngay trên cùng) ── */
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
                                activeEpisode?.name,
                                activeEpisodeSlug
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
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600/10 hover:bg-violet-600 text-violet-600 hover:text-white dark:text-violet-300 dark:hover:text-white px-3.5 py-1.5 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                      >
                        <span>
                          Tập tiếp theo ({normalizeEpisodeLabel(nextEpisode.name, nextEpisode.slug)})
                        </span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-Source Video Player Host Slot */}
                <div
                  id="cinepvq-player-slot"
                  className="relative w-full space-y-2 overflow-visible"
                >
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
                        Tập tiếp theo (
                        <strong>{normalizeEpisodeLabel(nextEpisode.name, nextEpisode.slug)}</strong>) sẽ
                        tự động phát sau{" "}
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
              {/* 1. Franchise Season Selector */}
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
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
                    const label = normalizeEpisodeLabel(ep.name, ep.slug);

                    return (
                      <button
                        key={ep.slug}
                        onClick={() => handleSelectEpisode(ep, watchedSeconds || 0)}
                        className={`
                          relative min-w-[46px] rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer
                          ${
                            isActive
                              ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105 opacity-100 grayscale-0 z-10"
                              : isWatched
                              ? "opacity-75 bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 hover:opacity-100 hover:text-violet-600 border border-zinc-200/60 dark:border-zinc-800/60"
                              : "bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600 border border-zinc-200 dark:border-zinc-700/60"
                          }
                        `}
                        title={
                          isWatched
                            ? `Đã xem đến ${formatTime(watchedSeconds)}`
                            : label
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* In State 2: Actors, Comments and Similar Movies */}
          <div className="space-y-8">
            {(castList.length > 0 || directorList.length > 0) && (
              <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 sm:p-8 border border-zinc-200/60 dark:border-zinc-800/60 space-y-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <User className="h-5 w-5 text-violet-500" />
                  Diễn Viên &amp; Đạo Diễn
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {directorList.map((director) => (
                    <Link
                      key={`watch-dir-${director}`}
                      href={`/dien-vien/${encodeURIComponent(director)}`}
                      className="group flex items-center gap-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 border border-amber-500/30 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors shadow-sm"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
                        ĐD
                      </div>
                      <span className="group-hover:underline">{director}</span>
                    </Link>
                  ))}
                  {castList.map((actor) => (
                    <Link
                      key={actor}
                      href={`/dien-vien/${encodeURIComponent(actor)}`}
                      className="group flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 px-3.5 py-2 border border-zinc-200/60 dark:border-zinc-700/60 hover:border-violet-500 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-sm"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/10 group-hover:bg-white/20 text-violet-600 group-hover:text-white text-[10px] font-bold transition-colors">
                        {actor.charAt(0)}
                      </div>
                      <span>{actor}</span>
                    </Link>
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
