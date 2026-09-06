"use client";

import { useState } from "react";
import { useFetchMoviesByCategory } from "@/hooks/useMovies";
import CatalogPage from "@/components/CatalogPage";

export default function AnimePage() {
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchMoviesByCategory("hoat-hinh", page);

  return (
    <CatalogPage
      title="Hoạt Hình & Anime"
      description="Thế giới anime Nhật Bản, hoạt hình 3D Trung Quốc và các tác phẩm hoạt hoạ kinh điển quốc tế."
      badge="Animation & Anime"
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
