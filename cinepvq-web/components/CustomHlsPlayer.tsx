"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
} from "lucide-react";

export interface CustomHlsPlayerProps {
  src: string;
  poster?: string;
  initialTime?: number;
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
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

export default function CustomHlsPlayer({
  src,
  poster,
  initialTime = 0,
  autoPlay = true,
  onTimeUpdate,
  onEnded,
  onError,
}: CustomHlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quality levels
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

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
        // Extract quality levels
        if (data.levels && data.levels.length > 0) {
          const levels: QualityLevel[] = data.levels.map((lvl, index) => ({
            height: lvl.height,
            bitrate: lvl.bitrate,
            label: lvl.height ? `${lvl.height}p` : `Chất lượng ${index + 1}`,
            index,
          }));
          setQualityLevels(levels);
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
      video.addEventListener("loadedmetadata", () => {
        setIsBuffering(false);
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
  }, [src, autoPlay]);

  // 2. Fullscreen Listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // 3. Play / Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // 4. Seek +/- 10s
  const seekRelative = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), dur);
    triggerControls();
  }, [triggerControls]);

  // 5. Volume Change
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

  // 6. Fullscreen
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle error", err);
    }
  }, []);

  // 7. Playback Speed
  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
    triggerControls();
  };

  // 8. Quality Change
  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 for auto
      setCurrentQuality(levelIndex);
    }
    setShowSettings(false);
    triggerControls();
  };

  // 9. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in inputs
      if (["input", "textarea"].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekRelative(-5);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekRelative(5);
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [volume, togglePlay, seekRelative, handleVolumeChange, toggleFullscreen, toggleMute]);

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
      onMouseMove={triggerControls}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
        setShowSettings(false);
      }}
      className="group relative w-full aspect-video overflow-hidden rounded-2xl bg-black select-none shadow-2xl shadow-black/80 flex items-center justify-center font-sans"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }}
        onPause={() => setIsPlaying(false)}
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

      {/* Buffering Spinner */}
      {isBuffering && !errorMsg && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all">
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
            onClick={() => onError?.(errorMsg)}
            className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold hover:bg-violet-500 transition-all shadow-lg"
          >
            Chuyển sang Server Iframe
          </button>
        </div>
      )}

      {/* Big Center Play/Pause button on Hover or Click */}
      {!isPlaying && !isBuffering && !errorMsg && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-2xl shadow-violet-600/40 hover:scale-110 transition-transform z-10"
          aria-label="Phát"
        >
          <Play className="h-8 w-8 fill-current translate-x-0.5" />
        </button>
      )}

      {/* Video Controls HUD */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
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
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
              triggerControls();
            }}
            className="absolute inset-0 w-full h-4 opacity-0 z-20 cursor-pointer"
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
          {/* Left: Play, Rewind, Fast-Forward, Time, Volume */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={isPlaying ? "Tạm dừng (Space)" : "Phát (Space)"}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>

            <button
              onClick={() => seekRelative(-10)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:inline-flex"
              title="Tua lại 10s (←)"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:inline-flex"
              title="Tua tiếp 10s (→)"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Bật/Tắt tiếng (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 rounded-lg bg-white/20 accent-violet-500 cursor-pointer hidden sm:block"
              />
            </div>

            {/* Time Indicator */}
            <div className="text-xs font-medium text-zinc-300 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-zinc-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Quality / Speed Settings & Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Settings Trigger */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSettings ? "bg-white/20 text-violet-400" : "hover:bg-white/10 text-zinc-300"
              }`}
              title="Cài đặt phát video"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Settings Menu Popup */}
            {showSettings && (
              <div className="absolute right-0 bottom-12 w-48 rounded-2xl bg-zinc-900/95 border border-zinc-700/60 shadow-2xl p-3 space-y-3 z-30 backdrop-blur-md text-xs">
                {/* Playback Speed */}
                <div>
                  <div className="font-semibold text-zinc-400 mb-1.5 px-1">Tốc độ phát:</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`px-2 py-1 rounded-md text-center transition-all ${
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
                        className={`w-full text-left px-2 py-1 rounded-md transition-all ${
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
                          className={`w-full text-left px-2 py-1 rounded-md transition-all ${
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
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={isFullscreen ? "Thoát toàn màn hình (F)" : "Toàn màn hình (F)"}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
