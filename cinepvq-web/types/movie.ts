// ─── Common Taxonomy ────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Country {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryGroupItem {
  id: string;
  name: string;
  slug?: string;
}

export interface CategoryGroup {
  group: {
    id: string;
    name: string;
  };
  list: CategoryGroupItem[];
}

export type CategoryDict = Record<string, CategoryGroup>;

// ─── Cast & Enrichment ─────────────────────────────────────────────────────

export interface CastMember {
  name: string;
  character?: string;
  profile_url?: string;
  role?: "actor" | "director" | "Diễn viên" | "Đạo diễn" | string;
}

export interface MoviePlatformViews {
  platform: string;
  views: number;
}

export interface MovieEnrichmentData {
  slug: string;
  staticFromCache: boolean;
  casts: CastMember[];
  director: string;
  imdbId?: string;
  tmdbId?: string;
  doubanId?: string;
  ratings: {
    imdb: { score: number; votes?: number } | null;
    douban: { score: number; votes?: number; id?: string } | null;
    tmdb: { score: number; votes?: number } | null;
  };
  views: {
    total: number;
    sources: MoviePlatformViews[];
  };
  updatedAt: string;
}

// ─── Movie (list item) ────────────────────────────────────────────────────

export interface Movie {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  original_name: string;
  thumb_url: string;
  poster_url: string;
  created: string;
  modified: string;
  description: string;
  total_episodes: number;
  current_episode: string;
  time: string;
  quality: string;
  language: string;
  director: string;
  casts: string;
  year?: string | number;
  category?: Category[] | CategoryDict;
  country?: Country[];
  view?: number;
  tmdb?: {
    type?: string | null;
    id?: string | null;
    season?: number | null;
    vote_average?: number;
    vote_count?: number;
  };
  imdb?: {
    id?: string | null;
    vote_average?: number;
    vote_count?: number;
  };
  douban?: {
    id?: string | null;
    score?: number;
    votes?: number;
  };
  rank_metric?: string;
  platform_badge?: string;
}

// ─── Paginate ──────────────────────────────────────────────────────────────

export interface Paginate {
  current_page: number;
  total_page: number;
  total_items: number;
  items_per_page: number;
}

// ─── Paginated list response ───────────────────────────────────────────────

export interface PaginatedResponse {
  status: string;
  paginate: Paginate;
  items: Movie[];
}

// ─── Episode & Server (detail) ─────────────────────────────────────────────

export interface EpisodeItem {
  name: string;
  slug: string;
  embed: string;
  m3u8?: string;
}

export interface EpisodeServer {
  server_name: string;
  items: EpisodeItem[];
}

// ─── Movie detail ──────────────────────────────────────────────────────────

export interface MovieDetail {
  id: string;
  name: string;
  slug: string;
  original_name: string;
  thumb_url: string;
  poster_url: string;
  created: string;
  modified: string;
  description: string;
  total_episodes: number;
  current_episode: string;
  time: string;
  quality: string;
  language: string;
  director: string;
  casts: string;
  category: Category[] | CategoryDict;
  country?: Country[];
  episodes: EpisodeServer[];
  imdb_id?: string;
  tmdb_id?: string;
  douban_id?: string;
  view?: number;
  tmdb?: {
    type?: string | null;
    id?: string | null;
    season?: number | null;
    vote_average?: number;
    vote_count?: number;
  };
  imdb?: {
    id?: string | null;
    vote_average?: number;
    vote_count?: number;
  };
  douban?: {
    id?: string | null;
    score?: number;
    votes?: number;
  };
  cast_data?: CastMember[];
}

// ─── Detail response ───────────────────────────────────────────────────────

export interface MovieDetailResponse {
  status: string;
  movie: MovieDetail;
}

// ─── Helper Functions for parsing category dict ─────────────────────────────

export function extractCategoriesFromMovie(movie: Movie | MovieDetail): {
  formats: string[];
  genres: string[];
  year: string;
  countries: string[];
} {
  const result = {
    formats: [] as string[],
    genres: [] as string[],
    year: "",
    countries: [] as string[],
  };

  if (!movie.category) return result;

  if (Array.isArray(movie.category)) {
    result.genres = movie.category.map((c) => c.name);
    return result;
  }

  // Object structure: "1" = Định dạng, "2" = Thể loại, "3" = Năm, "4" = Quốc gia
  const dict = movie.category as CategoryDict;
  for (const key of Object.keys(dict)) {
    const group = dict[key];
    if (!group) continue;
    const groupName = group.group?.name?.toLowerCase() || "";
    const names = (group.list || []).map((item) => item.name);

    if (groupName.includes("định dạng")) {
      result.formats.push(...names);
    } else if (groupName.includes("thể loại")) {
      result.genres.push(...names);
    } else if (groupName.includes("năm")) {
      if (names.length > 0) result.year = names[0];
    } else if (groupName.includes("quốc gia")) {
      result.countries.push(...names);
    } else {
      result.genres.push(...names);
    }
  }

  return result;
}

// ─── User & App Types ──────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  role?: "user" | "admin" | "moderator";
  createdAt: string;
}

export interface FavoriteMovie {
  slug: string;
  name: string;
  original_name?: string;
  thumb_url: string;
  quality?: string;
  current_episode?: string;
  addedAt: string;
}

export interface WatchlistItem {
  slug: string;
  name: string;
  original_name?: string;
  thumb_url: string;
  poster_url?: string;
  year?: number | string;
  quality?: string;
  current_episode?: string;
  type?: "movie" | "series" | string;
  addedAt: string;
}

export interface WatchHistoryItem {
  slug: string;
  name: string;
  original_name?: string;
  thumb_url: string;
  episodeSlug?: string;
  episodeName?: string;
  currentTime?: number;
  duration?: number;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  autoPlay: boolean;
  soundEnabled: boolean;
  preferredQuality: "auto" | "HD" | "FHD";
  playbackSpeed?: number;
  preferredSource?: "auto" | "k20" | "vsmov" | "kkphim" | "nguonc";
  skipSeconds?: number;
}
