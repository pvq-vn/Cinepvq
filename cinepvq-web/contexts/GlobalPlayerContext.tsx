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
  if (/\b(vietsub|sub|phu\s*de|subtitles?)\b/i.test(normalized)) {
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
  type?: "movie" | "series";
  serverName?: string;
  episodeSlug?: string;
  videoUrl: string;
  initialTime?: number;
  autoPlay?: boolean;
  episodes?: { name: string; slug: string; embed?: string }[];
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

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [session, setSession] = useState<GlobalPlayerSession | null>(null);
  const [mode, setMode] = useState<GlobalPlayerMode>("hidden");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNativePip, setIsNativePip] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    }, 2800);
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

  // Episode transition state (idempotent, single active transition token)
  const [episodeTransition, setEpisodeTransition] = useState<EpisodeTransitionState>({
    isTransitioning: false,
    token: 0,
  });

  const startEpisodeTransition = useCallback((targetSlug: string) => {
    let started = false;
    setEpisodeTransition((prev) => {
      if (prev.isTransitioning) {
        started = false;
        return prev;
      }
      started = true;
      return {
        isTransitioning: true,
        token: Date.now(),
        targetEpisodeSlug: targetSlug,
      };
    });
    return started;
  }, []);

  const finishEpisodeTransition = useCallback((_success: boolean) => {
    void _success;
    setEpisodeTransition({
      isTransitioning: false,
      token: 0,
    });
  }, []);

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
      // When leaving native PiP:
      // If currently on movie detail page: restore detail mode & trigger scroll
      // If on other pages: restore mini mode if video is playing, or hidden if paused
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
  }, [videoElement, session]);

  const registerEpisodeHandlers = useCallback((handlers: EpisodeHandlers) => {
    setEpisodeHandlers(handlers);
  }, []);

  const handleTimeUpdate = useCallback((current: number, dur: number) => {
    if (episodeTransition.isTransitioning) return;
    setCurrentTime(current);
    setDuration(dur);

    if (session && current > 0 && Math.abs(current - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = current;
      const movieData = {
        slug: session.movieSlug,
        name: session.movieTitle,
        thumb_url: session.poster || "",
      };
      const epData = session.episodeSlug
        ? { slug: session.episodeSlug, name: `Tập ${session.episode || 1}` }
        : undefined;
      historyStore.add(movieData, epData, current, dur);
      userSyncManager.syncHistoryAdd(movieData, epData, current, dur);
    }
  }, [session, episodeTransition.isTransitioning]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const startPlayback = useCallback((newSession: GlobalPlayerSession) => {
    setSession(newSession);
    setMode("detail");
  }, []);

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
      const epData = {
        slug: session.episodeSlug,
        name: `Tập ${session.episode || 1}`,
        season: session.season || 1,
      };
      historyStore.add(movieData, epData, cur, dur, session.season || 1);
      userSyncManager.syncHistoryAdd(movieData, epData, cur, dur);
    }
    // Pause video immediately so it stops playing the old stream and ceases firing timeupdate events
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
      if (nextEp && nextEp.embed) {
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
          episode: parseInt(nextEp.name.replace(/\D/g, ""), 10) || curIdx + 2,
          currentEpisodeIndex: curIdx + 1,
          videoUrl: nextEp.embed,
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
      if (prevEp && prevEp.embed) {
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
          episode: parseInt(prevEp.name.replace(/\D/g, ""), 10) || curIdx,
          currentEpisodeIndex: curIdx - 1,
          videoUrl: prevEp.embed,
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
  }, []);

  const restoreToDetail = useCallback(() => {
    if (!session) return;
    const epSlug = session.episodeSlug;
    const targetUrl = epSlug
      ? `/phim/${session.movieSlug}?ep=${epSlug}&watch=true`
      : `/phim/${session.movieSlug}?watch=true`;
    setMode("detail");
    // Signal page.tsx to scroll to player once it renders in detail mode
    setExpandScrollTrigger((n) => n + 1);
    router.push(targetUrl);
  }, [session, router]);

  // Route transition observer
  useEffect(() => {
    const prevPath = lastPathnameRef.current;
    lastPathnameRef.current = pathname;

    if (!session) return;

    const movieDetailPath = `/phim/${session.movieSlug}`;
    const isNowOnMovieDetail = pathname === movieDetailPath;
    const wasOnMovieDetail = prevPath === movieDetailPath;

    if (wasOnMovieDetail && !isNowOnMovieDetail) {
      // User navigated away from the movie detail page
      const video = videoRef.current;
      const isActuallyPlaying = video
        ? !video.paused && !video.ended
        : isPlaying;

      if (isActuallyPlaying) {
        // Auto Mini Player: Only when video is genuinely PLAYING
        setMode("mini");
      } else {
        // Paused: Do NOT auto open Mini Player
        setMode("hidden");
      }
    } else if (!wasOnMovieDetail && isNowOnMovieDetail) {
      // User returned to the movie detail page of this session
      setMode("detail");
    }
  }, [pathname, session, isPlaying]);

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
