import axios, { type AxiosResponse } from "axios";
import type {
  PaginatedResponse,
  MovieDetailResponse,
} from "@/types/movie";
import {
  kkphimCatalogAdapter,
  mapCategorySlugToKKPhim,
  mapGenreSlugToKKPhim,
  type KKPhimRawLatestResponse,
  type KKPhimRawV1ListResponse,
  type KKPhimRawDetailResponse,
} from "./kkphimCatalogAdapter";

// ─── Axios Instance ─────────────────────────────────────────────────────────

const kkphimBaseUrl = (
  process.env.NEXT_PUBLIC_KKPHIM_API_URL ?? "https://phimapi.com"
).replace(/\/+$/, "");

const directApi = axios.create({
  baseURL: kkphimBaseUrl,
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

export const api = directApi;

// ─── List Endpoints ──────────────────────────────────────────────────────────

/** Phim mới cập nhật */
export const getLatestMovies = async (
  page = 1
): Promise<AxiosResponse<PaginatedResponse>> => {
  const res = await directApi.get<KKPhimRawLatestResponse>(
    "danh-sach/phim-moi-cap-nhat",
    { params: { page } }
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeLatestResponse(res.data),
  };
};

/** Phim theo danh mục (dang-chieu | phim-bo | phim-le | tv-shows | hoat-hinh) */
export const getMoviesByCategory = async (
  slug: string,
  page = 1
): Promise<AxiosResponse<PaginatedResponse>> => {
  const mappedSlug = mapCategorySlugToKKPhim(slug);
  const res = await directApi.get<KKPhimRawV1ListResponse>(
    `v1/api/danh-sach/${mappedSlug}`,
    { params: { page } }
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeV1ListResponse(res.data),
  };
};

/** Phim theo thể loại (hanh-dong, tinh-cam, phim-hai, kinh-di, v.v.) */
export const getMoviesByGenre = async (
  slug: string,
  page = 1
): Promise<AxiosResponse<PaginatedResponse>> => {
  const mappedSlug = mapGenreSlugToKKPhim(slug);
  const res = await directApi.get<KKPhimRawV1ListResponse>(
    `v1/api/the-loai/${mappedSlug}`,
    { params: { page } }
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeV1ListResponse(res.data),
  };
};

/** Phim theo quốc gia (trung-quoc, han-quoc, au-my, nhat-ban, thai-lan, viet-nam, v.v.) */
export const getMoviesByCountry = async (
  slug: string,
  page = 1
): Promise<AxiosResponse<PaginatedResponse>> => {
  const res = await directApi.get<KKPhimRawV1ListResponse>(
    `v1/api/quoc-gia/${slug}`,
    { params: { page } }
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeV1ListResponse(res.data),
  };
};

/** Phim theo năm phát hành */
export const getMoviesByYear = async (
  year: number,
  page = 1
): Promise<AxiosResponse<PaginatedResponse>> => {
  const res = await directApi.get<KKPhimRawV1ListResponse>(
    `v1/api/nam/${year}`,
    { params: { page } }
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeV1ListResponse(res.data),
  };
};

export interface FilteredMoviesParams {
  category?: string; // phim-bo | phim-le | hoat-hinh | tv-shows | phim-moi-cap-nhat
  genre?: string;    // hanh-dong, tinh-cam, co-trang, ...
  country?: string;  // han-quoc, trung-quoc, au-my, ...
  year?: number | string;
  sortField?: "modified.time" | "year" | "_id";
  sortType?: "desc" | "asc";
  page?: number;
  limit?: number;
}

/**
 * Truy vấn phim kết hợp nhiều bộ lọc (Danh mục + Thể loại + Quốc gia + Năm + Sắp xếp)
 */
export const getMoviesFiltered = async ({
  category,
  genre,
  country,
  year,
  sortField = "modified.time",
  sortType = "desc",
  page = 1,
  limit = 24,
}: FilteredMoviesParams): Promise<AxiosResponse<PaginatedResponse>> => {
  const mappedGenre = genre ? mapGenreSlugToKKPhim(genre) : undefined;
  const yearParam = year ? Number(year) : undefined;

  const queryParams: Record<string, string | number> = {
    page,
    limit,
    sort_field: sortField,
    sort_type: sortType,
  };
  if (mappedGenre) queryParams.category = mappedGenre;
  if (country) queryParams.country = country;
  if (yearParam && !isNaN(yearParam)) queryParams.year = yearParam;

  let endpoint = "v1/api/danh-sach/phim-moi-cap-nhat";
  if (category) {
    const mappedCat = mapCategorySlugToKKPhim(category);
    endpoint = `v1/api/danh-sach/${mappedCat}`;
  } else if (mappedGenre) {
    endpoint = `v1/api/the-loai/${mappedGenre}`;
    delete queryParams.category;
  } else if (country) {
    endpoint = `v1/api/quoc-gia/${country}`;
    delete queryParams.country;
  } else if (yearParam && !isNaN(yearParam)) {
    endpoint = `v1/api/nam/${yearParam}`;
    delete queryParams.year;
  }

  const res = await directApi.get<KKPhimRawV1ListResponse>(endpoint, {
    params: queryParams,
  });
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeV1ListResponse(res.data),
  };
};

// ─── Search Endpoint ─────────────────────────────────────────────────────────

/** Tìm kiếm phim theo từ khóa */
export const searchMovies = async (
  keyword: string,
  page = 1
): Promise<AxiosResponse<PaginatedResponse>> => {
  const res = await directApi.get<KKPhimRawV1ListResponse>(
    "v1/api/tim-kiem",
    { params: { keyword, page } }
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeV1ListResponse(res.data),
  };
};

// ─── Movie Detail Endpoint ───────────────────────────────────────────────────

/** Chi tiết phim + danh sách tập từ KKPhim */
export const getMovieDetail = async (
  slug: string
): Promise<AxiosResponse<MovieDetailResponse>> => {
  const res = await directApi.get<KKPhimRawDetailResponse>(
    `phim/${encodeURIComponent(slug)}`
  );
  return {
    ...res,
    data: kkphimCatalogAdapter.normalizeDetailResponse(res.data),
  };
};

export default api;
