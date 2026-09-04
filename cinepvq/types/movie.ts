// ─── Common ────────────────────────────────────────────────────────────────

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

// ─── Movie (list item) ────────────────────────────────────────────────────

export interface Movie {
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
  category: Category[];
  country: Country[];
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
  category: Category[];
  country: Country[];
  episodes: EpisodeServer[];
}

// ─── Detail response ───────────────────────────────────────────────────────

export interface MovieDetailResponse {
  status: string;
  movie: MovieDetail;
}
