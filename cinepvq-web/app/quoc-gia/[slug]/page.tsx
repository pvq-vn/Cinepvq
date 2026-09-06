"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useFetchMoviesByCountry } from "@/hooks/useMovies";
import { COUNTRY_MAP } from "@/lib/taxonomy";
import CatalogPage from "@/components/CatalogPage";

export default function CountryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { data: movies, paginate, isLoading, isError, refetch } =
    useFetchMoviesByCountry(slug, page);

  const countryName = COUNTRY_MAP[slug] || slug;

  return (
    <CatalogPage
      title={`Điện Ảnh ${countryName}`}
      description={`Tuyển tập các tác phẩm điện ảnh xuất sắc và được yêu thích nhất đến từ ${countryName}.`}
      badge="Quốc gia"
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
