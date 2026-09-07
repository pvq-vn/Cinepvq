// cinepvq-web/services/kkphimCatalogAdapter.ts
/**
 * KKPhim Catalog Adapter
 * 
 * Normalizes responses from phimapi.com (KKPhim API) to Cinepvq schema.
 * All normalization logic is isolated here; services/api.ts only calls
 * upstream endpoints and invokes this adapter.
 */

import type {
  Movie,
  MovieDetail,
  PaginatedResponse,
  MovieDetailResponse,
  CategoryDict,
  Country,
  EpisodeServer,
  CategoryGroupItem,
} from "@/types/movie";

// ─── Taxonomy Mappings ────────────────────────────────────────────────────────

/** Maps Cinepvq category slug to KKPhim category slug */
export const CINEPVQ_TO_KKPHIM_CATEGORY_MAP: Record<string, string> = {
  "dang-chieu": "phim-chieu-rap",
};

/** Maps Cinepvq genre slug to KKPhim genre slug */
export const CINEPVQ_TO_KKPHIM_GENRE_MAP: Record<string, string> = {
  "phim-hai": "hai-huoc",
  "khoa-hoc-vien-tuong": "vien-tuong",
};

/** Maps KKPhim genre slug back to Cinepvq genre slug */
export const KKPHIM_TO_CINEPVQ_GENRE_MAP: Record<string, string> = {
  "hai-huoc": "phim-hai",
  "vien-tuong": "khoa-hoc-vien-tuong",
};

/** Maps KKPhim category slug back to Cinepvq category slug */
export const KKPHIM_TO_CINEPVQ_CATEGORY_MAP: Record<string, string> = {
  "phim-chieu-rap": "dang-chieu",
};

export function mapCategorySlugToKKPhim(slug: string): string {
  return CINEPVQ_TO_KKPHIM_CATEGORY_MAP[slug] || slug;
}

export function mapGenreSlugToKKPhim(slug: string): string {
  return CINEPVQ_TO_KKPHIM_GENRE_MAP[slug] || slug;
}

// ─── KKPhim Upstream Raw Types ───────────────────────────────────────────────

export interface KKPhimPagination {
  totalItems?: number;
  totalItemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
}

export interface KKPhimCategoryItem {
  id?: string;
  name: string;
  slug: string;
}

export interface KKPhimCountryItem {
  id?: string;
  name: string;
  slug: string;
}

export interface KKPhimDateObj {
  time?: string;
}

export interface KKPhimTmdb {
  type?: string;
  id?: string | number;
  season?: number;
  vote_average?: number;
  vote_count?: number;
}

export interface KKPhimImdb {
  id?: string | null;
  vote_average?: number;
  vote_count?: number;
}

export interface KKPhimEpisodeServerData {
  name: string;
  slug: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
}

export interface KKPhimEpisodeServer {
  server_name: string;
  server_data: KKPhimEpisodeServerData[];
}

export interface KKPhimRawMovie {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  original_name?: string;
  content?: string;
  type?: string;
  status?: string;
  thumb_url?: string;
  poster_url?: string;
  is_copyright?: boolean;
  sub_docquyen?: boolean;
  chieurap?: boolean;
  trailer_url?: string;
  time?: string;
  episode_current?: string;
  episode_total?: string | number;
  quality?: string;
  lang?: string;
  notify?: string;
  showtimes?: string;
  year?: number | string;
  view?: number;
  actor?: string[] | string;
  director?: string[] | string;
  category?: KKPhimCategoryItem[];
  country?: KKPhimCountryItem[];
  tmdb?: KKPhimTmdb;
  imdb?: KKPhimImdb;
  created?: KKPhimDateObj | string;
  modified?: KKPhimDateObj | string;
}

export interface KKPhimRawLatestItem {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  original_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number | string;
  modified?: KKPhimDateObj | string;
  tmdb?: KKPhimTmdb;
  imdb?: KKPhimImdb;
}

export interface KKPhimRawLatestResponse {
  status?: boolean | string;
  msg?: string;
  items?: KKPhimRawLatestItem[];
  pagination?: KKPhimPagination;
}

export interface KKPhimRawV1ListResponse {
  status?: boolean | string;
  msg?: string;
  data?: {
    seoOnPage?: unknown;
    breadCrumb?: unknown;
    titlePage?: string;
    items?: KKPhimRawMovie[];
    params?: {
      pagination?: KKPhimPagination;
    };
    APP_DOMAIN_CDN_IMAGE?: string;
  };
}

export interface KKPhimRawDetailResponse {
  status?: boolean | string;
  msg?: string;
  movie?: KKPhimRawMovie;
  episodes?: KKPhimEpisodeServer[];
}

// ─── Normalization Helpers ───────────────────────────────────────────────────

/** Normalizes relative or absolute image URL to a full valid URL */
export function normalizeImageUrl(
  url?: string | null,
  cdnBase = "https://phimimg.com"
): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const cleanBase = cdnBase.replace(/\/+$/, "");
  const cleanPath = trimmed.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

/** Extracts ISO date string from KKPhim date field (string or { time: string }) */
function extractDateString(val?: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "time" in val) {
    const t = (val as { time: unknown }).time;
    return typeof t === "string" ? t : String(t || "");
  }
  return "";
}

/** Joins array of strings or returns string, neutral empty string if absent */
function normalizeStringArray(val?: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(", ");
  }
  return "";
}

/** Maps KKPhim type (series/single/hoathinh/tvshows) to Vietnamese display name & slug */
function formatTypeToItem(type?: string): CategoryGroupItem[] {
  switch (type) {
    case "series":
      return [{ id: "series", name: "Phim bộ", slug: "phim-bo" }];
    case "single":
      return [{ id: "single", name: "Phim lẻ", slug: "phim-le" }];
    case "hoathinh":
      return [{ id: "hoathinh", name: "Hoạt hình", slug: "hoat-hinh" }];
    case "tvshows":
      return [{ id: "tvshows", name: "TV Shows", slug: "tv-shows" }];
    default:
      return [];
  }
}

/**
 * Builds CategoryDict satisfying extractCategoriesFromMovie:
 * "1" = Định dạng, "2" = Thể loại, "3" = Năm, "4" = Quốc gia
 */
export function buildCategoryDict(
  categories?: KKPhimCategoryItem[],
  countries?: KKPhimCountryItem[],
  year?: number | string,
  type?: string
): CategoryDict {
  const formatList = formatTypeToItem(type);

  const genreList: CategoryGroupItem[] = (categories || []).map((cat) => ({
    id: cat.id || cat.slug,
    name: cat.name,
    slug: KKPHIM_TO_CINEPVQ_GENRE_MAP[cat.slug] || cat.slug,
  }));

  const yearStr = year ? String(year).trim() : "";
  const yearList: CategoryGroupItem[] = yearStr
    ? [{ id: "year", name: yearStr, slug: yearStr }]
    : [];

  const countryList: CategoryGroupItem[] = (countries || []).map((c) => ({
    id: c.id || c.slug,
    name: c.name,
    slug: c.slug,
  }));

  return {
    "1": {
      group: { id: "1", name: "Định dạng" },
      list: formatList,
    },
    "2": {
      group: { id: "2", name: "Thể loại" },
      list: genreList,
    },
    "3": {
      group: { id: "3", name: "Năm" },
      list: yearList,
    },
    "4": {
      group: { id: "4", name: "Quốc gia" },
      list: countryList,
    },
  };
}

/** Normalizes KKPhim country array to Cinepvq Country[] */
export function normalizeCountries(countries?: KKPhimCountryItem[]): Country[] {
  if (!Array.isArray(countries)) return [];
  return countries.map((c) => ({
    id: c.id || c.slug,
    name: c.name,
    slug: c.slug,
  }));
}

/** Normalizes KKPhim episode servers to Cinepvq EpisodeServer[] */
export function normalizeEpisodes(episodes?: KKPhimEpisodeServer[]): EpisodeServer[] {
  if (!Array.isArray(episodes)) return [];
  return episodes.map((server) => ({
    server_name: server.server_name || "Vietsub",
    items: Array.isArray(server.server_data)
      ? server.server_data.map((ep) => ({
          name: ep.name || "",
          slug: ep.slug || "",
          embed: ep.link_embed || ep.link_m3u8 || "",
        }))
      : [],
  }));
}

// ─── Main Normalization Functions ────────────────────────────────────────────

/** Normalizes a single movie item from either latest list or v1 filtered list */
export function normalizeMovieItem(
  raw: KKPhimRawMovie | KKPhimRawLatestItem,
  cdnBase = "https://phimimg.com"
): Movie {
  const poster = normalizeImageUrl(raw.poster_url, cdnBase);
  const thumb = normalizeImageUrl(raw.thumb_url, cdnBase);
  const modifiedDate = extractDateString(raw.modified);
  const createdDate = "created" in raw ? extractDateString(raw.created) : modifiedDate;

  const rawAsMovie = raw as KKPhimRawMovie;

  const totalEpisodes =
    typeof rawAsMovie.episode_total === "number"
      ? rawAsMovie.episode_total
      : parseInt(String(rawAsMovie.episode_total || "").replace(/\D/g, ""), 10) || 0;

  const yearNum = raw.year
    ? typeof raw.year === "number"
      ? raw.year
      : parseInt(String(raw.year), 10) || raw.year
    : undefined;

  return {
    name: raw.name || "",
    slug: raw.slug || "",
    original_name: raw.origin_name || raw.original_name || "",
    thumb_url: thumb || poster,
    poster_url: poster || thumb,
    created: createdDate || modifiedDate || "",
    modified: modifiedDate || createdDate || "",
    description: rawAsMovie.content || (rawAsMovie as { description?: string }).description || "",
    total_episodes: totalEpisodes,
    current_episode: rawAsMovie.episode_current || "",
    time: rawAsMovie.time || "",
    quality: rawAsMovie.quality || "",
    language: rawAsMovie.lang || "",
    director: normalizeStringArray(rawAsMovie.director),
    casts: normalizeStringArray(rawAsMovie.actor),
    year: yearNum,
    category: buildCategoryDict(rawAsMovie.category, rawAsMovie.country, raw.year, rawAsMovie.type),
    country: normalizeCountries(rawAsMovie.country),
  };
}

/** Normalizes KKPhim movie detail to Cinepvq MovieDetail */
export function normalizeMovieDetail(
  raw: KKPhimRawMovie,
  episodes: KKPhimEpisodeServer[] = [],
  cdnBase = "https://phimimg.com"
): MovieDetail {
  const baseMovie = normalizeMovieItem(raw, cdnBase);
  const categoryDict = buildCategoryDict(raw.category, raw.country, raw.year, raw.type);

  const imdbId =
    typeof raw.imdb?.id === "string" && raw.imdb.id.trim().length > 0
      ? raw.imdb.id.trim()
      : undefined;

  return {
    ...baseMovie,
    id: raw._id || raw.id || raw.slug || "",
    category: categoryDict,
    episodes: normalizeEpisodes(episodes),
    imdb_id: imdbId,
  };
}

/** Normalizes response from /danh-sach/phim-moi-cap-nhat */
export function normalizeLatestResponse(raw: KKPhimRawLatestResponse): PaginatedResponse {
  const items = (raw.items || []).map((item) =>
    normalizeMovieItem(item, "https://phimimg.com")
  );
  const p = raw.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: items.length,
    totalItemsPerPage: 24,
  };

  return {
    status: "success",
    items,
    paginate: {
      current_page: p.currentPage || 1,
      total_page: p.totalPages || 1,
      total_items: p.totalItems ?? items.length,
      items_per_page: p.totalItemsPerPage || 24,
    },
  };
}

/** Normalizes response from /v1/api/* (danh-sach, the-loai, quoc-gia, nam, tim-kiem) */
export function normalizeV1ListResponse(raw: KKPhimRawV1ListResponse): PaginatedResponse {
  const cdnBase = raw.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";
  const rawItems = raw.data?.items || [];
  const items = rawItems.map((item) => normalizeMovieItem(item, cdnBase));
  const p = raw.data?.params?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: items.length,
    totalItemsPerPage: 24,
  };

  return {
    status: "success",
    items,
    paginate: {
      current_page: p.currentPage || 1,
      total_page: p.totalPages || 1,
      total_items: p.totalItems ?? items.length,
      items_per_page: p.totalItemsPerPage || 24,
    },
  };
}

/** Normalizes response from /phim/{slug} */
export function normalizeDetailResponse(raw: KKPhimRawDetailResponse): MovieDetailResponse {
  if (!raw.movie) {
    throw new Error("KKPhim response does not contain movie details");
  }

  return {
    status: "success",
    movie: normalizeMovieDetail(raw.movie, raw.episodes || []),
  };
}

export const kkphimCatalogAdapter = {
  normalizeImageUrl,
  normalizeMovieItem,
  normalizeMovieDetail,
  normalizeLatestResponse,
  normalizeV1ListResponse,
  normalizeDetailResponse,
  buildCategoryDict,
  normalizeCountries,
  normalizeEpisodes,
  mapCategorySlugToKKPhim,
  mapGenreSlugToKKPhim,
};
