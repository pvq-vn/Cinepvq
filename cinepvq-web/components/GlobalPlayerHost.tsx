"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore, useCallback } from "react";
import { createPortal } from "react-dom";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
import VideoPlayer from "@/components/VideoPlayer";
import { X, Maximize2, Tv, PictureInPicture, Play, Pause } from "lucide-react";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * GlobalPlayerHost — Single video player orchestrator.
 *
 * Architecture (NO DOM relocation, NO unmount between mode changes):
 *
 *  VideoPlayer renders ONCE in a fixed root container.
 *  Mode switching is purely CSS-based:
 *    - "hidden": root container is display:none (HLS alive, no paint)
 *    - "detail": root container is position:fixed, sized + positioned to match
 *                #cinepvq-player-slot (tracked via ResizeObserver + scroll listener)
 *    - "mini":   root container is position:fixed bottom-right mini video overlay
 *
 *  Guarantees:
 *    A. Always exactly 1 HTMLVideoElement in the DOM.
 *    B. Always exactly 1 HLS instance — never destroyed between mode changes.
 *    C. No React tree re-mount across mode changes.
 *    D. No DOM relocation or Portal target race conditions.
 */
export default function GlobalPlayerHost() {
  const {
    session,
    mode,
    isPlaying,
    isNativePip,
    videoRef,
    episodeHandlers,
    closeMiniPlayer,
    minimizeToMini,
    restoreToDetail,
    handleTimeUpdate,
    handlePlayingChange,
    handleVideoEnded,
    goToNextEpisode,
    goToPrevEpisode,
    registerVideoElement,
    sourceSwitchWarning,
    triggerSourceWarning,
    dismissSourceWarning,
    pendingAudioWarning,
    setPendingAudioWarning,
    episodeTransition,
    finishEpisodeTransition,
    availableServers,
    activeServerIndex,
    switchServer,
  } = useGlobalPlayer();

  const isClient = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  // Slot absolute coordinate tracking for detail-mode overlay
  const [slotPosition, setSlotPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const slotObserverRef = useRef<ResizeObserver | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const supportsPip =
    isClient &&
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    Boolean(document.pictureInPictureEnabled);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleToggleBrowserPiP = async () => {
    const video = videoRef.current;
    if (!video || typeof document === "undefined" || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[GlobalPlayerHost] PiP toggle error:", err);
    }
  };

  // Track slot absolute position in document coordinates (immune to scroll lag)
  const updateSlotPosition = useCallback(() => {
    const slot = document.getElementById("cinepvq-player-slot");
    if (slot) {
      slot.style.minHeight = "";
      const rect = slot.getBoundingClientRect();
      if (rect.width > 0) {
        const scrollY = typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0;
        const scrollX = typeof window !== "undefined" ? window.scrollX || window.pageXOffset || 0 : 0;
        setSlotPosition({
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
        });
      }
    } else {
      setSlotPosition(null);
    }
  }, []);

  // Robust recovery and measurement on leavepictureinpicture
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLeavePip = () => {
      const slot = document.getElementById("cinepvq-player-slot");
      if (slot) slot.style.minHeight = "";
      updateSlotPosition();
      requestAnimationFrame(() => updateSlotPosition());
      setTimeout(() => updateSlotPosition(), 100);
      setTimeout(() => updateSlotPosition(), 300);
    };

    video.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, [videoRef, updateSlotPosition]);

  useEffect(() => {
    if (!isClient || !session) return;

    if (mode === "detail") {
      const attachSlot = () => {
        const slot = document.getElementById("cinepvq-player-slot");
        if (slot) {
          updateSlotPosition();
          if (!slotObserverRef.current) {
            const ro = new ResizeObserver(() => {
              updateSlotPosition();
            });
            ro.observe(slot);
            if (typeof document !== "undefined" && document.body) {
              ro.observe(document.body);
            }
            slotObserverRef.current = ro;
          }
          return true;
        }
        return false;
      };

      // Try immediately
      attachSlot();
      const rafId = requestAnimationFrame(() => attachSlot());

      // Watch for slot mounting in DOM via MutationObserver
      let mo: MutationObserver | null = null;
      if (typeof document !== "undefined" && document.body) {
        mo = new MutationObserver(() => {
          attachSlot();
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }

      // Fast polling fallback for the first 1.5s after entering detail mode
      const pollInterval = setInterval(() => {
        attachSlot();
      }, 40);
      const pollTimeout = setTimeout(() => {
        clearInterval(pollInterval);
      }, 1500);

      // Re-measure on resize, orientation changes, or fullscreen exit
      const onLayoutChange = () => {
        const s = document.getElementById("cinepvq-player-slot");
        if (s) {
          s.style.minHeight = "";
        }
        updateSlotPosition();
      };

      window.addEventListener("resize", onLayoutChange, { passive: true });
      window.addEventListener("orientationchange", onLayoutChange, { passive: true });
      window.visualViewport?.addEventListener("resize", onLayoutChange);
      document.addEventListener("fullscreenchange", onLayoutChange);
      document.addEventListener("webkitfullscreenchange", onLayoutChange);
      screen.orientation?.addEventListener?.("change", onLayoutChange);

      return () => {
        cancelAnimationFrame(rafId);
        mo?.disconnect();
        clearInterval(pollInterval);
        clearTimeout(pollTimeout);
        slotObserverRef.current?.disconnect();
        slotObserverRef.current = null;
        window.removeEventListener("resize", onLayoutChange);
        window.removeEventListener("orientationchange", onLayoutChange);
        window.visualViewport?.removeEventListener("resize", onLayoutChange);
        document.removeEventListener("fullscreenchange", onLayoutChange);
        document.removeEventListener("webkitfullscreenchange", onLayoutChange);
        screen.orientation?.removeEventListener?.("change", onLayoutChange);
        requestAnimationFrame(() => setSlotPosition(null));
      };
    } else {
      // Cleanup observers when not in detail mode
      slotObserverRef.current?.disconnect();
      slotObserverRef.current = null;
      const clearRafId = requestAnimationFrame(() => setSlotPosition(null));
      return () => cancelAnimationFrame(clearRafId);
    }
  }, [mode, session, isClient, updateSlotPosition]);

  if (!isClient || !session) {
    return null;
  }

  const isHidden = mode === "hidden";
  const isMini = mode === "mini";
  const isDetail = mode === "detail";

  // Detail mode: absolute positioning matching slot position in document.
  // Synchronously resolves slot element if available to eliminate black screen flicker on expand
  let activeDetailPos = slotPosition;
  if (!activeDetailPos && isDetail && typeof document !== "undefined") {
    const slot = document.getElementById("cinepvq-player-slot");
    if (slot) {
      const rect = slot.getBoundingClientRect();
      if (rect.width > 0) {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const scrollX = window.scrollX || window.pageXOffset || 0;
        activeDetailPos = {
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
        };
      }
    }
  }

  const detailStyle: React.CSSProperties = activeDetailPos
    ? {
        position: "absolute",
        top: activeDetailPos.top,
        left: activeDetailPos.left,
        width: activeDetailPos.width,
        zIndex: 30,
        overflow: "visible",
        transition: "none",
      }
    : {
        position: "absolute",
        opacity: 0,
        pointerEvents: "none",
        top: 0,
        left: 0,
        width: "100%",
        zIndex: 30,
        transition: "none",
      };

  const isPipActive =
    isNativePip ||
    Boolean(typeof document !== "undefined" && document.pictureInPictureElement);

  // When native PiP is active:
  // Render minimal 1px offscreen video wrapper so Chromium keeps PiP session alive
  // Absolutely NO big popup in the website, NO internal mini player!
  const pipUnderlyingStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    right: 0,
    width: "1px",
    height: "1px",
    opacity: 0.001,
    pointerEvents: "none",
    zIndex: -1,
    overflow: "hidden",
  };

  // Mini mode: fixed bottom-right video overlay (video only; controls bar portaled separately below)
  const miniVideoStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "calc(max(0.75rem, env(safe-area-inset-bottom, 0.75rem)) + 60px)",
    right: "0.75rem",
    width: "min(calc(100vw - 1.5rem), 400px)",
    aspectRatio: "16/9",
    zIndex: 9999,
    borderRadius: "1rem 1rem 0 0",
    overflow: "hidden",
    backgroundColor: "#000",
  };

  return (
    <>
      {/* Single VideoPlayer — always mounted, never destroyed between mode changes */}
      <div
        ref={wrapperRef}
        id="cinepvq-global-player-wrapper"
        style={
          isHidden
            ? { display: "none" }
            : isPipActive
            ? pipUnderlyingStyle
            : isDetail
            ? detailStyle
            : miniVideoStyle
        }
        aria-hidden={isHidden || isMini || isPipActive ? true : undefined}
      >
        <VideoPlayer
          key={session.movieSlug}
          videoUrl={session.videoUrl}
          movieSlug={session.movieSlug}
          movieTitle={session.movieTitle}
          imdbId={session.imdbId}
          tmdbId={session.tmdbId}
          season={session.season}
          episode={session.episode}
          type={session.type}
          poster={session.poster}
          initialTime={session.initialTime || 0}
          serverName={session.serverName}
          episodeSlug={session.episodeSlug}
          isMini={isMini}
          onTimeUpdate={(cur, dur) => {
            handleTimeUpdate(cur, dur);
            episodeHandlers.onTimeUpdate?.(cur, dur);
          }}
          onEnded={() => {
            handleVideoEnded();
            episodeHandlers.onEnded?.();
          }}
          hasPrevEpisode={
            episodeHandlers.hasPrevEpisode ??
            Boolean(
              session.episodes &&
              (session.currentEpisodeIndex ??
                session.episodes.findIndex((e) => e.slug === session.episodeSlug)) > 0
            )
          }
          hasNextEpisode={
            episodeHandlers.hasNextEpisode ??
            Boolean(
              session.episodes &&
              (session.currentEpisodeIndex ??
                session.episodes.findIndex((e) => e.slug === session.episodeSlug)) <
                session.episodes.length - 1
            )
          }
          onPrevEpisode={episodeHandlers.onPrevEpisode || goToPrevEpisode}
          onNextEpisode={episodeHandlers.onNextEpisode || goToNextEpisode}
          onPlayingChange={handlePlayingChange}
          onVideoRef={registerVideoElement}
          sourceSwitchWarning={sourceSwitchWarning}
          onTriggerSourceWarning={triggerSourceWarning}
          onDismissSourceWarning={dismissSourceWarning}
          pendingAudioWarning={pendingAudioWarning}
          onSetPendingAudioWarning={setPendingAudioWarning}
          episodeTransition={episodeTransition}
          onFinishEpisodeTransition={finishEpisodeTransition}
          availableServers={availableServers}
          activeServerIndex={activeServerIndex}
          onSwitchServer={switchServer}
          autoPlay={session.autoPlay ?? true}
          onMinimize={minimizeToMini}
          onExpand={restoreToDetail}
        />
      </div>

      {/* Hidden anchor div — always in DOM */}
      <div id="cinepvq-global-player-home" aria-hidden="true" style={{ display: "none" }} />

      {/* Mini mode controls card — portaled into body, sits below the fixed video overlay */}
      {isMini && !isPipActive && createPortal(
        <div
          id="cinepvq-mini-player-card"
          className="fixed z-[9999] select-none left-3 right-3 sm:left-auto sm:right-3 w-[calc(100vw-24px)] sm:w-[400px]"
          style={{
            bottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
            right: "0.75rem",
            width: "min(calc(100vw - 1.5rem), 400px)",
          }}
          role="region"
          aria-label="Trình phát thu nhỏ"
        >
          {/* Transparent click overlay over the video area to capture expand click */}
          <div
            className="w-full cursor-pointer"
            style={{ aspectRatio: "16/9" }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("button, input, [role='button']")) return;
              restoreToDetail();
            }}
            title="Bấm để mở lại trang phim"
          >
            {/* Hover expand hint */}
            <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-t-2xl">
              <div className="px-3 py-1.5 rounded-xl bg-black/80 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm border border-white/10">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Mở rộng</span>
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="bg-zinc-950/95 backdrop-blur-2xl rounded-b-2xl border border-zinc-700/80 border-t border-zinc-800/80 shadow-2xl ring-1 ring-white/10 p-2 sm:p-2.5 flex items-center justify-between text-white gap-2">
            {/* Movie info — click to expand */}
            <div
              onClick={restoreToDetail}
              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-1 hover:opacity-85 active:opacity-75 transition-opacity"
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 shrink-0 border border-violet-500/20">
                <Tv className="h-4 w-4" />
                {isPlaying && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
              </div>
              <div className="truncate">
                <p className="text-xs sm:text-sm font-bold truncate leading-snug text-zinc-100">
                  {session.movieTitle}
                </p>
                <p className="text-[11px] text-violet-400 font-medium truncate leading-tight">
                  {session.type === "movie" ? "Bản Full" : `Tập ${session.episode || 1}`}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-xl hover:bg-white/15 active:scale-95 text-zinc-200 hover:text-white transition-all flex items-center justify-center cursor-pointer bg-white/5"
                aria-label={isPlaying ? "Tạm dừng" : "Phát tiếp"}
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>

              {/* Expand — navigate back to detail mode */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); restoreToDetail(); }}
                className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-xl hover:bg-violet-600 active:scale-95 text-violet-400 hover:text-white transition-all flex items-center justify-center cursor-pointer bg-violet-600/15"
                aria-label="Mở lại trang phim"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeMiniPlayer(); }}
                className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] rounded-xl hover:bg-rose-600 active:scale-95 text-zinc-400 hover:text-white transition-all flex items-center justify-center cursor-pointer bg-white/5"
                aria-label="Đóng trình phát"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
