import { query } from "@/lib/db/client";
import { userRepository } from "@/lib/repositories/userRepository";
import { ensureMovieStub } from "@/lib/repositories/favoriteRepository";
import type { WatchHistoryItem } from "@/types/movie";

interface HistoryJoinedRow {
  slug: string;
  name: string;
  original_name: string | null;
  thumb_url: string | null;
  episode_slug: string | null;
  episode_name: string | null;
  last_position_seconds: number;
  duration_seconds: number | null;
  updated_at: Date;
}

export const historyRepository = {
  /**
   * Get watch history items for a user ordered by most recently updated.
   */
  async getHistoryByUserId(userId: string, limit = 50): Promise<WatchHistoryItem[]> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return [];

    const res = await query<HistoryJoinedRow>(
      `SELECT m.slug, m.name, m.original_name, m.thumb_url,
              e.slug as episode_slug, e.name as episode_name,
              wh.last_position_seconds, wh.duration_seconds, wh.updated_at
       FROM watch_history wh
       JOIN movies m ON wh.movie_id = m.id
       LEFT JOIN episodes e ON wh.episode_id = e.id
       WHERE wh.user_id = $1
       ORDER BY wh.updated_at DESC, wh.id DESC
       LIMIT $2`,
      [realUserId, limit]
    );

    if (!res) return [];

    return res.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      original_name: row.original_name ?? undefined,
      thumb_url: row.thumb_url ?? "",
      episodeSlug: row.episode_slug ?? undefined,
      episodeName: row.episode_name ?? undefined,
      currentTime: row.last_position_seconds ?? 0,
      duration: row.duration_seconds ?? 0,
      updatedAt: row.updated_at.toISOString(),
    }));
  },

  /**
   * Upsert a watch history record for a user and movie/episode.
   * Preserves validated client timestamp when available.
   */
  async upsertHistory(
    userId: string,
    movieInput:
      | string
      | {
          slug: string;
          name?: string;
          original_name?: string;
          thumb_url?: string;
        },
    episode?: { slug: string; name?: string } | string,
    lastPositionSeconds = 0,
    durationSeconds = 0,
    clientUpdatedAt?: string | Date
  ): Promise<boolean> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return false;

    const movieObj =
      typeof movieInput === "string" ? { slug: movieInput } : movieInput;
    const movieId = await ensureMovieStub(movieObj);
    if (!movieId) return false;

    const epSlug = typeof episode === "string" ? episode : episode?.slug;
    const epName = typeof episode === "string" ? episode : episode?.name;

    let episodeId: string | null = null;
    if (epSlug) {
      const epRes = await query<{ id: string }>(
        "SELECT id FROM episodes WHERE movie_id = $1 AND slug = $2 LIMIT 1",
        [movieId, epSlug]
      );
      if (epRes?.rows[0]?.id) {
        episodeId = epRes.rows[0].id;
      } else {
        // Create server stub and episode stub if not exists
        try {
          const srvRes = await query<{ id: string }>(
            `INSERT INTO servers (movie_id, server_name)
             VALUES ($1, 'Default')
             ON CONFLICT (movie_id, server_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [movieId]
          );
          const serverId = srvRes?.rows[0]?.id;
          if (serverId) {
            const newEp = await query<{ id: string }>(
              `INSERT INTO episodes (movie_id, server_id, name, slug, embed_url)
               VALUES ($1, $2, $3, $4, '')
               ON CONFLICT (server_id, slug) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [movieId, serverId, epName || epSlug, epSlug]
            );
            episodeId = newEp?.rows[0]?.id ?? null;
          }
        } catch {
          // Non-critical if episode creation fails
        }
      }
    }

    // Validate client timestamp safely: ensure valid Date, not NaN, not far future
    let validatedDate: Date | null = null;
    if (clientUpdatedAt) {
      const parsed = new Date(clientUpdatedAt);
      const time = parsed.getTime();
      const now = Date.now();
      if (!isNaN(time) && time > 0 && time <= now + 86400000) {
        validatedDate = parsed;
      }
    }

    await query(
      `INSERT INTO watch_history (user_id, movie_id, episode_id, last_position_seconds, duration_seconds, updated_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP))
       ON CONFLICT (user_id, movie_id) DO UPDATE SET
         episode_id = CASE
           WHEN EXCLUDED.updated_at >= watch_history.updated_at
           THEN COALESCE(EXCLUDED.episode_id, watch_history.episode_id)
           ELSE watch_history.episode_id
         END,
         last_position_seconds = CASE
           WHEN EXCLUDED.updated_at >= watch_history.updated_at
           THEN EXCLUDED.last_position_seconds
           ELSE watch_history.last_position_seconds
         END,
         duration_seconds = CASE
           WHEN EXCLUDED.updated_at >= watch_history.updated_at
           THEN COALESCE(EXCLUDED.duration_seconds, watch_history.duration_seconds)
           ELSE watch_history.duration_seconds
         END,
         updated_at = GREATEST(watch_history.updated_at, EXCLUDED.updated_at)`,
      [realUserId, movieId, episodeId, lastPositionSeconds, durationSeconds, validatedDate]
    );

    return true;
  },

  /**
   * Remove a single movie from watch history.
   */
  async removeHistory(userId: string, movieSlug: string): Promise<boolean> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return false;

    const res = await query(
      `DELETE FROM watch_history wh
       USING movies m
       WHERE wh.movie_id = m.id AND wh.user_id = $1 AND m.slug = $2`,
      [realUserId, movieSlug]
    );
    return (res?.rowCount ?? 0) > 0;
  },

  /**
   * Clear all watch history for a user.
   */
  async clearHistory(userId: string): Promise<void> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return;

    await query("DELETE FROM watch_history WHERE user_id = $1", [realUserId]);
  },

  /**
   * Bulk sync client history into Supabase PostgreSQL.
   */
  async bulkSyncHistory(
    userId: string,
    history: WatchHistoryItem[]
  ): Promise<WatchHistoryItem[]> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return [];

    for (const item of history) {
      try {
        await this.upsertHistory(
          realUserId,
          {
            slug: item.slug,
            name: item.name,
            original_name: item.original_name,
            thumb_url: item.thumb_url,
          },
          item.episodeSlug
            ? { slug: item.episodeSlug, name: item.episodeName }
            : undefined,
          Math.floor(item.currentTime || 0),
          Math.floor(item.duration || 0),
          item.updatedAt
        );
      } catch (err) {
        console.warn("[History bulkSync item error]", err);
      }
    }

    return this.getHistoryByUserId(realUserId);
  },
};
