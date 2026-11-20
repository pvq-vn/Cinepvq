import { query } from "@/lib/db/client";
import { userRepository } from "@/lib/repositories/userRepository";
import { getUnifiedMovieDetail } from "@/services/unifiedCatalog";
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

export function isBrokenOrStalePosterUrl(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed || !trimmed.startsWith("http")) return true;
  if (trimmed.includes("phim.nguonc.com/public/images/")) return true;
  return false;
}

export function normalizePosterUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://phimimg.com/${trimmed.replace(/^\/+/, "")}`;
}

export async function ensureMovieStub(movie: {
  slug: string;
  name?: string;
  original_name?: string;
  thumb_url?: string;
  quality?: string;
  current_episode?: string;
}): Promise<string | null> {
  const existing = await query<{
    id: string;
    name: string | null;
    original_name: string | null;
    thumb_url: string | null;
  }>(
    "SELECT id, name, original_name, thumb_url FROM movies WHERE slug = $1 LIMIT 1",
    [movie.slug]
  );

  let resolvedName =
    movie.name && movie.name.trim() && movie.name.trim() !== movie.slug
      ? movie.name.trim()
      : existing?.rows[0]?.name && existing.rows[0].name !== movie.slug
      ? existing.rows[0].name
      : "";
  let resolvedOrig = movie.original_name || existing?.rows[0]?.original_name || null;
  let resolvedThumb = !isBrokenOrStalePosterUrl(movie.thumb_url)
    ? normalizePosterUrl(movie.thumb_url)
    : !isBrokenOrStalePosterUrl(existing?.rows[0]?.thumb_url)
    ? normalizePosterUrl(existing?.rows[0]?.thumb_url)
    : "";

  if (!resolvedName || !resolvedThumb) {
    try {
      const detailResp = await getUnifiedMovieDetail(movie.slug);
      const detail = detailResp?.movie;
      if (detail) {
        if (!resolvedName && detail.name) resolvedName = detail.name;
        if (!resolvedOrig && detail.original_name) resolvedOrig = detail.original_name;
        const candidateThumb = detail.thumb_url || detail.poster_url || "";
        if (!resolvedThumb && !isBrokenOrStalePosterUrl(candidateThumb)) {
          resolvedThumb = normalizePosterUrl(candidateThumb);
        }
      }
    } catch {
      // Ignore catalog lookup error
    }
  }

  if (existing?.rows[0]?.id) {
    const row = existing.rows[0];
    const needsHeal =
      !row.name ||
      row.name === movie.slug ||
      isBrokenOrStalePosterUrl(row.thumb_url);
    if (needsHeal && (resolvedName || resolvedThumb)) {
      await query(
        `UPDATE movies
         SET name = COALESCE(NULLIF($2, ''), name),
             original_name = COALESCE($3, original_name),
             thumb_url = COALESCE(NULLIF($4, ''), thumb_url),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id, resolvedName, resolvedOrig, resolvedThumb]
      );
    }
    return row.id;
  }

  const res = await query<{ id: string }>(
    `INSERT INTO movies (
       slug, name, original_name, thumb_url, quality, current_episode, source, metadata_status
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'nguonc', 'pending'
     )
     ON CONFLICT (slug) DO UPDATE SET
       name = CASE
         WHEN EXCLUDED.name IS NOT NULL AND EXCLUDED.name <> '' AND EXCLUDED.name <> movies.slug
         THEN EXCLUDED.name
         ELSE movies.name
       END,
       thumb_url = COALESCE(NULLIF(EXCLUDED.thumb_url, ''), movies.thumb_url)
     RETURNING id;`,
    [
      movie.slug,
      resolvedName || movie.name || movie.slug,
      resolvedOrig,
      resolvedThumb || null,
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

    const items = await Promise.all(
      res.rows.map(async (row) => {
        let name = row.name;
        let originalName = row.original_name ?? undefined;
        let thumbUrl = normalizePosterUrl(row.thumb_url);

        if (!name || name === row.slug || isBrokenOrStalePosterUrl(thumbUrl)) {
          try {
            const detailResp = await getUnifiedMovieDetail(row.slug);
            const detail = detailResp?.movie;
            if (detail) {
              if ((!name || name === row.slug) && detail.name) name = detail.name;
              if (!originalName && detail.original_name) originalName = detail.original_name;
              const freshThumb = detail.thumb_url || detail.poster_url || "";
              if (!isBrokenOrStalePosterUrl(freshThumb)) {
                thumbUrl = normalizePosterUrl(freshThumb);
              }
              query(
                `UPDATE movies
                 SET name = $2,
                     original_name = COALESCE($3, original_name),
                     thumb_url = COALESCE(NULLIF($4, ''), thumb_url),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE slug = $1`,
                [row.slug, name, originalName ?? null, thumbUrl]
              ).catch(() => {});
            }
          } catch {}
        }

        return {
          slug: row.slug,
          name,
          original_name: originalName,
          thumb_url: thumbUrl,
          quality: row.quality ?? undefined,
          current_episode: row.current_episode ?? undefined,
          addedAt: row.created_at.toISOString(),
        };
      })
    );

    return items;
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
      `DELETE FROM favorites
       WHERE user_id = $1
         AND movie_id IN (
           SELECT id FROM movies
           WHERE slug = $2
              OR LOWER(slug) = LOWER($2)
              OR slug = LOWER(TRIM($2))
         )`,
      [realUserId, movieSlug.trim()]
    );
    return (res?.rowCount ?? 0) > 0;
  },

  /**
   * Clear all favorites for a user.
   */
  async clearFavorites(userId: string): Promise<void> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return;

    await query("DELETE FROM favorites WHERE user_id = $1", [realUserId]);
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
