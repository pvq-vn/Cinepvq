// ==============================================================================
// lib/repositories/movieRepository.ts
// Movie Database Access Layer with Relations and Cache Upsert
// ==============================================================================

import { query, withTransaction } from "@/lib/db/client";
import {
  type MovieRow,
  type ServerRow,
  type EpisodeRow,
  type GenreRow,
  type CountryRow,
  mapMovieRowToDetail,
} from "@/lib/db/types";
import type { MovieDetail, Movie, EpisodeServer, Category, Country } from "@/types/movie";
import { extractCategoriesFromMovie } from "@/types/movie";

export const movieRepository = {
  /**
   * Find a movie by slug with full relations (genres, countries, servers, and episodes).
   */
  async findMovieBySlug(slug: string): Promise<MovieDetail | null> {
    const movieRes = await query<MovieRow>(
      "SELECT * FROM movies WHERE slug = $1 LIMIT 1",
      [slug]
    );

    if (!movieRes || movieRes.rows.length === 0) {
      return null;
    }

    const movie = movieRes.rows[0];

    // Fetch genres
    const genresRes = await query<GenreRow>(
      `SELECT g.* FROM genres g
       JOIN movie_genres mg ON g.id = mg.genre_id
       WHERE mg.movie_id = $1`,
      [movie.id]
    );
    const categories: Category[] = (genresRes?.rows ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
    }));

    // Fetch countries
    const countriesRes = await query<CountryRow>(
      `SELECT c.* FROM countries c
       JOIN movie_countries mc ON c.id = mc.country_id
       WHERE mc.movie_id = $1`,
      [movie.id]
    );
    const countries: Country[] = (countriesRes?.rows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    }));

    // Fetch servers
    const serversRes = await query<ServerRow>(
      "SELECT * FROM servers WHERE movie_id = $1 ORDER BY created_at ASC",
      [movie.id]
    );
    const serverRows = serversRes?.rows ?? [];

    // Fetch episodes
    const episodesRes = await query<EpisodeRow>(
      "SELECT * FROM episodes WHERE movie_id = $1 ORDER BY created_at ASC",
      [movie.id]
    );
    const episodeRows = episodesRes?.rows ?? [];

    // Group episodes under their respective servers
    const episodeServers: EpisodeServer[] = serverRows.map((srv) => {
      const items = episodeRows
        .filter((ep) => ep.server_id === srv.id)
        .map((ep) => ({
          name: ep.name,
          slug: ep.slug,
          embed: ep.embed_url,
        }));

      return {
        server_name: srv.server_name,
        items,
      };
    });

    return mapMovieRowToDetail(movie, categories, countries, episodeServers);
  },

  /**
   * Upsert a movie fetched from NguonC into PostgreSQL cache in a single transaction.
   */
  async upsertMovieFromNguonC(detail: MovieDetail): Promise<string | null> {
    return withTransaction(async (client) => {
      // 1. Parse Year
      let parsedYear: number | null = null;
      const parsedCat = extractCategoriesFromMovie(detail);
      if (parsedCat.year) {
        const y = parseInt(parsedCat.year, 10);
        if (!isNaN(y)) parsedYear = y;
      }

      // 2. Upsert core Movie record
      const movieUpsertSql = `
        INSERT INTO movies (
          slug, name, original_name, description, thumb_url, poster_url,
          year, total_episodes, current_episode, duration, quality, language,
          director, casts, source, metadata_status, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, 'nguonc', 'ready', CURRENT_TIMESTAMP
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          original_name = EXCLUDED.original_name,
          description = EXCLUDED.description,
          thumb_url = EXCLUDED.thumb_url,
          poster_url = EXCLUDED.poster_url,
          year = COALESCE(EXCLUDED.year, movies.year),
          total_episodes = EXCLUDED.total_episodes,
          current_episode = EXCLUDED.current_episode,
          duration = EXCLUDED.duration,
          quality = EXCLUDED.quality,
          language = EXCLUDED.language,
          director = EXCLUDED.director,
          casts = EXCLUDED.casts,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id;
      `;

      const movieRes = await client.query<{ id: string }>(movieUpsertSql, [
        detail.slug,
        detail.name,
        detail.original_name ?? null,
        detail.description ?? null,
        detail.thumb_url ?? null,
        detail.poster_url ?? null,
        parsedYear,
        detail.total_episodes || 0,
        detail.current_episode ?? null,
        detail.time ?? null,
        detail.quality ?? null,
        detail.language ?? null,
        detail.director ?? null,
        detail.casts ?? null,
      ]);

      const movieId = movieRes.rows[0].id;

      // 3. Upsert Genres & relations
      for (const genreName of parsedCat.genres) {
        const genreSlug = genreName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        if (!genreSlug) continue;

        const genreRes = await client.query<{ id: string }>(
          `INSERT INTO genres (name, slug)
           VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
           RETURNING id;`,
          [genreName, genreSlug]
        );
        const genreId = genreRes.rows[0].id;

        await client.query(
          `INSERT INTO movie_genres (movie_id, genre_id)
           VALUES ($1, $2)
           ON CONFLICT (movie_id, genre_id) DO NOTHING;`,
          [movieId, genreId]
        );
      }

      // 4. Upsert Countries & relations
      for (const countryName of parsedCat.countries) {
        const countrySlug = countryName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        if (!countrySlug) continue;

        const countryRes = await client.query<{ id: string }>(
          `INSERT INTO countries (name, slug)
           VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
           RETURNING id;`,
          [countryName, countrySlug]
        );
        const countryId = countryRes.rows[0].id;

        await client.query(
          `INSERT INTO movie_countries (movie_id, country_id)
           VALUES ($1, $2)
           ON CONFLICT (movie_id, country_id) DO NOTHING;`,
          [movieId, countryId]
        );
      }

      // 5. Upsert Servers and Episodes
      if (Array.isArray(detail.episodes)) {
        for (const srv of detail.episodes) {
          const srvRes = await client.query<{ id: string }>(
            `INSERT INTO servers (movie_id, server_name)
             VALUES ($1, $2)
             ON CONFLICT (movie_id, server_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
             RETURNING id;`,
            [movieId, srv.server_name]
          );
          const serverId = srvRes.rows[0].id;

          if (Array.isArray(srv.items)) {
            for (const ep of srv.items) {
              const epNumMatch = ep.name.match(/\d+/);
              const epNumber = epNumMatch ? parseInt(epNumMatch[0], 10) : null;

              await client.query(
                `INSERT INTO episodes (movie_id, server_id, name, slug, embed_url, episode_number)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (server_id, slug) DO UPDATE SET
                   name = EXCLUDED.name,
                   embed_url = EXCLUDED.embed_url,
                   episode_number = EXCLUDED.episode_number,
                   updated_at = CURRENT_TIMESTAMP;`,
                [movieId, serverId, ep.name, ep.slug, ep.embed, epNumber]
              );
            }
          }
        }
      }

      return movieId;
    });
  },

  /**
   * List cached movies from PostgreSQL.
   */
  async listCachedMovies(limit = 24, offset = 0): Promise<Movie[]> {
    const res = await query<MovieRow>(
      `SELECT * FROM movies
       ORDER BY updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    if (!res) return [];

    return res.rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      original_name: row.original_name ?? "",
      thumb_url: row.thumb_url ?? "",
      poster_url: row.poster_url ?? "",
      created: row.created_at.toISOString(),
      modified: row.updated_at.toISOString(),
      description: row.description ?? "",
      total_episodes: row.total_episodes,
      current_episode: row.current_episode ?? "",
      time: row.duration ?? "",
      quality: row.quality ?? "",
      language: row.language ?? "",
      director: row.director ?? "",
      casts: row.casts ?? "",
      year: row.year ?? undefined,
    }));
  },
};
