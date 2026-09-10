"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  resolveAllSources,
  type ResolvedSource,
  type VideoSourceId,
} from "@/services/videoSources";
import CustomHlsPlayer from "@/components/CustomHlsPlayer";
import { useUserStore } from "@/hooks/useUserStore";
import {
  type AudioServerInfo,
  type EpisodeTransitionState,
  normalizeAudioTrackKind,
} from "@/contexts/GlobalPlayerContext";
import {
  Sparkles,
  ShieldAlert,
  RefreshCw,
  Tv,
  Check,
  ChevronDown,
  Info,
  X,
} from "lucide-react";

export interface VideoPlayerProps {
  videoUrl: string; // StreamC iframe embed URL (NguonC)
  imdbId?: string;
  tmdbId?: string;
  movieSlug?: string;
  movieTitle?: string;
  season?: number;
  episode?: number;
  type?: "movie" | "series";
  poster?: string;
  initialTime?: number;
  serverName?: string;
  episodeSlug?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  isMini?: boolean;
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
  autoPlay?: boolean;
}

export default function VideoPlayer({
  videoUrl,
  imdbId,
  tmdbId,
  movieSlug,
  movieTitle,
  season = 1,
  episode = 1,
  type = "series",
  poster,
  initialTime = 0,
  serverName,
  episodeSlug,
  onTimeUpdate,
  onEnded,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  onPlayingChange,
  onVideoRef,
  isMini = false,
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
  autoPlay = true,
}: VideoPlayerProps) {
  const { settings, updateSettings } = useUserStore();
  const [sources, setSources] = useState<ResolvedSource[]>([]);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<VideoSourceId | null>(null);
  const [failedSourceIds, setFailedSourceIds] = useState<Set<VideoSourceId>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [resumeTime, setResumeTime] = useState<number>(initialTime);
  const [currentAutoPlay, setCurrentAutoPlay] = useState<boolean>(autoPlay);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingLocallyRef = useRef<boolean>(autoPlay);
  const pendingAudioWarningRef = useRef<boolean>(false);
  const [localAudioWarning, setLocalAudioWarning] = useState<boolean>(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resolveRequestIdRef = useRef<number>(0);

  const menuRef = useRef<HTMLDivElement>(null);

  const episodeKey = `${imdbId || ""}_${movieSlug || ""}_${season || 1}_${episode || 1}_${type || "series"}_${serverName || ""}_${episodeSlug || ""}_${videoUrl || ""}`;
  const isResolving = resolvedKey !== episodeKey;
  const displaySources = useMemo(
    () => (resolvedKey === episodeKey ? sources : []),
    [resolvedKey, episodeKey, sources]
  );

  // Reset resumeTime & warning whenever a new episode or movie is selected (EPISODE SWITCH)
  const [prevEpisodeKey, setPrevEpisodeKey] = useState(episodeKey);
  if (episodeKey !== prevEpisodeKey) {
    setPrevEpisodeKey(episodeKey);
    setResumeTime(initialTime);
    setCurrentAutoPlay(autoPlay);
    setLocalAudioWarning(false);
  }

  // Also sync resumeTime if initialTime prop changes
  const [prevInitialTime, setPrevInitialTime] = useState(initialTime);
  if (initialTime !== prevInitialTime) {
    setPrevInitialTime(initialTime);
    setResumeTime(initialTime);
  }

  useEffect(() => {
    pendingAudioWarningRef.current = false;
  }, [episodeKey]);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update tracked time when video plays
  const handleTimeUpdate = useCallback(
    (current: number, dur: number) => {
      setResumeTime(current);
      onTimeUpdate?.(current, dur);
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

  const triggerLocalWarningToast = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setLocalAudioWarning(true);
    warningTimerRef.current = setTimeout(() => {
      setLocalAudioWarning(false);
      warningTimerRef.current = null;
    }, 2800);
  }, []);

  const handlePlayingChangeInternal = useCallback(
    (playing: boolean) => {
      isPlayingLocallyRef.current = playing;
      onPlayingChange?.(playing);

      if (playing) {
        onFinishEpisodeTransition?.(true);
        // Warning displays ONLY after the new source actually begins playback!
        if (pendingAudioWarning || pendingAudioWarningRef.current) {
          pendingAudioWarningRef.current = false;
          onSetPendingAudioWarning?.(false);
          triggerLocalWarningToast();
          onTriggerSourceWarning?.();
        }
      }
    },
    [
      onPlayingChange,
      onFinishEpisodeTransition,
      pendingAudioWarning,
      onSetPendingAudioWarning,
      triggerLocalWarningToast,
      onTriggerSourceWarning,
    ]
  );

  // 1. Resolve all available sources on episode / movie change
  useEffect(() => {
    const requestId = ++resolveRequestIdRef.current;
    let isCancelled = false;

    console.log("[MULTI-SOURCE] Resolving available sources for:", {
      movieSlug,
      imdbId,
      season,
      episode,
      type,
      serverName,
      episodeSlug,
    });

    resolveAllSources({
      slug: movieSlug,
      imdbId,
      tmdbId,
      title: movieTitle,
      season,
      episode,
      type,
      nguoncEmbedUrl: videoUrl,
      serverName,
      episodeSlug,
    })
      .then((resolvedList) => {
        if (isCancelled || requestId !== resolveRequestIdRef.current) return;
        console.log("[MULTI-SOURCE] Resolved sources:", resolvedList);

        // Fallback default: Ensure NguonC is present if provided
        const finalList = [...resolvedList];
        if (
          videoUrl &&
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
        setFailedSourceIds(new Set());
        setResolvedKey(episodeKey);

        // Select preferred source if specified and available, otherwise fallback to highest priority
        if (finalList.length > 0) {
          const pref = settings?.preferredSource;
          const preferredMatch =
            pref && pref !== "auto"
              ? finalList.find((s) => s.sourceId === pref && s.isAvailable)
              : null;

          if (preferredMatch) {
            setActiveSourceId(preferredMatch.sourceId);
          } else {
            setActiveSourceId(finalList[0].sourceId);
          }
        }
      })
      .catch((err) => {
        if (isCancelled || requestId !== resolveRequestIdRef.current) return;
        console.error("[MULTI-SOURCE] Resolution failed:", err);
        // Fallback to NguonC
        if (videoUrl) {
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
    settings?.preferredSource,
  ]);

  // Find active source object
  const activeSource = displaySources.find((s) => s.sourceId === activeSourceId) || null;

  // Track last known HLS source during render to prevent unmounting CustomHlsPlayer during episode switch
  const [lastKnownHlsSource, setLastKnownHlsSource] = useState<ResolvedSource | null>(null);
  const [prevActiveSource, setPrevActiveSource] = useState<ResolvedSource | null>(null);
  if (activeSource !== prevActiveSource) {
    setPrevActiveSource(activeSource);
    if (activeSource?.type === "hls") {
      setLastKnownHlsSource(activeSource);
    }
  }

  // 2. Automatic Fallback Handler on Fatal Error
  const handleFatalError = useCallback(
    (reason?: string) => {
      if (!activeSourceId) return;
      console.warn(
        `[MULTI-SOURCE] Fatal error on source: ${activeSourceId}. Fallback reason: ${reason}`
      );

      setFailedSourceIds((prev) => {
        const next = new Set(prev);
        next.add(activeSourceId);

        // Find next eligible source in priority order
        const eligible = displaySources.filter(
          (s) => !next.has(s.sourceId) && s.url
        );

        if (eligible.length > 0) {
          console.log(
            `[MULTI-SOURCE] Auto-falling back to next source: ${eligible[0].name}`
          );
          setActiveSourceId(eligible[0].sourceId);
        } else if (videoUrl && activeSourceId !== "nguonc") {
          console.log("[MULTI-SOURCE] All direct sources failed, falling back to StreamC iframe");
          setActiveSourceId("nguonc");
        }

        return next;
      });
    },
    [activeSourceId, displaySources, videoUrl]
  );

  // Manual source switch handler
  const handleSelectSource = (sourceId: VideoSourceId) => {
    console.log(`[MULTI-SOURCE] User manually switched to: ${sourceId}`);
    const oldSrc = activeSource;
    const newSrc = displaySources.find((s) => s.sourceId === sourceId);

    // 1. Capture exact current timestamp and playback state from active video before switching
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

    // 2. Check if audio semantic type switched between vietsub <-> thuyet-minh <-> long-tieng
    if (oldSrc && newSrc) {
      const oldKind = normalizeAudioTrackKind(oldSrc.displayName || oldSrc.name || oldSrc.serverName);
      const newKind = normalizeAudioTrackKind(newSrc.displayName || newSrc.name || newSrc.serverName);
      if (
        oldKind !== newKind &&
        oldKind !== "other" &&
        newKind !== "other"
      ) {
        // Flag pending warning: only show AFTER new source actually starts playing
        pendingAudioWarningRef.current = true;
        onSetPendingAudioWarning?.(true);
      } else {
        pendingAudioWarningRef.current = false;
        onSetPendingAudioWarning?.(false);
      }
    }

    setActiveSourceId(sourceId);
    setIsMenuOpen(false);
  };

  if (!videoUrl && displaySources.length === 0 && !isResolving) {
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
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 font-semibold border transition-all truncate max-w-[190px] sm:max-w-xs md:max-w-sm ${
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 px-2.5 sm:px-3 py-1.5 font-medium border border-zinc-700/80 shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
                title="Mở danh sách nguồn phát khả dụng"
              >
                <Tv className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="whitespace-nowrap">Đổi nguồn ({displaySources.length})</span>
                <ChevronDown
                  className={`h-3 w-3 text-zinc-400 shrink-0 transition-transform ${
                    isMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1">
                    Chọn Nguồn Phát
                  </div>
                  <div className="space-y-1">
                    {displaySources.map((src) => {
                      const isActive = src.sourceId === activeSourceId;
                      const isFailed = failedSourceIds.has(src.sourceId);

                      return (
                        <button
                          key={src.sourceId}
                          onClick={() => handleSelectSource(src.sourceId)}
                          disabled={isActive}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${
                            isActive
                              ? "bg-violet-600/20 text-white font-semibold border border-violet-500/40"
                              : "hover:bg-zinc-800/80 text-zinc-300 hover:text-white"
                          } ${isFailed ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {/* Dot indicator */}
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
      {isResolving && !activeSource && !lastKnownHlsSource ? (
        <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl shadow-black/60 aspect-video border border-zinc-800 flex flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 animate-spin">
            <RefreshCw className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-300">
            Đang kết nối đa nguồn phát...
          </p>
          <p className="text-xs text-zinc-500">
            Ưu tiên K20 Direct &gt; VSMOV &gt; KKPhim1 &gt; NguonC
          </p>
        </div>
      ) : activeSource?.type === "hls" || (!activeSource && lastKnownHlsSource) ? (
        <CustomHlsPlayer
          key="cinepvq-active-hls"
          src={activeSource?.type === "hls" ? activeSource.url : (lastKnownHlsSource?.url || "")}
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
          onDismissSourceWarning={onDismissSourceWarning}
          isEpisodeTransitioning={isResolving || Boolean(episodeTransition?.isTransitioning)}
          availableServers={availableServers}
          activeServerIndex={activeServerIndex}
          onSwitchServer={onSwitchServer}
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
