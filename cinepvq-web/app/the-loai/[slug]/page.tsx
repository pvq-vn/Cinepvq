"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useFetchMoviesByGenre } from "@/hooks/useMovies";
import { GENRE_MAP } from "@/lib/taxonomy";
import CatalogPage from "@/components/CatalogPage";

export default function GenreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchMoviesByGenre(slug, page);

  const genreName = GENRE_MAP[slug] || slug;

  return (
    <CatalogPage
      title={`Phim ${genreName}`}
      description={`Khám phá danh sách các bộ phim thể loại ${genreName} được chọn lọc và cập nhật mới nhất.`}
      badge="Thể loại"
      movies={movies}
      paginate={paginate}
      isLoading={isLoading}
      isError={isError}
      currentPage={page}
      onPageChange={setPage}
      onRetry={refetch}
    />
  );
}
