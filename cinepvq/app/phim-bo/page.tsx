"use client";

import { useState } from "react";
import { useFetchMoviesByCategory } from "@/hooks/useMovies";
import CatalogPage from "@/components/CatalogPage";

export default function SeriesMoviesPage() {
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchMoviesByCategory("phim-bo", page);

  return (
    <CatalogPage
      title="Phim Bộ Đặc Sắc"
      description="Tuyển tập các bộ phim truyền hình dài tập vietsub hay nhất, cập nhật liên tục các tập mới mỗi ngày."
      badge="Series Catalog"
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
