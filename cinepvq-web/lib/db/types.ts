// ==============================================================================
// lib/db/types.ts
// Database Row Types and Mapping to Application Models
// ==============================================================================

import type {
  MovieDetail,
  EpisodeServer,
  Category,
  Country,
  UserProfile,
  AppSettings,
} from "@/types/movie";

// ─── Database Row Interfaces ──────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  avatar_url: string | null;
  role: "user" | "admin" | "moderator";
  created_at: Date;
  updated_at: Date;
}

export interface MovieRow {
  id: string;
  slug: string;
  name: string;
  original_name: string | null;
  description: string | null;
  thumb_url: string | null;
  poster_url: string | null;
  year: number | null;
  total_episodes: number;
  current_episode: string | null;
  duration: string | null;
  quality: string | null;
  language: string | null;
  director: string | null;
  casts: string | null;
  source: string;
  metadata_status: "pending" | "ready" | "enriching" | "failed";
  ai_enriched: boolean;
  ai_enriched_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GenreRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
}

export interface CountryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
}

export interface ServerRow {
  id: string;
  movie_id: string;
  server_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface EpisodeRow {
  id: string;
  movie_id: string;
  server_id: string;
  name: string;
  slug: string;
  embed_url: string;
  episode_number: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface FavoriteRow {
  user_id: string;
  movie_id: string;
  created_at: Date;
}

export interface WatchHistoryRow {
  id: string;
  user_id: string;
  movie_id: string;
  episode_id: string | null;
  last_position_seconds: number;
  created_at: Date;
  updated_at: Date;
}

export interface CommentRow {
  id: string;
  user_id: string;
  movie_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: Date;
}

export interface UserSettingsRow {
  user_id: string;
  theme: "dark" | "light" | "system";
  autoplay: boolean;
  sound_enabled: boolean;
  preferred_quality: "auto" | "HD" | "FHD";
  playback_speed?: number | string | null;
  preferred_source?: "auto" | "k20" | "vsmov" | "kkphim" | "nguonc" | null;
  updated_at: Date;
}


// ─── Enriched Movie Detail with Joined Relations ──────────────────────────────

export interface MovieWithRelationsRow extends MovieRow {
  genres?: { id: string; name: string; slug: string }[];
  countries?: { id: string; name: string; slug: string }[];
  servers?: {
    id: string;
    server_name: string;
    episodes: {
      name: string;
      slug: string;
      embed: string;
    }[];
  }[];
}

// ─── Transformation Mappers ───────────────────────────────────────────────────

export function mapMovieRowToDetail(
  movie: MovieRow,
  categories: Category[] = [],
  countries: Country[] = [],
  episodes: EpisodeServer[] = []
): MovieDetail {
  return {
    id: movie.id,
    slug: movie.slug,
    name: movie.name,
    original_name: movie.original_name ?? "",
    description: movie.description ?? "",
    thumb_url: movie.thumb_url ?? "",
    poster_url: movie.poster_url ?? "",
    created: movie.created_at.toISOString(),
    modified: movie.updated_at.toISOString(),
    total_episodes: movie.total_episodes,
    current_episode: movie.current_episode ?? "",
    time: movie.duration ?? "",
    quality: movie.quality ?? "",
    language: movie.language ?? "",
    director: movie.director ?? "",
    casts: movie.casts ?? "",
    category: categories,
    country: countries,
    episodes,
  };
}

export function mapUserRowToProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapSettingsRowToAppSettings(row: UserSettingsRow): AppSettings {
  const speed = row.playback_speed ? Number(row.playback_speed) : 1;
  const validSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const cleanSpeed = validSpeeds.includes(speed) ? speed : 1;
  const validSources = ["auto", "k20", "vsmov", "kkphim", "nguonc"];
  const cleanSource =
    row.preferred_source && validSources.includes(row.preferred_source)
      ? (row.preferred_source as AppSettings["preferredSource"])
      : "auto";

  return {
    theme: row.theme,
    autoPlay: row.autoplay,
    soundEnabled: row.sound_enabled,
    preferredQuality: row.preferred_quality,
    playbackSpeed: cleanSpeed,
    preferredSource: cleanSource,
  };
}
