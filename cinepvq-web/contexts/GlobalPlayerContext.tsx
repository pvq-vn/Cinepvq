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
import { historyStore } from "@/services/userStore";
import { userSyncManager } from "@/services/userSyncManager";

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
  currentTime: number;
  duration: number;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  episodeHandlers: EpisodeHandlers;
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [episodeHandlers, setEpisodeHandlers] = useState<EpisodeHandlers>({});

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPathnameRef = useRef<string>(pathname);
  const lastSavedTimeRef = useRef<number>(0);

  const isMoviePageActive = Boolean(
    session && pathname === `/phim/${session.movieSlug}`
  );

  const registerVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      setIsPlaying(!el.paused && !el.ended);
    }
  }, []);

  const registerEpisodeHandlers = useCallback((handlers: EpisodeHandlers) => {
    setEpisodeHandlers(handlers);
  }, []);

  const handleTimeUpdate = useCallback((current: number, dur: number) => {
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
  }, [session]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const startPlayback = useCallback((newSession: GlobalPlayerSession) => {
    setSession(newSession);
    setMode("detail");
  }, []);

  const goToNextEpisode = useCallback(() => {
    if (!session || !session.episodes) return;
    const curIdx =
      session.currentEpisodeIndex ??
      session.episodes.findIndex((e) => e.slug === session.episodeSlug);
    if (curIdx >= 0 && curIdx < session.episodes.length - 1) {
      const nextEp = session.episodes[curIdx + 1];
      if (nextEp && nextEp.embed) {
        startPlayback({
          ...session,
          episodeSlug: nextEp.slug,
          episode: parseInt(nextEp.name.replace(/\D/g, ""), 10) || curIdx + 2,
          currentEpisodeIndex: curIdx + 1,
          videoUrl: nextEp.embed,
          initialTime: 0,
        });
      }
    }
  }, [session, startPlayback]);

  const goToPrevEpisode = useCallback(() => {
    if (!session || !session.episodes) return;
    const curIdx =
      session.currentEpisodeIndex ??
      session.episodes.findIndex((e) => e.slug === session.episodeSlug);
    if (curIdx > 0) {
      const prevEp = session.episodes[curIdx - 1];
      if (prevEp && prevEp.embed) {
        startPlayback({
          ...session,
          episodeSlug: prevEp.slug,
          episode: parseInt(prevEp.name.replace(/\D/g, ""), 10) || curIdx,
          currentEpisodeIndex: curIdx - 1,
          videoUrl: prevEp.embed,
          initialTime: 0,
        });
      }
    }
  }, [session, startPlayback]);

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
      ? `/phim/${session.movieSlug}?ep=${epSlug}`
      : `/phim/${session.movieSlug}`;
    setMode("detail");
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
        currentTime,
        duration,
        playerContainerRef,
        videoRef,
        episodeHandlers,
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
