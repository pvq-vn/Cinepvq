"use client";

import { useQuery } from "@tanstack/react-query";
import { getMoviesByGenre, getLatestMovies } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import { MovieCardSkeleton } from "@/components/Skeleton";
import { Sparkles } from "lucide-react";

interface SimilarMoviesProps {
  genreSlug?: string;
  currentSlug: string;
}

export default function SimilarMovies({
  genreSlug,
  currentSlug,
}: SimilarMoviesProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["similar-movies", genreSlug || "latest"],
    queryFn: async () => {
      if (genreSlug) {
        const res = await getMoviesByGenre(genreSlug, 1);
        return res.data;
      } else {
        const res = await getLatestMovies(1);
        return res.data;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const similarList = (data?.items || [])
    .filter((m) => m.slug !== currentSlug)
    .slice(0, 5);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          Phim Tương Tự
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (similarList.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-500" />
        Phim Cùng Thể Loại Có Thể Bạn Thích
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
        {similarList.map((movie) => (
          <MovieCard key={movie.slug} movie={movie} />
        ))}
      </div>
    </section>
  );
}
