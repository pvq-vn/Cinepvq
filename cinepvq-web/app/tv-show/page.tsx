"use client";

import { useState } from "react";
import { useFetchMoviesByCategory } from "@/hooks/useMovies";
import CatalogPage from "@/components/CatalogPage";

export default function TVShowPage() {
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchMoviesByCategory("tv-shows", page);

  return (
    <CatalogPage
      title="Chương Trình TV Show"
      description="Tổng hợp các chương trình truyền hình thực tế, gameshow giải trí và talkshow đình đám trong nước và quốc tế."
      badge="Television Shows"
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
