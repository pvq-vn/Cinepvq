"use client";

import React, { memo } from "react";
import Link from "next/link";
import { Bookmark, Heart, Play } from "lucide-react";
import type { Movie } from "@/types/movie";
import { useUserStore } from "@/hooks/useUserStore";
import { normalizeEpisodeLabel } from "@/lib/format";

interface MovieCardProps {
  movie: Movie;
  variant?: "default" | "compact" | "ranking" | "featured";
  rank?: number;
  priority?: boolean;
}

function MovieCardComponent({
  movie,
  variant = "default",
  rank,
  priority = false,
}: MovieCardProps) {
  const { isFavorite, toggleFavorite, isWatchlist, toggleWatchlist, mounted } = useUserStore();
  const favorited = mounted && isFavorite(movie.slug);
  const inWatchlist = mounted && isWatchlist(movie.slug);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(movie);
  };

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatchlist(movie);
  };

  const imageSrc = movie.thumb_url || movie.poster_url || "/placeholder-poster.png";

  // Compact variant (smaller card for sidebars / quick lists)
  if (variant === "compact") {
    return (
      <Link
        href={`/phim/${movie.slug}`}
        className="group flex gap-3 items-center rounded-lg p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <div className="relative aspect-[2/3] w-14 flex-shrink-0 overflow-hidden rounded-md bg-zinc-800">
          <img
            src={imageSrc}
            alt={movie.name}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">
            {movie.name}
          </h4>
          {movie.original_name && (
            <p className="text-xs text-zinc-500 truncate">
              {movie.original_name}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
            {movie.quality && <span>{movie.quality}</span>}
            {movie.current_episode && <span>• {normalizeEpisodeLabel(movie.current_episode)}</span>}
          </div>
        </div>
      </Link>
    );
  }

  // Ranking variant (e.g. Top 1, Top 2, Top 3 on Trending)
  if (variant === "ranking" && typeof rank === "number") {
    return (
      <Link
        href={`/phim/${movie.slug}`}
        className="group relative flex flex-col overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900/90 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 transition-transform duration-300 hover:ring-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1"
      >
        {/* Large stylized rank number */}
        <div className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950/90 font-black text-lg text-amber-400 shadow-md ring-1 ring-amber-400/30">
          {rank}
        </div>

        {/* Poster */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
          <img
            src={imageSrc}
            alt={movie.name}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="h-6 w-6 fill-current translate-x-0.5" />
            </div>
          </div>

          {/* Action buttons (Favorite & Watchlist) */}
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5">
            <button
              onClick={handleFavoriteClick}
              aria-label={favorited ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200 ${
                favorited
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                  : "bg-zinc-950/75 text-white/85 hover:bg-zinc-950 hover:text-white"
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${favorited ? "fill-current text-white" : ""}`}
              />
            </button>

            <button
              onClick={handleWatchlistClick}
              aria-label={inWatchlist ? "Xóa khỏi xem sau" : "Thêm vào xem sau"}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-200 ${
                inWatchlist
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 opacity-100"
                  : "bg-zinc-950/75 text-white/85 hover:bg-zinc-950 hover:text-white md:opacity-0 md:group-hover:opacity-100"
              }`}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${inWatchlist ? "fill-current text-white" : ""}`}
              />
            </button>
          </div>

          {/* Badges */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] pointer-events-none">
            {movie.quality && (
              <span className="rounded bg-violet-600 px-2 py-0.5 font-bold uppercase tracking-wider text-white shadow-sm">
                {movie.quality}
              </span>
            )}
            {movie.current_episode && (
              <span className="rounded bg-zinc-950/85 px-2 py-0.5 font-medium text-white">
                {normalizeEpisodeLabel(movie.current_episode)}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 p-3.5">
          <h3 className="text-sm font-semibold leading-snug line-clamp-1 text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors duration-200">
            {movie.name}
          </h3>
          {movie.original_name && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {movie.original_name}
            </p>
          )}
        </div>
      </Link>
    );
  }

  // Default Variant
  return (
    <Link
      href={`/phim/${movie.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900/90 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 transition-transform duration-300 hover:ring-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        <img
          src={imageSrc}
          alt={movie.name}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
        />

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="h-5 w-5 fill-current translate-x-0.5" />
          </div>
        </div>

        {/* Action buttons (Favorite & Watchlist) */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5">
          <button
            onClick={handleFavoriteClick}
            aria-label={favorited ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200 ${
              favorited
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                : "bg-zinc-950/75 text-white/85 hover:bg-zinc-950 hover:text-white"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${favorited ? "fill-current text-white" : ""}`}
            />
          </button>

          <button
            onClick={handleWatchlistClick}
            aria-label={inWatchlist ? "Xóa khỏi xem sau" : "Thêm vào xem sau"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-200 ${
              inWatchlist
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 opacity-100"
                : "bg-zinc-950/75 text-white/85 hover:bg-zinc-950 hover:text-white md:opacity-0 md:group-hover:opacity-100"
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${inWatchlist ? "fill-current text-white" : ""}`}
            />
          </button>
        </div>

        {/* Top left badge (Quality) */}
        {movie.quality && (
          <span className="absolute top-2 left-2 rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm pointer-events-none">
            {movie.quality}
          </span>
        )}

        {/* Bottom badges */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] pointer-events-none">
          {movie.year ? (
            <span className="rounded bg-zinc-950/80 px-1.5 py-0.5 text-zinc-300">
              {movie.year}
            </span>
          ) : <span />}

          {movie.current_episode && (
            <span className="rounded bg-zinc-950/85 px-2 py-0.5 font-medium text-white">
              {normalizeEpisodeLabel(movie.current_episode)}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-1 text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors duration-200">
          {movie.name}
        </h3>
        {movie.original_name && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {movie.original_name}
          </p>
        )}
      </div>
    </Link>
  );
}

const MovieCard = memo(
  MovieCardComponent,
  (prev, next) =>
    prev.movie.slug === next.movie.slug &&
    prev.movie.current_episode === next.movie.current_episode &&
    prev.variant === next.variant &&
    prev.rank === next.rank &&
    prev.priority === next.priority
);

export default MovieCard;
