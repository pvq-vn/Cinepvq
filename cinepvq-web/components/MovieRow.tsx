"use client";

import { useRef, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Movie } from "@/types/movie";
import MovieCard from "@/components/MovieCard";

interface MovieRowProps {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  movies: Movie[];
  variant?: "default" | "ranking";
}

export default function MovieRow({
  title,
  subtitle,
  seeAllHref,
  movies,
  variant = "default",
}: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const uniqueMovies = useMemo(() => {
    if (!movies || movies.length === 0) return [];
    const seen = new Set<string>();
    const result: Movie[] = [];
    for (const m of movies) {
      const id = m.id || m.slug;
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(m);
      } else if (!id) {
        result.push(m);
      }
    }
    return result;
  }, [movies]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const scrollAmount = clientWidth * 0.75;
    scrollRef.current.scrollTo({
      left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: "smooth",
    });
  };

  if (!uniqueMovies || uniqueMovies.length === 0) return null;

  return (
    <section className="relative space-y-3.5 my-8">
      {/* Header */}
      <div className="flex items-end justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="text-xs sm:text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Navigation arrow buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => handleScroll("left")}
              aria-label="Cuộn sang trái"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleScroll("right")}
              aria-label="Cuộn sang phải"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal scrolling strip */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 pb-3 pt-1 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {uniqueMovies.map((movie, index) => (
          <div
            key={movie.slug}
            className="w-[150px] sm:w-[190px] md:w-[210px] flex-shrink-0"
          >
            <MovieCard
              movie={movie}
              variant={variant}
              rank={variant === "ranking" ? index + 1 : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
