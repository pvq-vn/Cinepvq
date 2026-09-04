import axios, { type AxiosRequestConfig } from "axios";
import type {
  PaginatedResponse,
  MovieDetailResponse,
} from "@/types/movie";

// ─── Axios instance ────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: "/api/proxy/nguonc/",
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

// Some networks block the server-side proxy from reaching NguonC while the
// visitor's browser can still reach its public API. Keep the proxy as the
// primary path and use the public API only for upstream connection failures.
const directApi = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_NGUONC_API_URL ?? "https://phim.nguonc.com/api/",
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

async function get<T>(path: string, config?: AxiosRequestConfig) {
  try {
    return await api.get<T>(path, config);
  } catch (error) {
    if (
      !axios.isAxiosError(error) ||
      (error.response && ![502, 504].includes(error.response.status))
    ) {
      throw error;
    }

    return directApi.get<T>(path, config);
  }
}

// ─── List endpoints ────────────────────────────────────────────────────────

/** Phim mới cập nhật */
export const getLatestMovies = (page = 1) =>
  get<PaginatedResponse>("films/phim-moi-cap-nhat", {
    params: { page },
  });

/** Phim theo danh mục (dang-chieu | phim-bo | phim-le | tv-shows | hoat-hinh) */
export const getMoviesByCategory = (slug: string, page = 1) =>
  get<PaginatedResponse>(`films/danh-sach/${slug}`, {
    params: { page },
  });

/** Phim theo thể loại (hanh-dong, tinh-cam, phim-hai, kinh-di, v.v.) */
export const getMoviesByGenre = (slug: string, page = 1) =>
  get<PaginatedResponse>(`films/the-loai/${slug}`, {
    params: { page },
  });

/** Phim theo quốc gia (trung-quoc, han-quoc, au-my, nhat-ban, thai-lan, viet-nam, v.v.) */
export const getMoviesByCountry = (slug: string, page = 1) =>
  get<PaginatedResponse>(`films/quoc-gia/${slug}`, {
    params: { page },
  });

/** Phim theo năm phát hành */
export const getMoviesByYear = (year: number, page = 1) =>
  get<PaginatedResponse>(`films/nam-phat-hanh/${year}`, {
    params: { page },
  });

// ─── Search ────────────────────────────────────────────────────────────────

/** Tìm kiếm phim theo từ khóa */
export const searchMovies = (keyword: string, page = 1) =>
  get<PaginatedResponse>("films/search", {
    params: { keyword, page },
  });

// ─── Detail ────────────────────────────────────────────────────────────────

/** Chi tiết phim + danh sách tập */
export const getMovieDetail = (slug: string) =>
  get<MovieDetailResponse>(`film/${slug}`);

export default api;
