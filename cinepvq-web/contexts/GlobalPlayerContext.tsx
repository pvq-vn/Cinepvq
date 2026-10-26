"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { historyStore, episodeProgressStore } from "@/services/userStore";
import { userSyncManager } from "@/services/userSyncManager";
import { normalizeEpisodeLabel } from "@/lib/format";

export type AudioTrackKind = "vietsub" | "thuyet-minh" | "long-tieng" | "other";

export function normalizeAudioTrackKind(name?: string): AudioTrackKind {
  if (!name) return "other";
  const lower = name.toLowerCase();
  const normalized = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(long\s*tieng|lt|dub|dubbed|longtieng)\b/i.test(normalized)) {
    return "long-tieng";
  }
  if (/\b(thuyet\s*minh|tm|voice|voiceover|thuyetminh)\b/i.test(normalized)) {
    return "thuyet-minh";
  }
  if (/\b(vietsub|sub|phu\s*de|subtitles?|ha\s*noi|vip|kkphim|vsmov|nguonc)\b/i.test(normalized) || normalized.includes("#")) {
    return "vietsub";
  }
  return "other";
}

export interface AudioServerInfo {
  index: number;
  serverName: string;
  name?: string;
  kind: AudioTrackKind;
}

export interface EpisodeTransitionState {
  isTransitioning: boolean;
  token: number;
  targetEpisodeSlug?: string;
}

export interface ServerHandlers {
  servers: AudioServerInfo[];
  activeIndex: number;
  onSwitchServer: (index: number) => void;
}

export interface GlobalPlayerSession {
  movieSlug: string;
  movieTitle: string;
  poster?: string;
  imdbId?: string;
  tmdbId?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  type?: "movie" | "series";
  serverName?: string;
  episodeSlug?: string;
  videoUrl: string;
  knownHlsUrl?: string;
  initialTime?: number;
  autoPlay?: boolean;
  episodes?: { name: string; slug: string; embed?: string; m3u8?: string }[];
  currentEpisodeIndex?: number;
}

export type GlobalPlayerMode = "hidden" | "detail" | "mini";

export interface EpisodeHandlers {
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  onTimeUpdate?: (current: number, dur: number) => void;
  onEnded?: () => void;
}

interface GlobalPlayerContextType {
  session: GlobalPlayerSession | null;
  mode: GlobalPlayerMode;
  isPlaying: boolean;
  isNativePip: boolean;
  currentTime: number;
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  episodeHandlers: EpisodeHandlers;
  /** Incremented each time restoreToDetail is called — page.tsx watches this to scroll to player */
  expandScrollTrigger: number;
  sourceSwitchWarning: boolean;
  triggerSourceWarning: () => void;
  dismissSourceWarning: () => void;
  pendingAudioWarning: boolean;
  setPendingAudioWarning: (pending: boolean) => void;
  episodeTransition: EpisodeTransitionState;
  startEpisodeTransition: (targetSlug: string) => boolean;
  finishEpisodeTransition: (success: boolean) => void;
  flushCurrentEpisodeProgress: () => void;
  availableServers: AudioServerInfo[];
  activeServerIndex: number;
  registerServerHandlers: (handlers: ServerHandlers) => void;
  switchServer: (index: number) => void;
  startPlayback: (session: GlobalPlayerSession) => void;
  setMode: (mode: GlobalPlayerMode) => void;
  closeMiniPlayer: () => void;
  minimizeToMini: () => void;
  restoreToDetail: () => void;
  registerVideoElement: (el: HTMLVideoElement | null) => void;
  registerEpisodeHandlers: (handlers: EpisodeHandlers) => void;
  handleTimeUpdate: (current: number, dur: number) => void;
  handlePlayingChange: (playing: boolean) => void;
  handleVideoEnded: () => void;
  goToNextEpisode: () => void;
  goToPrevEpisode: () => void;
  isMoviePageActive: boolean;
}

const GlobalPlayerContext = createContext<GlobalPlayerContextType | null>(null);

export function exitFullscreenSafely(video?: HTMLVideoElement | null): void {
  if (typeof document === "undefined") return;

  try {
    const fsElement =
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
      (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement;

    if (fsElement) {
      const exitFn =
        document.exitFullscreen ||
        (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen ||
        (document as unknown as { mozCancelFullScreen?: () => Promise<void> }).mozCancelFullScreen ||
        (document as unknown as { msExitFullscreen?: () => Promise<void> }).msExitFullscreen;

      if (exitFn) {
        const res = exitFn.call(document);
        if (res && typeof res.catch === "function") {
          res.catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("[Fullscreen] Exit error:", err);
  }

  if (video) {
    try {
      const v = video as unknown as {
        webkitDisplayingFullscreen?: boolean;
        webkitExitFullscreen?: () => void;
      };
      if (v.webkitDisplayingFullscreen && typeof v.webkitExitFullscreen === "function") {
        v.webkitExitFullscreen();
      }
    } catch {
      // Ignored
    }
  }

  try {
    if (
      typeof window !== "undefined" &&
      window.screen?.orientation &&
      typeof (window.screen.orientation as unknown as { unlock?: () => void }).unlock === "function"
    ) {
      (window.screen.orientation as unknown as { unlock: () => void }).unlock();
    }
  } catch {
    // Ignored
  }
}

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [session, setSession] = useState<GlobalPlayerSession | null>(null);
  const [mode, setModeState] = useState<GlobalPlayerMode>("hidden");
  const modeRef = useRef<GlobalPlayerMode>("hidden");
  const modeBeforeHiddenRef = useRef<GlobalPlayerMode>("hidden");

  const setMode = useCallback((newMode: GlobalPlayerMode) => {
    modeRef.current = newMode;
    setModeState(newMode);
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isNativePip, setIsNativePip] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastReportedSecondRef = useRef<number>(-1);
  const [episodeHandlers, setEpisodeHandlers] = useState<EpisodeHandlers>({});
  // Incremented each time user expands mini player — page.tsx watches this to scroll to player
  const [expandScrollTrigger, setExpandScrollTrigger] = useState(0);

  // Source switch warning toast
  const [sourceSwitchWarning, setSourceSwitchWarning] = useState(false);
  const [pendingAudioWarning, setPendingAudioWarning] = useState(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSourceWarning = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setSourceSwitchWarning(true);
    warningTimerRef.current = setTimeout(() => {
      setSourceSwitchWarning(false);
      warningTimerRef.current = null;
    }, 4500);
  }, []);

  const dismissSourceWarning = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    setSourceSwitchWarning(false);
  }, []);

  // Server / translation handler state
  const [serverHandlers, setServerHandlers] = useState<ServerHandlers>({
    servers: [],
    activeIndex: 0,
    onSwitchServer: () => {},
  });

  const registerServerHandlers = useCallback((handlers: ServerHandlers) => {
    setServerHandlers(handlers);
  }, []);

  const switchServer = useCallback((index: number) => {
    serverHandlers.onSwitchServer(index);
  }, [serverHandlers]);

  // Episode transition state — tracked with a synchronous ref so rapid clicks on DIFFERENT episodes
  // always succeed while only duplicate double-clicks on the SAME target episode within 300ms are debounced.
  const [episodeTransition, setEpisodeTransition] = useState<EpisodeTransitionState>({
    isTransitioning: false,
    token: 0,
  });
  const transitionRef = useRef<{ isTransitioning: boolean; targetSlug?: string; startedAt: number }>({
    isTransitioning: false,
    targetSlug: undefined,
    startedAt: 0,
  });
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const finishEpisodeTransition = useCallback((_success: boolean) => {
    void _success;
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    transitionRef.current = { isTransitioning: false, targetSlug: undefined, startedAt: 0 };
    setEpisodeTransition({
      isTransitioning: false,
      token: 0,
    });
  }, []);

  const startEpisodeTransition = useCallback((targetSlug: string) => {
    const now = Date.now();
    // Only ignore if the exact same episode was clicked within the last 300ms
    if (
      transitionRef.current.isTransitioning &&
      transitionRef.current.targetSlug === targetSlug &&
      now - transitionRef.current.startedAt < 300
    ) {
      return false;
    }

    transitionRef.current = {
      isTransitioning: true,
      targetSlug,
      startedAt: now,
    };

    setEpisodeTransition({
      isTransitioning: true,
      token: now,
      targetEpisodeSlug: targetSlug,
    });

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    // Fast safety fallback: clear transition overlay after 3.5 seconds maximum
    transitionTimeoutRef.current = setTimeout(() => {
      finishEpisodeTransition(true);
    }, 3500);

    return true;
  }, [finishEpisodeTransition]);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPathnameRef = useRef<string>(pathname);
  const lastSavedTimeRef = useRef<number>(0);

  const isMoviePageActive = Boolean(
    session && pathname === `/phim/${session.movieSlug}`
  );

  const registerVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoElement(el);
    if (el) {
      setIsPlaying(!el.paused && !el.ended);
      setIsNativePip(Boolean(typeof document !== "undefined" && document.pictureInPictureElement === el));
    } else {
      setIsNativePip(false);
    }
  }, []);

  // Synchronize native PiP lifecycle events
  useEffect(() => {
    const video = videoElement;
    if (!video) return;

    const onEnterPip = () => {
      setIsNativePip(true);
    };

    const onLeavePip = () => {
      setIsNativePip(false);
      const wasMini =
        modeRef.current === "mini" ||
        modeBeforeHiddenRef.current === "mini";

      if (wasMini) {
        if (modeRef.current !== "mini") {
          setMode("mini");
        }
        return;
      }

      if (typeof window !== "undefined") {
        const curPath = window.location.pathname;
        if (session) {
          const movieDetailPath = `/phim/${session.movieSlug}`;
          if (curPath === movieDetailPath) {
            setMode("detail");
            setExpandScrollTrigger((n) => n + 1);
          } else if (!video.paused && !video.ended) {
            setMode("mini");
          } else {
            setMode("hidden");
          }
        }
      }
    };

    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, [videoElement, session, setMode]);

  const registerEpisodeHandlers = useCallback((handlers: EpisodeHandlers) => {
    setEpisodeHandlers(handlers);
  }, []);

  const handleTimeUpdate = useCallback((current: number, dur: number) => {
    if (transitionRef.current.isTransitioning) return;

    const sec = Math.floor(current);
    if (sec !== lastReportedSecondRef.current) {
      lastReportedSecondRef.current = sec;
      setCurrentTime(current);
      setDuration(dur);
    }

    if (session && current > 0 && Math.abs(current - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = current;
      const movieData = {
        slug: session.movieSlug,
        name: session.movieTitle,
        thumb_url: session.poster || "",
      };
      const epLabel = normalizeEpisodeLabel(
        session.episodeTitle,
        session.episodeSlug || (session.episode ? String(session.episode) : "1")
      );
      const epData = session.episodeSlug
        ? { slug: session.episodeSlug, name: epLabel }
        : undefined;
      historyStore.add(movieData, epData, current, dur, session.season || 1);
      userSyncManager.syncHistoryAdd(movieData, epData, current, dur);
    }
  }, [session]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const startPlayback = useCallback((newSession: GlobalPlayerSession) => {
    lastReportedSecondRef.current = Math.floor(newSession.initialTime || 0);
    setCurrentTime(newSession.initialTime || 0);
    setSession(newSession);
    setMode("detail");
  }, [setMode]);

  const flushCurrentEpisodeProgress = useCallback(() => {
    if (!session || !session.movieSlug || !session.episodeSlug) return;
    const v = videoRef.current;
    const cur = v ? v.currentTime : currentTime;
    const dur = v ? v.duration : duration;
    if (cur > 0) {
      episodeProgressStore.save(session.movieSlug, session.episodeSlug, session.season || 1, cur, dur);
      const movieData = {
        slug: session.movieSlug,
        name: session.movieTitle,
        thumb_url: session.poster || "",
      };
      const epLabel = normalizeEpisodeLabel(
        session.episodeTitle,
        session.episodeSlug || (session.episode ? String(session.episode) : "1")
      );
      const epData = {
        slug: session.episodeSlug,
        name: epLabel,
        season: session.season || 1,
      };
      historyStore.add(movieData, epData, cur, dur, session.season || 1);
      userSyncManager.syncHistoryAdd(movieData, epData, cur, dur);
    }
    if (v && !v.paused) {
      v.pause();
    }
  }, [session, currentTime, duration, videoRef]);

  const goToNextEpisode = useCallback(() => {
    if (episodeHandlers.onNextEpisode) {
      episodeHandlers.onNextEpisode();
      return;
    }
    if (!session || !session.episodes) return;
    const curIdx =
      session.currentEpisodeIndex ??
      session.episodes.findIndex((e) => e.slug === session.episodeSlug);
    if (curIdx >= 0 && curIdx < session.episodes.length - 1) {
      const nextEp = session.episodes[curIdx + 1];
      if (nextEp && (nextEp.embed || nextEp.m3u8)) {
        if (!startEpisodeTransition(nextEp.slug)) return;
        flushCurrentEpisodeProgress();
        const targetResumeTime =
          episodeProgressStore.get(
            session.movieSlug,
            nextEp.slug,
            session.season || 1
          ) || 0;

        startPlayback({
          ...session,
          episodeSlug: nextEp.slug,
          episodeTitle: normalizeEpisodeLabel(nextEp.name, nextEp.slug),
          episode: parseInt(nextEp.name.replace(/\D/g, ""), 10) || curIdx + 2,
          currentEpisodeIndex: curIdx + 1,
          videoUrl: nextEp.embed || nextEp.m3u8 || "",
          knownHlsUrl: nextEp.m3u8,
          initialTime: targetResumeTime,
          autoPlay: true,
        });
      }
    }
  }, [session, episodeHandlers, startEpisodeTransition, flushCurrentEpisodeProgress, startPlayback]);

  const goToPrevEpisode = useCallback(() => {
    if (episodeHandlers.onPrevEpisode) {
      episodeHandlers.onPrevEpisode();
      return;
    }
    if (!session || !session.episodes) return;
    const curIdx =
      session.currentEpisodeIndex ??
      session.episodes.findIndex((e) => e.slug === session.episodeSlug);
    if (curIdx > 0) {
      const prevEp = session.episodes[curIdx - 1];
      if (prevEp && (prevEp.embed || prevEp.m3u8)) {
        if (!startEpisodeTransition(prevEp.slug)) return;
        flushCurrentEpisodeProgress();
        const targetResumeTime =
          episodeProgressStore.get(
            session.movieSlug,
            prevEp.slug,
            session.season || 1
          ) || 0;

        startPlayback({
          ...session,
          episodeSlug: prevEp.slug,
          episodeTitle: normalizeEpisodeLabel(prevEp.name, prevEp.slug),
          episode: parseInt(prevEp.name.replace(/\D/g, ""), 10) || curIdx,
          currentEpisodeIndex: curIdx - 1,
          videoUrl: prevEp.embed || prevEp.m3u8 || "",
          knownHlsUrl: prevEp.m3u8,
          initialTime: targetResumeTime,
          autoPlay: true,
        });
      }
    }
  }, [session, episodeHandlers, startEpisodeTransition, flushCurrentEpisodeProgress, startPlayback]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    goToNextEpisode();
  }, [goToNextEpisode]);

  const closeMiniPlayer = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    setMode("hidden");
    setSession(null);
  }, [setMode]);

  const minimizeToMini = useCallback(() => {
    if (!session) return;
    exitFullscreenSafely(videoRef.current);
    setMode("mini");
    if (typeof window !== "undefined") {
      const curPath = window.location.pathname;
      const movieDetailPath = `/phim/${session.movieSlug}`;
      if (curPath === movieDetailPath) {
        router.push(movieDetailPath, { scroll: false });
      }
    }
  }, [session, router, setMode]);

  const restoreToDetail = useCallback(() => {
    if (!session) return;
    const epSlug = session.episodeSlug;
    const targetUrl = epSlug
      ? `/phim/${session.movieSlug}?ep=${epSlug}&watch=true`
      : `/phim/${session.movieSlug}?watch=true`;
    setMode("detail");
    setExpandScrollTrigger((n) => n + 1);
    router.push(targetUrl);
  }, [session, router, setMode]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = async () => {
      const video = videoRef.current;
      if (!video || !session) return;

      if (document.hidden) {
        modeBeforeHiddenRef.current = modeRef.current;
        const isActuallyPlaying = !video.paused && !video.ended;
        if (
          isActuallyPlaying &&
          document.pictureInPictureEnabled &&
          !document.pictureInPictureElement
        ) {
          try {
            await video.requestPictureInPicture();
          } catch (err) {
            console.warn("[GlobalPlayer] Auto Native PiP request failed:", err);
          }
        }
      } else {
        if (document.pictureInPictureElement) {
          try {
            await document.exitPictureInPicture();
          } catch (err) {
            console.warn("[GlobalPlayer] Auto Native PiP exit failed:", err);
          }
        }

        const wasMini =
          modeRef.current === "mini" ||
          modeBeforeHiddenRef.current === "mini";

        if (wasMini) {
          if (modeRef.current !== "mini") {
            setMode("mini");
          }
          return;
        }

        if (typeof window !== "undefined") {
          const curPath = window.location.pathname;
          const movieDetailPath = `/phim/${session.movieSlug}`;
          if (curPath === movieDetailPath) {
            if (modeRef.current !== "detail") {
              setMode("detail");
              setExpandScrollTrigger((n) => n + 1);
            }
          } else if (!video.paused && !video.ended) {
            if (modeRef.current !== "mini") {
              setMode("mini");
            }
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, videoRef, setMode]);

  useEffect(() => {
    const prevPath = lastPathnameRef.current;
    lastPathnameRef.current = pathname;

    if (!session) return;

    const movieDetailPath = `/phim/${session.movieSlug}`;
    const isNowOnMovieDetail = pathname === movieDetailPath;
    const wasOnMovieDetail = prevPath === movieDetailPath;

    if (wasOnMovieDetail && !isNowOnMovieDetail) {
      exitFullscreenSafely(videoRef.current);
      const video = videoRef.current;
      const isActuallyPlaying = video
        ? !video.paused && !video.ended
        : isPlaying;

      if (isActuallyPlaying) {
        setMode("mini");
      } else {
        setMode("hidden");
      }
    }
  }, [pathname, session, isPlaying, setMode]);

  return (
    <GlobalPlayerContext.Provider
      value={{
        session,
        mode,
        isPlaying,
        isNativePip,
        currentTime,
        duration,
        videoRef,
        episodeHandlers,
        expandScrollTrigger,
        sourceSwitchWarning,
        triggerSourceWarning,
        dismissSourceWarning,
        pendingAudioWarning,
        setPendingAudioWarning,
        episodeTransition,
        startEpisodeTransition,
        finishEpisodeTransition,
        flushCurrentEpisodeProgress,
        availableServers: serverHandlers.servers,
        activeServerIndex: serverHandlers.activeIndex,
        registerServerHandlers,
        switchServer,
        startPlayback,
        setMode,
        closeMiniPlayer,
        minimizeToMini,
        restoreToDetail,
        registerVideoElement,
        registerEpisodeHandlers,
        handleTimeUpdate,
        handlePlayingChange,
        handleVideoEnded,
        goToNextEpisode,
        goToPrevEpisode,
        isMoviePageActive,
      }}
    >
      {children}
    </GlobalPlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error("useGlobalPlayer must be used within a GlobalPlayerProvider");
  }
  return context;
}
