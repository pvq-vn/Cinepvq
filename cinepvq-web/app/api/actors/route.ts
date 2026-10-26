import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { normalizeEpisodeLabel } from "@/lib/format";
import type { Movie } from "@/types/movie";

const KKPHIM_CDN = "https://phimimg.com";

function resolveImage(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${KKPHIM_CDN}/${url.replace(/^\/+/, "")}`;
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

interface KKPhimSearchItem {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
  episode_current?: string;
  time?: string;
  actor?: string[];
  director?: string[];
  category?: { id?: string; name?: string; slug?: string }[];
  country?: { id?: string; name?: string; slug?: string }[];
}

function mapKKItemToMovie(item: KKPhimSearchItem): Movie {
  const thumb = resolveImage(item.poster_url || item.thumb_url);
  const poster = resolveImage(item.thumb_url || item.poster_url);
  return {
    id: item._id || item.slug || "",
    name: item.name || "",
    slug: item.slug || "",
    original_name: item.origin_name || "",
    thumb_url: thumb,
    poster_url: poster,
    created: "",
    modified: "",
    description: "",
    total_episodes: 0,
    current_episode: item.episode_current
      ? normalizeEpisodeLabel(item.episode_current)
      : "",
    time: item.time || "",
    quality: item.quality || "FHD",
    language: item.lang || "Vietsub",
    director: Array.isArray(item.director) ? item.director.join(", ") : "",
    casts: Array.isArray(item.actor) ? item.actor.join(", ") : "",
    year: item.year,
    category: {},
  };
}

export interface ActorSearchResult {
  name: string;
  role: "Diễn viên" | "Đạo diễn";
  movieCount: number;
  sampleMovies: string[];
  thumbUrl?: string;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const rawName = (sp.get("name") || sp.get("q") || "").trim();
    const mode = sp.get("name") ? "detail" : "search";

    if (!rawName || rawName.length < 2) {
      return NextResponse.json({
        status: true,
        actors: [],
        movies: [],
      });
    }

    const normQuery = normalizeText(rawName);
    const moviesBySlug = new Map<string, Movie>();
    const actorsMap = new Map<string, ActorSearchResult>();

    const recordPerson = (
      personName: string,
      role: "Diễn viên" | "Đạo diễn",
      movieTitle?: string,
      thumbUrl?: string
    ) => {
      const cleaned = personName.replace(/\s+/g, " ").trim();
      if (
        !cleaned ||
        cleaned.length < 2 ||
        /^(đang cập nhật|n\/a|unknown|-)$/i.test(cleaned)
      ) {
        return;
      }
      const normPerson = normalizeText(cleaned);
      if (!normPerson.includes(normQuery) && !normQuery.includes(normPerson)) {
        return;
      }
      const key = cleaned.toLowerCase();
      const existing = actorsMap.get(key);
      if (existing) {
        existing.movieCount += 1;
        if (movieTitle && existing.sampleMovies.length < 3 && !existing.sampleMovies.includes(movieTitle)) {
          existing.sampleMovies.push(movieTitle);
        }
        if (!existing.thumbUrl && thumbUrl) {
          existing.thumbUrl = thumbUrl;
        }
      } else {
        actorsMap.set(key, {
          name: cleaned,
          role,
          movieCount: 1,
          sampleMovies: movieTitle ? [movieTitle] : [],
          thumbUrl,
        });
      }
    };

    // 1. Query PostgreSQL `public.movies` for matching casts or director
    try {
      const dbRes = await query<{
        slug: string;
        name: string;
        original_name: string | null;
        thumb_url: string | null;
        poster_url: string | null;
        quality: string | null;
        language: string | null;
        current_episode: string | null;
        release_year: number | null;
        casts: string | null;
        director: string | null;
      }>(
        `SELECT slug, name, original_name, thumb_url, poster_url, quality, language,
                current_episode, release_year, casts, director
         FROM public.movies
         WHERE (casts ILIKE $1 OR director ILIKE $1 OR name ILIKE $1 OR original_name ILIKE $1)
           AND COALESCE(is_hidden, false) = false
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 40`,
        [`%${rawName}%`]
      );

      for (const row of dbRes?.rows ?? []) {
        const castsArr = (row.casts || "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const dirArr = (row.director || "")
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean);

        let matchedPerson = false;
        for (const c of castsArr) {
          if (normalizeText(c).includes(normQuery)) {
            matchedPerson = true;
            recordPerson(c, "Diễn viên", row.name, row.thumb_url || row.poster_url || undefined);
          }
        }
        for (const d of dirArr) {
          if (normalizeText(d).includes(normQuery)) {
            matchedPerson = true;
            recordPerson(d, "Đạo diễn", row.name, row.thumb_url || row.poster_url || undefined);
          }
        }

        if (matchedPerson && row.slug && !moviesBySlug.has(row.slug)) {
          moviesBySlug.set(row.slug, {
            id: row.slug,
            slug: row.slug,
            name: row.name,
            original_name: row.original_name || "",
            thumb_url: row.thumb_url || row.poster_url || "",
            poster_url: row.poster_url || row.thumb_url || "",
            created: "",
            modified: "",
            description: "",
            total_episodes: 0,
            current_episode: row.current_episode
              ? normalizeEpisodeLabel(row.current_episode)
              : "",
            time: "",
            quality: row.quality || "FHD",
            language: row.language || "Vietsub",
            director: row.director || "",
            casts: row.casts || "",
            year: row.release_year || undefined,
            category: {},
          });
        }
      }
    } catch (dbErr) {
      console.warn("[API /api/actors] DB search warning:", dbErr);
    }

    // 2. Query KKPhim Search API & VSMOV Search API in parallel
    const [kkSearchRes, vsmovSearchRes] = await Promise.allSettled([
      fetch(
        `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(rawName)}&limit=32`,
        { next: { revalidate: 300 } }
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://vsmov.com/api/films/search?keyword=${encodeURIComponent(rawName)}&page=1`,
        { next: { revalidate: 300 } }
      ).then((r) => (r.ok ? r.json() : null)),
    ]);

    const kkItems: KKPhimSearchItem[] =
      kkSearchRes.status === "fulfilled"
        ? kkSearchRes.value?.data?.items || []
        : [];

    for (const item of kkItems) {
      const m = mapKKItemToMovie(item);
      if (m.slug && !moviesBySlug.has(m.slug)) {
        moviesBySlug.set(m.slug, m);
      }

      if (Array.isArray(item.actor)) {
        for (const a of item.actor) {
          recordPerson(a, "Diễn viên", m.name, m.thumb_url);
        }
      }
      if (Array.isArray(item.director)) {
        for (const d of item.director) {
          recordPerson(d, "Đạo diễn", m.name, m.thumb_url);
        }
      }
    }

    const vsmovItems =
      vsmovSearchRes.status === "fulfilled"
        ? vsmovSearchRes.value?.items || []
        : [];

    for (const item of vsmovItems) {
      if (!item?.slug) continue;
      if (!moviesBySlug.has(item.slug)) {
        moviesBySlug.set(item.slug, {
          id: item.id || item.slug,
          slug: item.slug,
          name: item.name || "",
          original_name: item.origin_name || item.original_name || "",
          thumb_url: item.thumb_url || item.poster_url || "",
          poster_url: item.poster_url || item.thumb_url || "",
          created: "",
          modified: "",
          description: item.description || "",
          total_episodes: item.total_episodes || 0,
          current_episode: item.current_episode
            ? normalizeEpisodeLabel(item.current_episode)
            : "",
          time: item.time || "",
          quality: item.quality || "FHD",
          language: item.language || "Vietsub",
          director: item.director || "",
          casts: item.casts || "",
          year: item.year,
          category: {},
        });
      }

      if (item.casts) {
        for (const a of String(item.casts).split(",")) {
          recordPerson(a, "Diễn viên", item.name, item.thumb_url);
        }
      }
      if (item.director) {
        for (const d of String(item.director).split(",")) {
          recordPerson(d, "Đạo diễn", item.name, item.thumb_url);
        }
      }
    }

    // If mode === "detail" and actorsMap doesn't yet have the exact requested name, add it
    if (mode === "detail" && moviesBySlug.size > 0 && actorsMap.size === 0) {
      const firstMovie = Array.from(moviesBySlug.values())[0];
      actorsMap.set(rawName.toLowerCase(), {
        name: rawName,
        role: "Diễn viên",
        movieCount: moviesBySlug.size,
        sampleMovies: Array.from(moviesBySlug.values())
          .slice(0, 3)
          .map((m) => m.name),
        thumbUrl: firstMovie?.thumb_url,
      });
    }

    const actors = Array.from(actorsMap.values()).sort(
      (a, b) => b.movieCount - a.movieCount
    );
    const movies = Array.from(moviesBySlug.values());

    return NextResponse.json(
      {
        status: true,
        actor: actors[0] || {
          name: rawName,
          role: "Diễn viên",
          movieCount: movies.length,
          sampleMovies: movies.slice(0, 3).map((m) => m.name),
        },
        actors: actors.slice(0, 12),
        movies,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[API /api/actors] Error:", err);
    return NextResponse.json(
      { status: false, actors: [], movies: [], error: "Lỗi tra cứu diễn viên" },
      { status: 500 }
    );
  }
}
