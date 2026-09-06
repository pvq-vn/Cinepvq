"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMoviesByGenre, getLatestMovies } from "@/services/api";
import MovieCard from "@/components/MovieCard";
import { MovieCardSkeleton } from "@/components/Skeleton";
import { Sparkles } from "lucide-react";
import { GENRES } from "@/lib/taxonomy";

const GENRE_NAME_TO_SLUG: Record<string, string> = {
  "hành động": "hanh-dong",
  "tình cảm": "tinh-cam",
  "hài hước": "phim-hai",
  "phim hài": "phim-hai",
  "cổ trang": "co-trang",
  "tâm lý": "tam-ly",
  "kinh dị": "kinh-di",
  "hình sự": "hinh-su",
  "khoa học viễn tưởng": "khoa-hoc-vien-tuong",
  "chính kịch": "chinh-kich",
  "phiêu lưu": "phieu-luu",
  "hoạt hình": "hoat-hinh",
  "gây cấn": "gay-can",
  "bí ẩn": "bi-an",
  "gia đình": "gia-dinh",
  "chiến tranh": "chien-tranh",
  "tài liệu": "tai-lieu",
  "võ thuật": "vo-thuat",
  "viễn tưởng": "khoa-hoc-vien-tuong",
  "thần thoại": "than-thoai",
  "học đường": "hoc-duong",
  "âm nhạc": "am-nhac",
};

interface SimilarMoviesProps {
  genreName?: string;
  genreSlug?: string;
  currentSlug: string;
}

export default function SimilarMovies({
  genreName,
  genreSlug,
  currentSlug,
}: SimilarMoviesProps) {
  // Resolve valid taxonomy slug without diacritics
  const resolvedSlug = useMemo(() => {
    if (genreSlug) {
      const cleanSlug = genreSlug.trim().toLowerCase();
      // If genreSlug is already a valid slug like "hanh-dong"
      if (GENRES.some((g) => g.slug === cleanSlug)) return cleanSlug;
      // If genreSlug had Vietnamese accents like "hành-động"
      const normalizedName = cleanSlug.replace(/-/g, " ");
      if (GENRE_NAME_TO_SLUG[normalizedName]) return GENRE_NAME_TO_SLUG[normalizedName];
    }
    if (genreName) {
      const lower = genreName.trim().toLowerCase();
      if (GENRE_NAME_TO_SLUG[lower]) return GENRE_NAME_TO_SLUG[lower];
    }
    return undefined;
  }, [genreName, genreSlug]);

  const { data, isLoading } = useQuery({
    queryKey: ["similar-movies", resolvedSlug || "latest"],
    queryFn: async () => {
      if (resolvedSlug) {
        const res = await getMoviesByGenre(resolvedSlug, 1);
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
        {genreName
          ? `Phim Cùng Thể Loại ${genreName}`
          : "Phim Cùng Thể Loại Có Thể Bạn Thích"}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
        {similarList.map((movie) => (
          <MovieCard key={movie.slug} movie={movie} />
        ))}
      </div>
    </section>
  );
}
