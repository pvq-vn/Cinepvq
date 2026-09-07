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
