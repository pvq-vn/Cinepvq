import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { queryPg } from "@/lib/db";
import { enrichMovieData } from "@/services/movieEnricher";
import { normalizeEpisodeLabel } from "@/lib/format";
import { getMovieDetail } from "@/services/api";
import { movieRepository } from "@/lib/repositories/movieRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    let whereSql = "";
    const params: unknown[] = [];

    if (q) {
      params.push(`%${q}%`);
      whereSql = `WHERE m.name ILIKE $1 OR m.original_name ILIKE $1 OR m.slug ILIKE $1 OR m.casts ILIKE $1`;
    }

    const totalRes = await queryPg<{ count: string }>(
      `SELECT COUNT(*) AS count FROM public.movies m ${whereSql}`,
      params
    );
    const totalItems = Number(totalRes.rows[0]?.count || 0);

    const listRes = await queryPg<{
      id: string;
      slug: string;
      name: string;
      original_name: string | null;
      thumb_url: string | null;
      poster_url: string | null;
      year: number | null;
      quality: string | null;
      current_episode: string | null;
      casts: string | null;
      director: string | null;
      imdb_id: string | null;
      douban_id: string | null;
      is_featured: boolean;
      is_hidden: boolean;
      pinned_rank: number | null;
      internal_views: number;
      updated_at: string;
      episode_count: string;
    }>(
      `SELECT
        m.id,
        m.slug,
        m.name,
        m.original_name,
        m.thumb_url,
        m.poster_url,
        m.year,
        m.quality,
        m.current_episode,
        m.casts,
        m.director,
        m.imdb_id,
        m.douban_id,
        COALESCE(m.is_featured, FALSE) AS is_featured,
        COALESCE(m.is_hidden, FALSE) AS is_hidden,
        m.pinned_rank,
        COALESCE(m.internal_views, 0) AS internal_views,
        m.updated_at,
        (SELECT COUNT(*) FROM public.episodes e WHERE e.movie_id = m.id) AS episode_count
      FROM public.movies m
      ${whereSql}
      ORDER BY COALESCE(m.is_featured, FALSE) DESC, m.updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      status: true,
      items: listRes.rows.map((r) => ({
        ...r,
        current_episode: normalizeEpisodeLabel(r.current_episode),
        episode_count: Number(r.episode_count || 0),
      })),
      paginate: {
        current_page: page,
        total_page: Math.max(1, Math.ceil(totalItems / limit)),
        total_items: totalItems,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/movies] Error:", err);
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to fetch movies",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const { action, slug } = body;

    if (action === "enrich" && slug) {
      // Ensure movie is in DB first by fetching from KKPhim if missing
      const existing = await queryPg<{ id: string }>(
        `SELECT id FROM public.movies WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      if (existing.rows.length === 0) {
        try {
          const detailRes = await getMovieDetail(slug);
          if (detailRes.data?.movie) {
            await movieRepository.upsertMovieFromNguonC(detailRes.data.movie);
          }
        } catch {
          // Proceed with enricher
        }
      }
      const enriched = await enrichMovieData({ slug }, true);
      return NextResponse.json({
        status: true,
        message: `Đã tự động cào và cập nhật thông tin cho phim "${slug}"`,
        enriched,
      });
    }

    if (action === "fix_episodes") {
      // Normalize all episode names in public.episodes and watch_history
      const epsRes = await queryPg<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM public.episodes`
      );
      let updatedCount = 0;
      for (const ep of epsRes.rows) {
        const clean = normalizeEpisodeLabel(ep.name, ep.slug);
        if (clean && clean !== ep.name) {
          await queryPg(`UPDATE public.episodes SET name = $1 WHERE id = $2`, [
            clean,
            ep.id,
          ]);
          updatedCount++;
        }
      }
      return NextResponse.json({
        status: true,
        message: `Đã chuẩn hóa ${updatedCount} tên tập phim trong cơ sở dữ liệu.`,
        updatedCount,
      });
    }

    if (action === "update" && slug) {
      const {
        name,
        original_name,
        casts,
        director,
        imdb_id,
        douban_id,
        is_featured,
        is_hidden,
        pinned_rank,
        internal_views,
      } = body;

      await queryPg(
        `UPDATE public.movies
         SET
           name = COALESCE($2, name),
           original_name = COALESCE($3, original_name),
           casts = COALESCE($4, casts),
           director = COALESCE($5, director),
           imdb_id = COALESCE($6, imdb_id),
           douban_id = COALESCE($7, douban_id),
           is_featured = COALESCE($8, is_featured),
           is_hidden = COALESCE($9, is_hidden),
           pinned_rank = $10,
           internal_views = COALESCE($11, internal_views),
           updated_at = NOW()
         WHERE slug = $1`,
        [
          slug,
          name ?? null,
          original_name ?? null,
          casts ?? null,
          director ?? null,
          imdb_id ?? null,
          douban_id ?? null,
          typeof is_featured === "boolean" ? is_featured : null,
          typeof is_hidden === "boolean" ? is_hidden : null,
          pinned_rank !== undefined && pinned_rank !== "" ? Number(pinned_rank) : null,
          internal_views !== undefined ? Number(internal_views) : null,
        ]
      );

      return NextResponse.json({
        status: true,
        message: `Đã cập nhật thông tin phim "${slug}" thành công.`,
      });
    }

    if (action === "delete" && slug) {
      await queryPg(`DELETE FROM public.movies WHERE slug = $1`, [slug]);
      return NextResponse.json({
        status: true,
        message: `Đã xóa phim "${slug}" khỏi cơ sở dữ liệu nội bộ.`,
      });
    }

    return NextResponse.json(
      { status: false, message: "Hành động không hợp lệ" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[POST /api/admin/movies] Error:", err);
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to process movie action",
      },
      { status: 500 }
    );
  }
}
