"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Settings,
  Loader2,
  AlertCircle,
  Sun,
  Lock,
  Unlock,
  SkipBack,
  SkipForward,
  PictureInPicture,
} from "lucide-react";

export interface CustomHlsPlayerProps {
  src: string;
  poster?: string;
  initialTime?: number;
  autoPlay?: boolean;
  initialPlaybackRate?: number;
  skipSeconds?: number;
  preferredQuality?: string;
  autoPlayNext?: boolean;
  onAutoPlayNextChange?: (enabled: boolean) => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onPlayingChange?: (playing: boolean) => void;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}

interface QualityLevel {
  height: number;
  bitrate: number;
  label: string;
  index: number;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Resolves best quality index based on preferred quality setting.
 * Prioritizes exact 1080p if available, fallbacks to Auto (-1) if not found.
 */
function selectQualityLevel(
  levels: QualityLevel[],
  prefQuality?: string
): number {
  if (!levels || levels.length === 0 || !prefQuality || prefQuality === "auto") {
    return -1; // Auto adaptive
  }

  const normalized = prefQuality.toLowerCase();

  // If user preferred FHD / 1080p
  if (normalized === "fhd" || normalized.includes("1080")) {
    const exact1080 = levels.find((l) => l.height === 1080);
    if (exact1080) return exact1080.index;
    const highLevel = levels.find((l) => l.height >= 1080);
    if (highLevel) return highLevel.index;
    return -1; // Fallback to Auto
  }

  // If user preferred HD / 720p
  if (normalized === "hd" || normalized.includes("720")) {
    const exact720 = levels.find((l) => l.height === 720);
    if (exact720) return exact720.index;
    const highLevel = levels.find((l) => l.height >= 720);
    if (highLevel) return highLevel.index;
    return -1; // Fallback to Auto
  }

  return -1;
}

export default function CustomHlsPlayer({
  src,
  poster,
  initialTime = 0,
  autoPlay = true,
  initialPlaybackRate = 1,
  skipSeconds = 10,
  preferredQuality = "auto",
  autoPlayNext = true,
  onAutoPlayNextChange,
  hasPrevEpisode = false,
  hasNextEpisode = false,
  onPrevEpisode,
  onNextEpisode,
  onTimeUpdate,
  onEnded,
  onError,
  onPlayingChange,
  onVideoRef,
}: CustomHlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      onVideoRef?.(videoRef.current);
    }
  }, [onVideoRef]);

  const skipSec = typeof skipSeconds === "number" && skipSeconds > 0 ? skipSeconds : 10;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate || 1);
  const [prevInitialPlaybackRate, setPrevInitialPlaybackRate] = useState(initialPlaybackRate);
  if (initialPlaybackRate !== prevInitialPlaybackRate) {
    setPrevInitialPlaybackRate(initialPlaybackRate);
    setPlaybackRate(initialPlaybackRate || 1);
  }
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Player Lock state
  const [isLocked, setIsLocked] = useState(false);

  // Picture-in-Picture state
  const [isPip, setIsPip] = useState(false);
  const supportsPip = useSyncExternalStore(
    () => () => {},
    () =>
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      Boolean(document.pictureInPictureEnabled),
    () => false
  );

  // Double-tap visual feedback state ({ side: 'left' | 'right', seconds: number })
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{
    side: "left" | "right";
    seconds: number;
  } | null>(null);
  const doubleTapFeedbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Quality levels
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

  // Brightness simulation overlay (0.3 to 1.0)
  const [brightness, setBrightness] = useState<number>(1);
  const [gestureHud, setGestureHud] = useState<{
    type: "volume" | "brightness";
    value: number;
  } | null>(null);
  const gestureHudTimer = useRef<NodeJS.Timeout | null>(null);

  const showGestureHud = useCallback((type: "volume" | "brightness", val: number) => {
    setGestureHud({ type, value: val });
    if (gestureHudTimer.current) clearTimeout(gestureHudTimer.current);
    gestureHudTimer.current = setTimeout(() => {
      setGestureHud(null);
    }, 1200);
  }, []);

  const showDoubleTapFeedback = useCallback((side: "left" | "right", seconds: number) => {
    setDoubleTapFeedback({ side, seconds });
    if (doubleTapFeedbackTimer.current) clearTimeout(doubleTapFeedbackTimer.current);
    doubleTapFeedbackTimer.current = setTimeout(() => {
      setDoubleTapFeedback(null);
    }, 850);
  }, []);

  // Update video element playback rate when initialPlaybackRate changes
  useEffect(() => {
    if (videoRef.current && initialPlaybackRate) {
      videoRef.current.playbackRate = initialPlaybackRate;
    }
  }, [initialPlaybackRate]);

  // Reset controls timer on user activity
  const triggerControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSettings(false);
    }, 3000);
  }, []);

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const initialTimeRef = useRef(initialTime);
  const initialTimeAppliedRef = useRef(false);

  // 1. Initialize HLS.js or Native Video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setErrorMsg(null);
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setQualityLevels([]);
    setCurrentQuality(-1);
    initialTimeAppliedRef.current = false;
    let hlsInstance: Hls | null = null;

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsRef.current = hlsInstance;

      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        // Apply default playback rate
        if (video) {
          video.playbackRate = playbackRate;
        }

        // Extract quality levels & auto-select 1080p if available
        if (data.levels && data.levels.length > 0) {
          const levels: QualityLevel[] = data.levels.map((lvl, index) => ({
            height: lvl.height,
            bitrate: lvl.bitrate,
            label: lvl.height ? `${lvl.height}p` : `Chất lượng ${index + 1}`,
            index,
          }));
          setQualityLevels(levels);

          const targetQualityIdx = selectQualityLevel(levels, preferredQuality);
          if (hlsInstance) {
            if (targetQualityIdx !== -1) {
              hlsInstance.currentLevel = targetQualityIdx;
              setCurrentQuality(targetQualityIdx);
            } else {
              hlsInstance.currentLevel = -1;
              setCurrentQuality(-1);
            }
          }
        }

        // Apply initial resume position if provided
        if (!initialTimeAppliedRef.current && initialTimeRef.current > 5) {
          video.currentTime = initialTimeRef.current;
          initialTimeAppliedRef.current = true;
        }

        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay with sound might be blocked by browser policy
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        }
      });

      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[HlsPlayer] Fatal network error, trying to recover...", data);
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[HlsPlayer] Fatal media error, recovering...", data);
              hlsInstance?.recoverMediaError();
              break;
            default:
              console.error("[HlsPlayer] Unrecoverable HLS error:", data);
              setErrorMsg("Không thể phát video từ nguồn này.");
              onErrorRef.current?.(data.details || "HLS error");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari/iOS support
      video.src = src;
      video.playbackRate = playbackRate;
      video.addEventListener("loadedmetadata", () => {
        setIsBuffering(false);
        if (video) {
          video.playbackRate = playbackRate;
        }
        if (!initialTimeAppliedRef.current && initialTimeRef.current > 5) {
          video.currentTime = initialTimeRef.current;
          initialTimeAppliedRef.current = true;
        }
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });
    } else {
      setErrorMsg("Trình duyệt không hỗ trợ phát chuẩn video HLS.");
      onErrorRef.current?.("HLS unsupported");
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.stopLoad();
        hlsInstance.detachMedia();
        hlsInstance.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, autoPlay, playbackRate, preferredQuality]);

  // 2. Fullscreen Listener with Orientation Management
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs) {
        try {
          if (
            typeof window !== "undefined" &&
            window.screen?.orientation &&
            typeof (window.screen.orientation as { unlock?: () => void }).unlock === "function"
          ) {
            (window.screen.orientation as { unlock: () => void }).unlock();
          }
        } catch {
          // Ignored
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      try {
        if (
          typeof window !== "undefined" &&
          window.screen?.orientation &&
          typeof (window.screen.orientation as { unlock?: () => void }).unlock === "function"
        ) {
          (window.screen.orientation as { unlock: () => void }).unlock();
        }
      } catch {
        // Ignored
      }
    };
  }, []);

  // 3. Picture-in-Picture event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);

    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  // Auto PiP when video is playing and user backgrounds/navigates (best effort standard API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        isPlaying &&
        videoRef.current &&
        typeof document !== "undefined" &&
        document.pictureInPictureEnabled &&
        !document.pictureInPictureElement
      ) {
        videoRef.current.requestPictureInPicture().catch(() => {
          // Graceful fallback if browser requires user gesture
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPlaying]);

  // 4. Play / Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // 5. Seek relative (+/- seconds)
  const seekRelative = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), dur);
    triggerControls();
  }, [triggerControls]);

  // 6. Volume Change
  const handleVolumeChange = useCallback((newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
    triggerControls();
  }, [triggerControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        setVolume(0.5);
        video.volume = 0.5;
      }
    } else {
      video.muted = true;
      setIsMuted(true);
    }
    triggerControls();
  }, [isMuted, volume, triggerControls]);

  // 7. Picture-in-Picture Toggle
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || typeof document === "undefined" || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[PiP] Toggle error:", err);
    }
  }, []);

  // 8. Fullscreen toggle with Mobile Landscape Preference
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        // Priority to Landscape on mobile devices if supported
        try {
          if (
            typeof window !== "undefined" &&
            window.screen?.orientation &&
            typeof (window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock === "function"
          ) {
            await (window.screen.orientation as unknown as { lock: (o: string) => Promise<void> })
              .lock("landscape")
              .catch(() => {});
          }
        } catch {
          // Graceful fallback if device/browser disallows orientation lock
        }
      } else {
        await document.exitFullscreen();
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
    } catch (err) {
      console.warn("Fullscreen toggle error", err);
    }
  }, []);

  // 9. Playback Speed
  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
    triggerControls();
  };

  // 10. Quality Change
  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 for auto
      setCurrentQuality(levelIndex);
    }
    setShowSettings(false);
    triggerControls();
  };

  // 11. Touch Gestures & Double-Tap Seek Disambiguation
  const touchState = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    startVal: number;
    mode: "volume" | "brightness";
    active: boolean;
  } | null>(null);
  const lastTouchEndTime = useRef<number>(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, a, [role='button']")) {
      return;
    }

    if (isLocked) {
      // When locked, touches do not initiate swipe gestures
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const isRightSide = touch.clientX - rect.left >= rect.width / 2;
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      startVal: isRightSide ? volume : brightness,
      mode: isRightSide ? "volume" : "brightness",
      active: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isLocked || !touchState.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touchState.current.startY - touch.clientY; // Upward is positive

    if (!touchState.current.active) {
      if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3) {
        touchState.current.active = true;
      } else {
        return;
      }
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sensitivity = rect.height * 0.75;
    const step = deltaY / sensitivity;

    if (touchState.current.mode === "volume") {
      const nextVol = Math.max(0, Math.min(1, touchState.current.startVal + step));
      const video = videoRef.current;
      if (video) {
        video.volume = nextVol;
        video.muted = nextVol === 0;
      }
      setVolume(nextVol);
      setIsMuted(nextVol === 0);
      showGestureHud("volume", nextVol);
    } else if (touchState.current.mode === "brightness") {
      const nextBri = Math.max(0.3, Math.min(1, touchState.current.startVal + step));
      setBrightness(nextBri);
      showGestureHud("brightness", nextBri);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchEndTime.current = Date.now();

    if (isLocked) {
      // Tapping while locked reveals the unlock button briefly
      setShowControls((prev) => !prev);
      return;
    }

    if (!touchState.current) return;

    // If swipe was active (volume/brightness adjustment), do not trigger tap or seek
    if (touchState.current.active) {
      touchState.current = null;
      return;
    }

    // Determine if gesture is a clean TAP
    const changedTouch = e.changedTouches?.[0];
    const endX = changedTouch ? changedTouch.clientX : touchState.current.startX;
    const endY = changedTouch ? changedTouch.clientY : touchState.current.startY;
    const deltaX = endX - touchState.current.startX;
    const deltaY = endY - touchState.current.startY;
    const dist = Math.hypot(deltaX, deltaY);
    const elapsed = Date.now() - touchState.current.startTime;

    const isTap = dist <= 18 && elapsed <= 450;
    const startX = touchState.current.startX;
    touchState.current = null;

    if (!isTap) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const isRightSide = startX - rect.left >= rect.width / 2;
    const tapSide: "left" | "right" = isRightSide ? "right" : "left";
    const now = Date.now();

    // Check if this tap is a DOUBLE TAP on the same side
    if (
      lastTapRef.current &&
      now - lastTapRef.current.time < 300 &&
      lastTapRef.current.side === tapSide
    ) {
      // Double tap confirmed! Cancel pending single tap immediately
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = null;

      // Seek +/- skipSec
      if (tapSide === "left") {
        seekRelative(-skipSec);
        showDoubleTapFeedback("left", skipSec);
      } else {
        seekRelative(skipSec);
        showDoubleTapFeedback("right", skipSec);
      }
      return;
    }

    // First tap of a potential double-tap, or a single tap
    lastTapRef.current = { time: now, side: tapSide };
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    tapTimerRef.current = setTimeout(() => {
      // Confirmed SINGLE TAP!
      lastTapRef.current = null;

      // Single tap on video:
      // - NEVER play/pause
      // - If controls are currently shown -> HIDE them
      // - If controls are currently hidden -> SHOW them
      // Video continues playing without interruption!
      setShowControls((prev) => {
        if (prev) {
          setShowSettings(false);
          return false;
        } else {
          triggerControls();
          return true;
        }
      });
    }, 260);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, a, [role='button']")) {
      return;
    }
    // Ignore synthetic mouse click following mobile touch
    if (Date.now() - lastTouchEndTime.current < 600) {
      return;
    }
    if (isLocked) return;

    // Desktop click on video background toggles controls visibility; does NOT pause video
    setShowControls((prev) => {
      if (prev) {
        setShowSettings(false);
        return false;
      } else {
        triggerControls();
        return true;
      }
    });
  };

  // 12. Desktop Keyboard Shortcuts — YouTube Style
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (["input", "textarea", "select"].includes(activeEl.tagName.toLowerCase()) ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      if (isLocked) {
        if (e.key.toLowerCase() === "escape") {
          setIsLocked(false);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
          e.preventDefault();
          seekRelative(-skipSec);
          showDoubleTapFeedback("left", skipSec);
          break;
        case "l":
          e.preventDefault();
          seekRelative(skipSec);
          showDoubleTapFeedback("right", skipSec);
          break;
        case "arrowleft":
          e.preventDefault();
          seekRelative(-skipSec);
          break;
        case "arrowright":
          e.preventDefault();
          seekRelative(skipSec);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "i":
          e.preventDefault();
          togglePiP();
          break;
        case "p":
          e.preventDefault();
          if (hasPrevEpisode && onPrevEpisode) {
            onPrevEpisode();
          }
          break;
        case "n":
          e.preventDefault();
          if (hasNextEpisode && onNextEpisode) {
            onNextEpisode();
          }
          break;
        case "escape":
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
          } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    volume,
    skipSec,
    isLocked,
    hasPrevEpisode,
    hasNextEpisode,
    onPrevEpisode,
    onNextEpisode,
    togglePlay,
    seekRelative,
    handleVolumeChange,
    toggleFullscreen,
    toggleMute,
    togglePiP,
    showDoubleTapFeedback,
  ]);

  // Video Time Update & Buffer Progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    onTimeUpdate?.(cur, dur);

    // Compute buffer
    if (video.buffered.length > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= cur) {
          setBuffered((video.buffered.end(i) / (dur || 1)) * 100);
          break;
        }
      }
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={triggerControls}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
        setShowSettings(false);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group relative w-full aspect-video overflow-hidden rounded-2xl bg-black select-none shadow-2xl shadow-black/80 flex items-center justify-center font-sans touch-none"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
          onPlayingChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayingChange?.(false);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Brightness Filter Overlay (Hardware/Eye-comfort simulation) */}
      <div
        className="absolute inset-0 pointer-events-none bg-black transition-opacity duration-75 z-[5]"
        style={{ opacity: Math.max(0, (1 - brightness) * 0.85) }}
        aria-hidden="true"
      />

      {/* Floating Unlock Button when LOCKED */}
      {isLocked && (
        <div className="absolute top-4 left-4 z-40 animate-in fade-in duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLocked(false);
              triggerControls();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/85 hover:bg-violet-600 text-amber-400 hover:text-white border border-amber-500/40 shadow-2xl backdrop-blur-md text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="Mở khóa màn hình"
            aria-label="Mở khóa màn hình"
          >
            <Unlock className="h-4 w-4" />
            <span>Màn hình đã khóa • Bấm để mở</span>
          </button>
        </div>
      )}

      {/* Double Tap Seek Feedback Overlay */}
      {doubleTapFeedback && (
        <div
          className={`absolute inset-y-0 flex items-center justify-center pointer-events-none z-30 transition-all duration-200 animate-in fade-in zoom-in-95 ${
            doubleTapFeedback.side === "left"
              ? "left-0 w-1/3 bg-gradient-to-r from-violet-600/20 to-transparent rounded-l-2xl"
              : "right-0 w-1/3 bg-gradient-to-l from-violet-600/20 to-transparent rounded-r-2xl"
          }`}
        >
          <div className="flex flex-col items-center gap-1.5 bg-black/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 shadow-2xl text-white">
            {doubleTapFeedback.side === "left" ? (
              <>
                <RotateCcw className="h-6 w-6 text-violet-400 animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-violet-200">
                  -{doubleTapFeedback.seconds}s
                </span>
              </>
            ) : (
              <>
                <RotateCw className="h-6 w-6 text-violet-400 animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-violet-200">
                  +{doubleTapFeedback.seconds}s
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Gesture Feedback HUD Overlay (Volume / Brightness) */}
      {gestureHud && !isLocked && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/80 backdrop-blur-md px-5 py-4 text-white shadow-2xl border border-white/10 min-w-[130px]">
            {gestureHud.type === "volume" ? (
              <>
                {gestureHud.value === 0 ? (
                  <VolumeX className="h-7 w-7 text-rose-400" />
                ) : (
                  <Volume2 className="h-7 w-7 text-violet-400" />
                )}
                <span className="text-xs font-bold">
                  Âm lượng {Math.round(gestureHud.value * 100)}%
                </span>
                <div className="h-1.5 w-24 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${Math.round(gestureHud.value * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <Sun className="h-7 w-7 text-amber-400" />
                <span className="text-xs font-bold">
                  Độ sáng {Math.round(gestureHud.value * 100)}%
                </span>
                <div className="h-1.5 w-24 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.round(gestureHud.value * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && !errorMsg && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all z-10">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <span className="text-xs font-medium text-zinc-300">Đang tải video...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-white p-6 text-center space-y-3 z-30">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm font-semibold">{errorMsg}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onError?.(errorMsg);
            }}
            className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold hover:bg-violet-500 transition-all shadow-lg cursor-pointer"
          >
            Chuyển sang Server Iframe
          </button>
        </div>
      )}

      {/* Central 3-Button Controls [ PREV EP ] [ PLAY/PAUSE ] [ NEXT EP ] */}
      {showControls && !isLocked && !errorMsg && (
        <div className="absolute inset-0 m-auto flex items-center justify-center gap-6 sm:gap-10 pointer-events-none z-20">
          {/* Previous Episode Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasPrevEpisode && onPrevEpisode) onPrevEpisode();
            }}
            disabled={!hasPrevEpisode}
            className={`pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white border border-white/15 transition-all shadow-xl ${
              hasPrevEpisode
                ? "hover:bg-violet-600/90 hover:scale-110 active:scale-95 cursor-pointer opacity-90 hover:opacity-100"
                : "opacity-35 cursor-not-allowed"
            }`}
            title={hasPrevEpisode ? "Tập trước (P)" : "Không có tập trước"}
            aria-label="Tập trước"
          >
            <SkipBack className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
          </button>

          {/* Dedicated Center Play/Pause Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
              triggerControls();
            }}
            className="pointer-events-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-violet-600/90 hover:bg-violet-600 text-white shadow-2xl shadow-violet-600/50 hover:scale-110 active:scale-95 transition-all z-10 cursor-pointer"
            title={isPlaying ? "Tạm dừng (K / Space)" : "Phát (K / Space)"}
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 sm:h-10 sm:w-10 fill-current" />
            ) : (
              <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Next Episode Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasNextEpisode && onNextEpisode) onNextEpisode();
            }}
            disabled={!hasNextEpisode}
            className={`pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white border border-white/15 transition-all shadow-xl ${
              hasNextEpisode
                ? "hover:bg-violet-600/90 hover:scale-110 active:scale-95 cursor-pointer opacity-90 hover:opacity-100"
                : "opacity-35 cursor-not-allowed"
            }`}
            title={hasNextEpisode ? "Tập tiếp theo (N)" : "Không có tập tiếp theo"}
            aria-label="Tập tiếp theo"
          >
            <SkipForward className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
          </button>
        </div>
      )}

      {/* Video Controls HUD */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4 transition-opacity duration-300 ${
          showControls && !isLocked
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress / Seek Bar */}
        <div className="relative mb-3 flex items-center group/bar cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            disabled={isLocked}
            onChange={(e) => {
              if (isLocked) return;
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
              triggerControls();
            }}
            className="absolute inset-0 w-full h-4 opacity-0 z-20 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Thanh tiến trình phát video"
          />
          {/* Background Track */}
          <div className="w-full h-1.5 group-hover/bar:h-2.5 rounded-full bg-white/20 relative overflow-hidden transition-all">
            {/* Buffered Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full"
              style={{ width: `${buffered}%` }}
            />
            {/* Played Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute h-3.5 w-3.5 rounded-full bg-white shadow-md shadow-black/50 pointer-events-none transition-all group-hover/bar:scale-125 -translate-x-1/2"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Bottom Bar: Action Buttons & Metrics */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left: Play/Pause, Prev Episode, Next Episode, Volume, Time */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Play/Pause Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              title={isPlaying ? "Tạm dừng (K / Space)" : "Phát (K / Space)"}
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
              ) : (
                <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
              )}
            </button>

            {/* Previous Episode Button (Replaces Rewind 10s) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasPrevEpisode && onPrevEpisode) onPrevEpisode();
              }}
              disabled={!hasPrevEpisode}
              className={`p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg transition-colors flex items-center justify-center ${
                hasPrevEpisode
                  ? "hover:bg-white/10 text-white cursor-pointer"
                  : "opacity-40 cursor-not-allowed text-zinc-500"
              }`}
              title={hasPrevEpisode ? "Tập trước (P)" : "Không có tập trước"}
              aria-label="Tập trước"
            >
              <SkipBack className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            </button>

            {/* Next Episode Button (Replaces Fast-Forward 10s) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasNextEpisode && onNextEpisode) onNextEpisode();
              }}
              disabled={!hasNextEpisode}
              className={`p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg transition-colors flex items-center justify-center ${
                hasNextEpisode
                  ? "hover:bg-white/10 text-white cursor-pointer"
                  : "opacity-40 cursor-not-allowed text-zinc-500"
              }`}
              title={hasNextEpisode ? "Tập tiếp theo (N)" : "Không có tập tiếp theo"}
              aria-label="Tập tiếp theo"
            >
              <SkipForward className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1 group/vol">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                title="Bật/Tắt tiếng (M)"
                aria-label="Bật hoặc tắt âm thanh"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  e.stopPropagation();
                  handleVolumeChange(parseFloat(e.target.value));
                }}
                className="w-14 sm:w-16 h-1 rounded-lg bg-white/20 accent-violet-500 cursor-pointer hidden sm:block"
                aria-label="Thanh điều chỉnh âm lượng"
              />
            </div>

            {/* Time Indicator */}
            <div className="text-[10px] sm:text-xs font-medium text-zinc-300 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-zinc-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Lock, PiP, Settings, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 relative">
            {/* Lock Player Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLocked(true);
                setShowControls(false);
                setShowSettings(false);
              }}
              className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
              title="Khóa màn hình (Tránh chạm nhầm)"
              aria-label="Khóa màn hình"
            >
              <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Picture-in-Picture Button */}
            {supportsPip && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePiP();
                }}
                className={`p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                  isPip
                    ? "bg-violet-600 text-white"
                    : "hover:bg-white/10 text-zinc-300 hover:text-white"
                }`}
                title={isPip ? "Thoát chế độ thu nhỏ (I)" : "Thu nhỏ phát tiếp (I)"}
                aria-label={isPip ? "Thoát hình trong hình" : "Hình trong hình"}
              >
                <PictureInPicture className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}

            {/* Settings Trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
              className={`p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                showSettings ? "bg-white/20 text-violet-400" : "hover:bg-white/10 text-zinc-300"
              }`}
              title="Cài đặt phát video"
              aria-label="Cài đặt phát video"
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Settings Menu Popup */}
            {showSettings && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-12 w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-900/95 border border-zinc-700/60 shadow-2xl p-3 space-y-3 z-30 backdrop-blur-md text-xs animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Auto Next Episode Toggle */}
                <div className="flex items-center justify-between px-1">
                  <span className="font-semibold text-zinc-300 text-[11px] sm:text-xs">
                    Tự phát tập tiếp theo:
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoPlayNext}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAutoPlayNextChange?.(!autoPlayNext);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                      autoPlayNext ? "bg-violet-600" : "bg-zinc-700"
                    }`}
                    aria-label="Tự phát tập tiếp theo"
                    title="Tự phát tập tiếp theo"
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        autoPlayNext ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Playback Speed */}
                <div className="border-t border-zinc-800 pt-2">
                  <div className="font-semibold text-zinc-400 mb-1.5 px-1">Tốc độ phát:</div>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`px-1.5 py-1 rounded-md text-center text-[11px] transition-all cursor-pointer ${
                          playbackRate === rate
                            ? "bg-violet-600 text-white font-bold shadow"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality Options */}
                {qualityLevels.length > 0 && (
                  <div className="border-t border-zinc-800 pt-2">
                    <div className="font-semibold text-zinc-400 mb-1.5 px-1">Độ phân giải:</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      <button
                        onClick={() => handleQualityChange(-1)}
                        className={`w-full text-left px-2 py-1 rounded-md transition-all cursor-pointer ${
                          currentQuality === -1
                            ? "bg-violet-600 text-white font-bold"
                            : "hover:bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        Tự động (Auto)
                      </button>
                      {qualityLevels.map((lvl) => (
                        <button
                          key={lvl.index}
                          onClick={() => handleQualityChange(lvl.index)}
                          className={`w-full text-left px-2 py-1 rounded-md transition-all cursor-pointer ${
                            currentQuality === lvl.index
                              ? "bg-violet-600 text-white font-bold"
                              : "hover:bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
              title={isFullscreen ? "Thoát toàn màn hình (F)" : "Toàn màn hình (F)"}
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
