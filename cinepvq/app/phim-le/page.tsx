"use client";

import { useState } from "react";
import { useFetchMoviesByCategory } from "@/hooks/useMovies";
import CatalogPage from "@/components/CatalogPage";

export default function SingleMoviesPage() {
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchMoviesByCategory("phim-le", page);

  return (
    <CatalogPage
      title="Phim Lẻ Chiếu Rạp"
      description="Kho phim điện ảnh bom tấn chất lượng cao, trọn vẹn cảm xúc từ Hollywood, Châu Á đến điện ảnh thế giới."
      badge="Movies Catalog"
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
