import { query } from "@/lib/db/client";
import { userRepository } from "@/lib/repositories/userRepository";
import type { FavoriteMovie } from "@/types/movie";

interface FavoriteJoinedRow {
  slug: string;
  name: string;
  original_name: string | null;
  thumb_url: string | null;
  quality: string | null;
  current_episode: string | null;
  created_at: Date;
}

export async function ensureMovieStub(movie: {
  slug: string;
  name?: string;
  original_name?: string;
  thumb_url?: string;
  quality?: string;
  current_episode?: string;
}): Promise<string | null> {
  const existing = await query<{ id: string }>(
    "SELECT id FROM movies WHERE slug = $1 LIMIT 1",
    [movie.slug]
  );
  if (existing?.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const res = await query<{ id: string }>(
    `INSERT INTO movies (
       slug, name, original_name, thumb_url, quality, current_episode, source, metadata_status
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'nguonc', 'pending'
     )
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       thumb_url = COALESCE(EXCLUDED.thumb_url, movies.thumb_url)
     RETURNING id;`,
    [
      movie.slug,
      movie.name || movie.slug,
      movie.original_name ?? null,
      movie.thumb_url ?? null,
      movie.quality ?? null,
      movie.current_episode ?? null,
    ]
  );

  return res?.rows[0]?.id ?? null;
}

export const favoriteRepository = {
  /**
   * Get all favorites for a user ordered by added date descending.
   */
  async getFavoritesByUserId(userId: string): Promise<FavoriteMovie[]> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return [];

    const res = await query<FavoriteJoinedRow>(
      `SELECT m.slug, m.name, m.original_name, m.thumb_url, m.quality, m.current_episode, f.created_at
       FROM favorites f
       JOIN movies m ON f.movie_id = m.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [realUserId]
    );

    if (!res) return [];

    return res.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      original_name: row.original_name ?? undefined,
      thumb_url: row.thumb_url ?? "",
      quality: row.quality ?? undefined,
      current_episode: row.current_episode ?? undefined,
      addedAt: row.created_at.toISOString(),
    }));
  },

  /**
   * Check if a movie is favorited by the user.
   */
  async isFavorite(userId: string, movieSlug: string): Promise<boolean> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return false;

    const res = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM favorites f
         JOIN movies m ON f.movie_id = m.id
         WHERE f.user_id = $1 AND m.slug = $2
       ) as exists`,
      [realUserId, movieSlug]
    );
    return Boolean(res?.rows[0]?.exists);
  },

  /**
   * Add a movie to favorites by slug (or movie payload).
   */
  async addFavorite(
    userId: string,
    movieInput:
      | string
      | {
          slug: string;
          name?: string;
          original_name?: string;
          thumb_url?: string;
          quality?: string;
          current_episode?: string;
        }
  ): Promise<boolean> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return false;

    const movieObj =
      typeof movieInput === "string" ? { slug: movieInput } : movieInput;
    const movieId = await ensureMovieStub(movieObj);
    if (!movieId) return false;

    await query(
      `INSERT INTO favorites (user_id, movie_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, movie_id) DO NOTHING`,
      [realUserId, movieId]
    );
    return true;
  },

  /**
   * Remove a movie from favorites by slug.
   */
  async removeFavorite(userId: string, movieSlug: string): Promise<boolean> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return false;

    const res = await query(
      `DELETE FROM favorites f
       USING movies m
       WHERE f.movie_id = m.id AND f.user_id = $1 AND m.slug = $2`,
      [realUserId, movieSlug]
    );
    return (res?.rowCount ?? 0) > 0;
  },

  /**
   * Toggle favorite status. Returns true if added, false if removed.
   */
  async toggleFavorite(
    userId: string,
    movieInput:
      | string
      | {
          slug: string;
          name?: string;
          original_name?: string;
          thumb_url?: string;
          quality?: string;
          current_episode?: string;
        }
  ): Promise<boolean> {
    const slug = typeof movieInput === "string" ? movieInput : movieInput.slug;
    const isFav = await this.isFavorite(userId, slug);
    if (isFav) {
      await this.removeFavorite(userId, slug);
      return false;
    } else {
      await this.addFavorite(userId, movieInput);
      return true;
    }
  },

  /**
   * Bulk sync client favorites into Supabase PostgreSQL.
   */
  async bulkSyncFavorites(
    userId: string,
    favorites: FavoriteMovie[]
  ): Promise<FavoriteMovie[]> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return [];

    for (const fav of favorites) {
      try {
        const movieId = await ensureMovieStub(fav);
        if (movieId) {
          const addedAt = fav.addedAt ? new Date(fav.addedAt) : new Date();
          await query(
            `INSERT INTO favorites (user_id, movie_id, created_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, movie_id) DO NOTHING`,
            [realUserId, movieId, addedAt]
          );
        }
      } catch (err) {
        console.warn("[Favorites bulkSync item error]", err);
      }
    }

    return this.getFavoritesByUserId(realUserId);
  },
};
