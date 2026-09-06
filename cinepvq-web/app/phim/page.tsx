"use client";

import { useState } from "react";
import { useFetchNewMovies } from "@/hooks/useMovies";
import CatalogPage from "@/components/CatalogPage";

export default function MoviesCatalogPage() {
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchNewMovies(page);

  return (
    <CatalogPage
      title="Kho Phim Mới Cập Nhật"
      description="Khám phá toàn bộ các tác phẩm điện ảnh và phim truyền hình được cập nhật mới nhất trên hệ thống Cinépvq."
      badge="Tất cả phim"
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
