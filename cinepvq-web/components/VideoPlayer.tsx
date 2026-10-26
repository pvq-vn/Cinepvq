"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Sparkles,
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  Check,
  Tv,
  Info,
  X,
} from "lucide-react";
import {
  ResolvedSource,
  VideoSourceId,
  resolveAllSources,
} from "@/services/videoSources";
import CustomHlsPlayer from "@/components/CustomHlsPlayer";
import { useUserSettings } from "@/hooks/useUserStore";
import {
  AudioServerInfo,
  EpisodeTransitionState,
  normalizeAudioTrackKind,
} from "@/contexts/GlobalPlayerContext";

interface VideoPlayerProps {
  /** Fallback default embed URL (usually NguonC / KKPhim embed) */
  videoUrl: string;
  /** Optional known direct M3U8 URL from movie catalog */
  knownHlsUrl?: string;
  movieSlug?: string;
  movieTitle?: string;
  imdbId?: string;
  tmdbId?: string;
  season?: number;
  episode?: number;
  type?: "movie" | "series";
  poster?: string;
  /** Initial playback time in seconds (from Watch History) */
  initialTime?: number;
  /** Called periodically as video plays (only available on Direct HLS sources) */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Called when video finishes playing (only available on Direct HLS sources) */
  onEnded?: () => void;
  /** Selected server name (e.g., "Vietsub #1", "Thuyết Minh") */
  serverName?: string;
  /** Selected episode slug (e.g., "tap-01", "full") */
  episodeSlug?: string;
  /** Full episode list for background preloading of the next episode */
  episodes?: { name: string; slug: string; embed?: string; m3u8?: string }[];
  /** Previous / Next Episode Navigation */
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  /** Global player callbacks & mode */
  isMini?: boolean;
  autoPlay?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  sourceSwitchWarning?: boolean;
  onTriggerSourceWarning?: () => void;
  onDismissSourceWarning?: () => void;
  pendingAudioWarning?: boolean;
  onSetPendingAudioWarning?: (pending: boolean) => void;
  episodeTransition?: EpisodeTransitionState;
  onFinishEpisodeTransition?: (success: boolean) => void;
  availableServers?: AudioServerInfo[];
  activeServerIndex?: number;
  onSwitchServer?: (index: number) => void;
  onMinimize?: () => void;
  onExpand?: () => void;
}

function extractDirectHlsUrl(knownHlsUrl?: string, videoUrl?: string): string {
  if (knownHlsUrl && knownHlsUrl.includes(".m3u8")) {
    return knownHlsUrl.trim();
  }
  if (!videoUrl) return "";
  if (videoUrl.includes(".m3u8") && !videoUrl.includes("player/?url=")) {
    return videoUrl.trim();
  }
  try {
    const parsed = new URL(videoUrl);
    const inner = parsed.searchParams.get("url");
    if (inner && inner.includes(".m3u8")) {
      return inner.trim();
    }
  } catch {
    // Ignore malformed URL
  }
  return "";
}

function buildInstantKkphimSource(directHlsUrl: string, serverName?: string): ResolvedSource {
  const isTM = /thuy[eế]t\s*minh|\btm\b|l[oồ]ng\s*ti[eế]ng/i.test(serverName || "");
  const isLT = /l[oồ]ng\s*ti[eế]ng|\blt\b/i.test(serverName || "");
  return {
    sourceId: "kkphim",
    name: isLT
      ? "Server 3 (KKPhim1 - Lồng Tiếng)"
      : isTM
      ? "Server 3 (KKPhim1 - Thuyết Minh)"
      : "Server 3 (KKPhim1 - Vietsub)",
    displayName: isLT
      ? "Server 3 (Lồng Tiếng)"
      : isTM
      ? "Server 3 (Thuyết Minh)"
      : "Server 3 (Vietsub)",
    type: "hls",
    url: directHlsUrl,
    priority: 3,
    quality: "FHD",
    serverName: serverName || "KKPhim Direct",
    isAvailable: true,
  };
}

/**
 * Multi-Source Video Player Component
 * - Immediately plays direct HLS stream (`knownHlsUrl` / extracted `.m3u8`) in 0ms when available
 * - Resolves additional backup servers (`K20`, `VSMOV`, `NguonC`) in the background
 * - Preloads the next episode's video sources in the background
 * - Preserves exact playback position when switching translations (`Vietsub` / `Thuyết minh` / `Lồng tiếng`)
 */
export default function VideoPlayer({
  videoUrl,
  knownHlsUrl,
  movieSlug,
  movieTitle,
  imdbId,
  tmdbId,
  season = 1,
  episode = 1,
  type = "movie",
  poster,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
  serverName,
  episodeSlug,
  episodes,
  hasPrevEpisode = false,
  hasNextEpisode = false,
  onPrevEpisode,
  onNextEpisode,
  isMini = false,
  autoPlay = false,
  onPlayingChange,
  onVideoRef,
  sourceSwitchWarning = false,
  onTriggerSourceWarning,
  onDismissSourceWarning,
  pendingAudioWarning = false,
  onSetPendingAudioWarning,
  episodeTransition,
  onFinishEpisodeTransition,
  availableServers = [],
  activeServerIndex = 0,
  onSwitchServer,
  onMinimize,
  onExpand,
}: VideoPlayerProps) {
  const { settings, updateSettings } = useUserSettings();

  const directHlsUrl = useMemo(
    () => extractDirectHlsUrl(knownHlsUrl, videoUrl),
    [knownHlsUrl, videoUrl]
  );

  const instantHlsSource = useMemo(
    () => (directHlsUrl ? buildInstantKkphimSource(directHlsUrl, serverName) : null),
    [directHlsUrl, serverName]
  );

  const episodeKey = `${movieSlug || ""}|${season}|${episode}|${episodeSlug || ""}|${serverName || ""}|${videoUrl || ""}|${directHlsUrl}`;
  const episodeIdentity = `${movieSlug || ""}|${season}|${episodeSlug || episode}`;

  const [sources, setSources] = useState<ResolvedSource[]>(() =>
    instantHlsSource ? [instantHlsSource] : []
  );
  const [activeSourceId, setActiveSourceId] = useState<VideoSourceId | null>(() =>
    instantHlsSource ? "kkphim" : null
  );
  const [resolvedKey, setResolvedKey] = useState<string>("");
  const [isSearchingBackups, setIsSearchingBackups] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [failedSourceIds, setFailedSourceIds] = useState<Set<VideoSourceId>>(
    new Set()
  );

  // Track current playback position so switching sources/servers resumes seamlessly
  const [resumeTime, setResumeTime] = useState<number>(initialTime);
  const [currentAutoPlay, setCurrentAutoPlay] = useState<boolean>(autoPlay);
  const [prevEpisodeKey, setPrevEpisodeKey] = useState<string>(episodeKey);
  const [prevEpisodeIdentity, setPrevEpisodeIdentity] = useState<string>(episodeIdentity);
  const [prevInitialTime, setPrevInitialTime] = useState<number>(initialTime);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingLocallyRef = useRef<boolean>(autoPlay);
  const pendingAudioWarningRef = useRef<boolean>(false);
  const [localAudioWarning, setLocalAudioWarning] = useState<boolean>(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerLocalWarningToast = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setLocalAudioWarning(true);
    warningTimerRef.current = setTimeout(() => {
      setLocalAudioWarning(false);
      warningTimerRef.current = null;
    }, 4500);
  }, []);

  // Synchronously update state when episodeKey or initialTime changes
  if (episodeKey !== prevEpisodeKey || initialTime !== prevInitialTime) {
    const isNewEpisode = episodeIdentity !== prevEpisodeIdentity;
    setPrevEpisodeKey(episodeKey);
    setPrevEpisodeIdentity(episodeIdentity);
    setPrevInitialTime(initialTime);
    setResumeTime(initialTime);
    setCurrentAutoPlay(autoPlay);
    setFailedSourceIds(new Set());

    if (instantHlsSource) {
      setSources([instantHlsSource]);
      setActiveSourceId("kkphim");
    } else if (isNewEpisode) {
      setSources([]);
      setActiveSourceId(null);
    }
  }

  // Only block viewport on `isResolving` when we do NOT have an instant direct HLS stream
  const isResolving = resolvedKey !== episodeKey && !instantHlsSource;
  const displaySources = useMemo(() => {
    if (resolvedKey === episodeKey && sources.length > 0) {
      return sources;
    }
    if (instantHlsSource) {
      return [instantHlsSource];
    }
    return sources;
  }, [resolvedKey, episodeKey, sources, instantHlsSource]);

  const menuRef = useRef<HTMLDivElement>(null);
  const resolveRequestIdRef = useRef(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTimeUpdate = useCallback(
    (cur: number, dur: number) => {
      if (cur > 0) {
        setResumeTime(cur);
      }
      onTimeUpdate?.(cur, dur);
    },
    [onTimeUpdate]
  );

  const handleRegisterVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      onVideoRef?.(el);
    },
    [onVideoRef]
  );

  const flushPendingAudioWarning = useCallback(() => {
    if (pendingAudioWarning || pendingAudioWarningRef.current) {
      pendingAudioWarningRef.current = false;
      onSetPendingAudioWarning?.(false);
      triggerLocalWarningToast();
      onTriggerSourceWarning?.();
    }
  }, [
    pendingAudioWarning,
    onSetPendingAudioWarning,
    triggerLocalWarningToast,
    onTriggerSourceWarning,
  ]);

  // If pendingAudioWarning is turned on while video is already playing or after switch, fire it
  useEffect(() => {
    if (pendingAudioWarning) {
      pendingAudioWarningRef.current = true;
      const timer = setTimeout(() => {
        if (pendingAudioWarningRef.current) {
          flushPendingAudioWarning();
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [pendingAudioWarning, flushPendingAudioWarning]);

  const handlePlayingChangeInternal = useCallback(
    (playing: boolean) => {
      isPlayingLocallyRef.current = playing;
      onPlayingChange?.(playing);

      if (playing) {
        onFinishEpisodeTransition?.(true);
        flushPendingAudioWarning();
      }
    },
    [onPlayingChange, onFinishEpisodeTransition, flushPendingAudioWarning]
  );

  // 1. Resolve all available sources on episode / movie / server change
  useEffect(() => {
    const requestId = ++resolveRequestIdRef.current;
    let isCancelled = false;
    setIsSearchingBackups(true);

    resolveAllSources({
      slug: movieSlug,
      imdbId,
      tmdbId,
      title: movieTitle,
      season,
      episode,
      type,
      nguoncEmbedUrl: videoUrl,
      knownHlsUrl: directHlsUrl || undefined,
      serverName,
      episodeSlug,
    })
      .then((resolvedList) => {
        if (isCancelled || requestId !== resolveRequestIdRef.current) return;
        setIsSearchingBackups(false);

        const finalList = [...resolvedList];

        // Ensure instant direct HLS source is present
        if (
          instantHlsSource &&
          !finalList.some((s) => s.sourceId === "kkphim")
        ) {
          finalList.push(instantHlsSource);
        }

        // Ensure fallback embed is present if provided
        if (
          videoUrl &&
          !videoUrl.includes(".m3u8") &&
          !finalList.some((s) => s.sourceId === "nguonc")
        ) {
          const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(serverName || "");
          const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(serverName || "");

          finalList.push({
            sourceId: "nguonc",
            name: isTM
              ? "Server Dự Phòng (StreamC - Thuyết Minh)"
              : isLT
              ? "Server Dự Phòng (StreamC - Lồng Tiếng)"
              : "Server Dự Phòng (StreamC)",
            displayName: isTM
              ? "Server Dự Phòng (Thuyết Minh)"
              : isLT
              ? "Server Dự Phòng (Lồng Tiếng)"
              : "Server Dự Phòng",
            type: "iframe",
            url: videoUrl,
            priority: 4,
            quality: "FHD",
            serverName: serverName ? `StreamC (${serverName})` : "StreamC Iframe",
            isAvailable: true,
          });
        }

        finalList.sort((a, b) => a.priority - b.priority);
        setSources(finalList);
        setResolvedKey(episodeKey);

        if (finalList.length > 0) {
          const pref = settings?.preferredSource;
          const preferredMatch =
            pref && pref !== "auto"
              ? finalList.find((s) => s.sourceId === pref && s.isAvailable)
              : null;

          if (preferredMatch) {
            setActiveSourceId(preferredMatch.sourceId);
          } else if (
            instantHlsSource &&
            finalList.some((s) => s.sourceId === "kkphim")
          ) {
            // Keep playing the instant direct HLS stream without interrupting playback!
            setActiveSourceId((prev) => prev || "kkphim");
          } else {
            setActiveSourceId(finalList[0].sourceId);
          }
        }
      })
      .catch((err) => {
        if (isCancelled || requestId !== resolveRequestIdRef.current) return;
        setIsSearchingBackups(false);
        console.error("[MULTI-SOURCE] Resolution failed:", err);
        if (instantHlsSource) {
          setSources([instantHlsSource]);
          setActiveSourceId("kkphim");
        } else if (videoUrl) {
          const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(serverName || "");
          const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(serverName || "");

          const fallbackSource: ResolvedSource = {
            sourceId: "nguonc",
            name: isTM
              ? "Server Dự Phòng (StreamC - Thuyết Minh)"
              : isLT
              ? "Server Dự Phòng (StreamC - Lồng Tiếng)"
              : "Server Dự Phòng (StreamC)",
            displayName: isTM
              ? "Server Dự Phòng (Thuyết Minh)"
              : isLT
              ? "Server Dự Phòng (Lồng Tiếng)"
              : "Server Dự Phòng",
            type: "iframe",
            url: videoUrl,
            priority: 4,
            serverName: serverName ? `StreamC (${serverName})` : "StreamC Iframe",
            isAvailable: true,
          };
          setSources([fallbackSource]);
          setActiveSourceId("nguonc");
        }
        setResolvedKey(episodeKey);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    episodeKey,
    movieSlug,
    imdbId,
    tmdbId,
    movieTitle,
    season,
    episode,
    type,
    serverName,
    episodeSlug,
    videoUrl,
    directHlsUrl,
    instantHlsSource,
    settings?.preferredSource,
  ]);

  // Preload next episode's video sources in background 3.5s after current episode starts
  useEffect(() => {
    if (!episodes || episodes.length <= 1 || !episodeSlug || !movieSlug) return;
    const curIdx = episodes.findIndex((e) => e.slug === episodeSlug);
    if (curIdx < 0 || curIdx >= episodes.length - 1) return;
    const nextEp = episodes[curIdx + 1];
    if (!nextEp) return;

    const timer = setTimeout(() => {
      const nextHls = extractDirectHlsUrl(nextEp.m3u8, nextEp.embed);
      resolveAllSources({
        slug: movieSlug,
        imdbId,
        tmdbId,
        title: movieTitle,
        season,
        episode: parseInt(nextEp.name.replace(/\D/g, ""), 10) || curIdx + 2,
        type,
        nguoncEmbedUrl: nextEp.embed,
        knownHlsUrl: nextHls || undefined,
        serverName,
        episodeSlug: nextEp.slug,
      }).catch(() => {});
    }, 3500);

    return () => clearTimeout(timer);
  }, [episodes, episodeSlug, movieSlug, imdbId, tmdbId, movieTitle, season, type, serverName]);

  // Find active source object
  const activeSource =
    displaySources.find((s) => s.sourceId === activeSourceId) ||
    instantHlsSource ||
    displaySources[0] ||
    null;

  // Ensure iframe mode clears episode transition & flushes pending audio warning
  useEffect(() => {
    if (activeSource && activeSource.type === "iframe" && !isResolving) {
      onFinishEpisodeTransition?.(true);
      flushPendingAudioWarning();
    }
  }, [activeSource, isResolving, onFinishEpisodeTransition, flushPendingAudioWarning]);

  // 2. Automatic Fallback Handler on Fatal Error
  const handleFatalError = useCallback(
    (reason?: string) => {
      if (!activeSourceId) return;
      console.warn(
        `[MULTI-SOURCE] Fatal error on source: ${activeSourceId}. Fallback reason: ${reason}`
      );

      const vEl = localVideoRef.current;
      if (vEl && vEl.currentTime > 0) {
        setResumeTime(vEl.currentTime);
      }

      setFailedSourceIds((prev) => {
        const next = new Set(prev);
        next.add(activeSourceId);

        const eligible = displaySources.filter(
          (s) => !next.has(s.sourceId) && s.url
        );

        if (eligible.length > 0) {
          setActiveSourceId(eligible[0].sourceId);
        } else if (videoUrl && activeSourceId !== "nguonc") {
          setActiveSourceId("nguonc");
        }

        return next;
      });
    },
    [activeSourceId, displaySources, videoUrl]
  );

  // Manual source switch handler
  const handleSelectSource = (sourceId: VideoSourceId) => {
    const oldSrc = activeSource;
    const newSrc = displaySources.find((s) => s.sourceId === sourceId);

    const vEl = localVideoRef.current;
    let currentPos = resumeTime;
    let wasPlaying = isPlayingLocallyRef.current;

    if (vEl) {
      if (vEl.currentTime > 0) {
        currentPos = vEl.currentTime;
      }
      wasPlaying = !vEl.paused && !vEl.ended;
    }

    setResumeTime(currentPos);
    setCurrentAutoPlay(wasPlaying);

    if (oldSrc && newSrc && oldSrc.sourceId !== newSrc.sourceId) {
      const oldKind = normalizeAudioTrackKind(oldSrc.displayName || oldSrc.name || oldSrc.serverName);
      const newKind = normalizeAudioTrackKind(newSrc.displayName || newSrc.name || newSrc.serverName);
      if (oldKind !== newKind) {
        pendingAudioWarningRef.current = true;
        onSetPendingAudioWarning?.(true);
      }
    }

    setActiveSourceId(sourceId);
    setIsMenuOpen(false);
  };

  if (!videoUrl && !directHlsUrl && displaySources.length === 0 && !isResolving) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-900 aspect-video flex items-center justify-center border border-zinc-800">
        <p className="text-zinc-500 text-sm">Chọn một tập phim để xem</p>
      </div>
    );
  }

  return (
    <div className={isMini ? "w-full h-full" : "space-y-2"}>
      {/* Stream Source Selector Toolbar (Hidden in mini mode) */}
      {!isMini && (
        <div className="flex items-center justify-between gap-2 px-1 text-xs min-w-0">
          {/* Active Source Badge */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isResolving ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 text-violet-400 px-3 py-1 font-semibold border border-violet-500/20 animate-pulse truncate">
                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span className="truncate">Đang tối ưu nguồn phát...</span>
              </span>
            ) : activeSource ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 font-semibold border transition-colors truncate max-w-[190px] sm:max-w-xs md:max-w-sm ${
                  activeSource.type === "hls"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
                title={`Nguồn phát: ${activeSource.name}`}
              >
                {activeSource.type === "hls" ? (
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">Nguồn phát: {activeSource.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 text-zinc-400 px-2.5 sm:px-3 py-1 font-semibold border border-zinc-700 truncate max-w-[190px] sm:max-w-xs md:max-w-sm">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Nguồn phát: Server Dự Phòng</span>
              </span>
            )}
          </div>

          {/* Multi-Source Switcher Menu */}
          {displaySources.length > 0 && (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 px-2.5 sm:px-3 py-1.5 font-medium border border-zinc-700/80 shadow-sm transition-colors active:scale-95 shrink-0 whitespace-nowrap"
                title="Mở danh sách nguồn phát khả dụng"
              >
                <Tv className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="whitespace-nowrap">
                  Đổi nguồn ({displaySources.length})
                  {isSearchingBackups ? "+" : ""}
                </span>
                <ChevronDown
                  className={`h-3 w-3 text-zinc-400 shrink-0 transition-transform ${
                    isMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1 flex items-center justify-between">
                    <span>Chọn Nguồn Phát</span>
                    {isSearchingBackups && (
                      <RefreshCw className="h-3 w-3 animate-spin text-violet-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {displaySources.map((src) => {
                      const isActive = src.sourceId === activeSource?.sourceId;
                      const isFailed = failedSourceIds.has(src.sourceId);

                      return (
                        <button
                          key={src.sourceId}
                          onClick={() => handleSelectSource(src.sourceId)}
                          disabled={isActive}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                            isActive
                              ? "bg-violet-600/20 text-white font-semibold border border-violet-500/40"
                              : "hover:bg-zinc-800/80 text-zinc-300 hover:text-white"
                          } ${isFailed ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                isFailed
                                  ? "bg-red-500"
                                  : src.type === "hls"
                                  ? "bg-emerald-400 shadow-sm shadow-emerald-500/50"
                                  : "bg-amber-400 shadow-sm shadow-amber-500/50"
                              }`}
                            />
                            <div className="truncate">
                              <p className="truncate text-xs">{src.displayName}</p>
                              <p className="text-[10px] text-zinc-400 font-normal">
                                {src.type === "hls" ? "Direct HLS • Không quảng cáo" : "Iframe Embed"}
                              </p>
                            </div>
                          </div>

                          {isActive && (
                            <Check className="h-4 w-4 text-violet-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Video Viewport */}
      {isResolving && !activeSource ? (
        <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl shadow-black/60 aspect-video border border-zinc-800 flex flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 animate-spin">
            <RefreshCw className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-300">
            Đang kết nối đa nguồn phát...
          </p>
          <p className="text-xs text-zinc-500">
            Ưu tiên Direct HLS tốc độ cao • Không quảng cáo
          </p>
        </div>
      ) : activeSource?.type === "hls" || directHlsUrl ? (
        <CustomHlsPlayer
          key="cinepvq-active-hls"
          src={
            activeSource?.type === "hls"
              ? activeSource.url
              : directHlsUrl
          }
          poster={poster}
          initialTime={resumeTime}
          autoPlay={currentAutoPlay}
          initialPlaybackRate={settings?.playbackSpeed || 1}
          skipSeconds={settings?.skipSeconds || 10}
          preferredQuality={settings?.preferredQuality || "auto"}
          autoPlayNext={settings?.autoPlay ?? true}
          onAutoPlayNextChange={(val) => updateSettings({ autoPlay: val })}
          hasPrevEpisode={hasPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          onPrevEpisode={onPrevEpisode}
          onNextEpisode={onNextEpisode}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onEnded}
          onError={handleFatalError}
          onPlayingChange={handlePlayingChangeInternal}
          onVideoRef={handleRegisterVideoRef}
          isMini={isMini}
          sourceSwitchWarning={localAudioWarning || sourceSwitchWarning}
          onDismissSourceWarning={() => {
            setLocalAudioWarning(false);
            onDismissSourceWarning?.();
          }}
          isEpisodeTransitioning={isResolving}
          availableServers={availableServers}
          activeServerIndex={activeServerIndex}
          onSwitchServer={onSwitchServer}
          movieSlug={movieSlug}
          episodeSlug={episodeSlug}
          season={season}
          onMinimize={onMinimize}
          onExpand={onExpand}
          onFinishEpisodeTransition={onFinishEpisodeTransition}
        />
      ) : activeSource && activeSource.type === "iframe" ? (
        <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/60 aspect-video border border-zinc-800/80">
          {(localAudioWarning || sourceSwitchWarning) && (
            <div className="absolute top-4 inset-x-0 mx-auto w-fit max-w-[90%] z-40 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-md text-amber-300 text-xs font-medium border border-amber-500/30 shadow-xl">
                <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Thời gian giữa các bản Vietsub, Thuyết minh và Lồng tiếng có thể không đồng bộ. Bạn có thể tự điều chỉnh nếu cần.</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalAudioWarning(false);
                    onDismissSourceWarning?.();
                  }}
                  className="ml-1 p-0.5 hover:bg-white/20 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          <iframe
            key={`${activeSource.sourceId}_${serverName || ""}_${episodeSlug || ""}_${activeSource.url}`}
            src={activeSource.url}
            onLoad={() => onFinishEpisodeTransition?.(true)}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/60 aspect-video border border-zinc-800/80">
          {(localAudioWarning || sourceSwitchWarning) && (
            <div className="absolute top-4 inset-x-0 mx-auto w-fit max-w-[90%] z-40 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-md text-amber-300 text-xs font-medium border border-amber-500/30 shadow-xl">
                <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Thời gian giữa các bản Vietsub, Thuyết minh và Lồng tiếng có thể không đồng bộ. Bạn có thể tự điều chỉnh nếu cần.</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalAudioWarning(false);
                    onDismissSourceWarning?.();
                  }}
                  className="ml-1 p-0.5 hover:bg-white/20 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          <iframe
            key={`fallback_${serverName || ""}_${episodeSlug || ""}_${videoUrl}`}
            src={videoUrl}
            onLoad={() => onFinishEpisodeTransition?.(true)}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </div>
  );
}
