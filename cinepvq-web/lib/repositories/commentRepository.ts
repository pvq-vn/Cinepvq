// ==============================================================================
// lib/repositories/commentRepository.ts
// Movie Comments and Reviews Repository Layer
// ==============================================================================

import { query } from "@/lib/db/client";
import { userRepository } from "@/lib/repositories/userRepository";
import { ensureMovieStub } from "@/lib/repositories/favoriteRepository";

export interface CommentWithAuthor {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  createdAt: string;
  likes: number;
}

interface CommentJoinedRow {
  id: string;
  content: string;
  created_at: Date;
  username: string;
  avatar_url: string | null;
}

export const commentRepository = {
  /**
   * Fetch comments for a movie ordered chronologically newest first.
   */
  async getCommentsByMovieSlug(
    movieSlug: string,
    limit = 50
  ): Promise<CommentWithAuthor[]> {
    const res = await query<CommentJoinedRow>(
      `SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
       FROM comments c
       JOIN movies m ON c.movie_id = m.id
       JOIN users u ON c.user_id = u.id
       WHERE m.slug = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [movieSlug, limit]
    );

    if (!res) return [];

    return res.rows.map((r) => ({
      id: r.id,
      author: r.username,
      avatar: r.avatar_url ?? undefined,
      content: r.content,
      createdAt: r.created_at.toISOString(),
      likes: 0,
    }));
  },

  /**
   * Create a new comment for a movie.
   */
  async createComment(
    userId: string,
    movieSlug: string,
    content: string
  ): Promise<CommentWithAuthor | null> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return null;

    const movieId = await ensureMovieStub({ slug: movieSlug });
    if (!movieId) return null;

    const res = await query<CommentJoinedRow>(
      `WITH inserted AS (
         INSERT INTO comments (user_id, movie_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, content, created_at, user_id
       )
       SELECT i.id, i.content, i.created_at, u.username, u.avatar_url
       FROM inserted i
       JOIN users u ON i.user_id = u.id;`,
      [realUserId, movieId, content.trim()]
    );

    if (!res || res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      author: r.username,
      avatar: r.avatar_url ?? undefined,
      content: r.content,
      createdAt: r.created_at.toISOString(),
      likes: 0,
    };
  },
};
