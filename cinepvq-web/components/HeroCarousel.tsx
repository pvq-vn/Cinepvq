"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Play, Info, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import type { Movie } from "@/types/movie";
import { useUserStore } from "@/hooks/useUserStore";

interface HeroCarouselProps {
  movies: Movie[];
}

export default function HeroCarousel({ movies }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { isFavorite, toggleFavorite, mounted } = useUserStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const featured = movies.slice(0, 6);
  const total = featured.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || isPaused) return;
    timerRef.current = setInterval(() => {
      nextSlide();
    }, 6500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, nextSlide]);

  if (!featured || featured.length === 0) return null;

  const currentMovie = featured[currentIndex];
  const favorited = mounted && isFavorite(currentMovie.slug);

  return (
    <div
      className="relative w-full h-[70vh] min-h-[500px] max-h-[760px] overflow-hidden select-none bg-zinc-950"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Slides with crossfade */}
      {featured.map((movie, index) => {
        const isActive = index === currentIndex;
        const bgImage = movie.poster_url || movie.thumb_url;

        return (
          <div
            key={movie.slug}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {/* Background image */}
            <img
              src={bgImage}
              alt={movie.name}
              className="h-full w-full object-cover object-center transform scale-105 transition-transform duration-10000 ease-out"
              loading={index === 0 ? "eager" : "lazy"}
            />

            {/* Gradient Overlays for Cinematic Readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-zinc-950/40" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-zinc-950/30 to-zinc-950/80" />
          </div>
        );
      })}

      {/* Content Overlay */}
      <div className="relative z-20 mx-auto max-w-7xl h-full flex flex-col justify-end px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-2xl space-y-4">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {currentMovie.quality && (
              <span className="rounded-md bg-violet-600 px-2.5 py-1 text-white shadow-md shadow-violet-600/30 uppercase tracking-wider">
                {currentMovie.quality}
              </span>
            )}
            {currentMovie.current_episode && (
              <span className="rounded-md bg-white/15 backdrop-blur-md px-2.5 py-1 text-zinc-200">
                {currentMovie.current_episode}
              </span>
            )}
            {currentMovie.year && (
              <span className="rounded-md bg-black/40 backdrop-blur-md px-2.5 py-1 text-zinc-300">
                {currentMovie.year}
              </span>
            )}
            {currentMovie.time && (
              <span className="rounded-md bg-black/40 backdrop-blur-md px-2.5 py-1 text-zinc-300">
                ⏱ {currentMovie.time}
              </span>
            )}
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white drop-shadow-lg line-clamp-2 leading-tight">
              {currentMovie.name}
            </h1>
            {currentMovie.original_name && (
              <p className="mt-1 text-sm sm:text-base md:text-lg font-medium text-zinc-400 italic line-clamp-1">
                {currentMovie.original_name}
              </p>
            )}
          </div>

          {/* Short Synopsis */}
          {currentMovie.description && (
            <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed max-w-xl text-shadow-sm">
              {currentMovie.description.replace(/<[^>]*>?/gm, "")}
            </p>
          )}

          {/* Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href={`/phim/${currentMovie.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm sm:text-base font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 active:scale-95 transition-all duration-200"
            >
              <Play className="h-5 w-5 fill-current" />
              Xem ngay
            </Link>

            <Link
              href={`/phim/${currentMovie.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-3 text-sm sm:text-base font-semibold text-white active:scale-95 transition-all duration-200"
            >
              <Info className="h-5 w-5" />
              Chi tiết
            </Link>

            <button
              onClick={() => toggleFavorite(currentMovie)}
              aria-label={favorited ? "Xóa khỏi yêu thích" : "Lưu vào yêu thích"}
              className={`inline-flex items-center justify-center h-12 w-12 rounded-xl backdrop-blur-md transition-all duration-200 ${
                favorited
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Heart className={`h-5 w-5 ${favorited ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Controls: Arrows */}
      <div className="absolute right-4 sm:right-8 bottom-6 sm:bottom-10 z-30 flex items-center gap-2">
        <button
          onClick={prevSlide}
          aria-label="Phim trước"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-md hover:bg-violet-600 hover:text-white transition-all duration-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={nextSlide}
          aria-label="Phim sau"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-md hover:bg-violet-600 hover:text-white transition-all duration-200"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Slide Indicators (Dots) */}
      <div className="absolute left-4 sm:left-8 lg:left-12 bottom-6 z-30 flex items-center gap-2">
        {featured.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            aria-label={`Chuyển tới phim ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex
                ? "w-8 bg-violet-500 shadow-sm shadow-violet-500"
                : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
