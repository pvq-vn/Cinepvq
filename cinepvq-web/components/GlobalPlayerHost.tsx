"use client";

import React, { useEffect, useRef } from "react";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
import VideoPlayer from "@/components/VideoPlayer";
import { X, Maximize2, Tv, PictureInPicture, Play, Pause } from "lucide-react";

export default function GlobalPlayerHost() {
  const {
    session,
    mode,
    isPlaying,
    playerContainerRef,
    videoRef,
    episodeHandlers,
    closeMiniPlayer,
    restoreToDetail,
    handleTimeUpdate,
    handlePlayingChange,
    handleVideoEnded,
    goToNextEpisode,
    goToPrevEpisode,
    registerVideoElement,
  } = useGlobalPlayer();

  const miniContainerRef = useRef<HTMLDivElement>(null);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  // Synchronize player container DOM placement according to current mode
  useEffect(() => {
    const el = playerContainerRef.current;
    if (!el || !session) return;

    if (mode === "detail") {
      const slot = document.getElementById("cinepvq-player-slot");
      if (slot && el.parentElement !== slot) {
        slot.appendChild(el);
      }
    } else if (mode === "mini") {
      const miniSlot = document.getElementById("cinepvq-mini-slot");
      if (miniSlot && el.parentElement !== miniSlot) {
        miniSlot.appendChild(el);
      }
    } else {
      const homeSlot = document.getElementById("cinepvq-global-player-home");
      if (homeSlot && el.parentElement !== homeSlot) {
        homeSlot.appendChild(el);
      }
    }
  }, [mode, session, playerContainerRef]);

  // Standard Browser PiP toggle helper
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
      console.warn("[GlobalMiniPlayer] PiP toggle error:", err);
    }
  };

  return (
    <>
      {/* 1. Permanent Hidden Anchor in Root Layout */}
      <div id="cinepvq-global-player-home" className="hidden" aria-hidden="true">
        {session && (
          <div
            ref={playerContainerRef}
            id="cinepvq-global-player-wrapper"
            className="w-full h-full"
          >
            <VideoPlayer
              key={`${session.movieSlug}_${session.serverName || ""}_${session.episodeSlug || ""}_${session.videoUrl}`}
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
            />
          </div>
        )}
      </div>

      {/* 2. Global Floating Mini Player (Visible when in mini mode) */}
      {session && mode === "mini" && (
        <div
          ref={miniContainerRef}
          id="cinepvq-mini-player-card"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[300px] sm:w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden border border-zinc-700/80 bg-zinc-950 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200 group"
          role="region"
          aria-label="Trình phát thu nhỏ"
        >
          {/* Mini Player Video Slot */}
          <div
            id="cinepvq-mini-slot"
            className="w-full aspect-video relative bg-black cursor-pointer overflow-hidden"
            onClick={(e) => {
              // Clicking outside controls restores to movie detail
              const target = e.target as HTMLElement;
              if (target.closest("button, input, [role='button']")) return;
              restoreToDetail();
            }}
          />

          {/* Mini Player Top Control Bar */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-2 sm:p-2.5 flex items-center justify-between text-white z-20 pointer-events-auto">
            <div
              onClick={restoreToDetail}
              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-2"
              title="Bấm để quay lại trang phim"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600/30 text-violet-400 shrink-0">
                <Tv className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold truncate leading-tight">
                  {session.movieTitle}
                </p>
                <p className="text-[10px] text-violet-400 font-medium leading-tight">
                  {session.type === "movie" ? "Bản Full" : `Tập ${session.episode || 1}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Play / Pause Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isPlaying ? "Tạm dừng" : "Phát tiếp"}
                aria-label={isPlaying ? "Tạm dừng" : "Phát tiếp"}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
              </button>

              {/* Browser PiP Button */}
              {typeof document !== "undefined" && document.pictureInPictureEnabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleBrowserPiP();
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Hình trong hình hệ thống"
                  aria-label="Hình trong hình hệ thống"
                >
                  <PictureInPicture className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Restore to Full Page */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  restoreToDetail();
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Mở toàn trang"
                aria-label="Mở toàn trang"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>

              {/* Close Mini Player */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeMiniPlayer();
                }}
                className="p-1.5 rounded-lg hover:bg-rose-600/80 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Đóng trình phát thu nhỏ"
                aria-label="Đóng trình phát thu nhỏ"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
