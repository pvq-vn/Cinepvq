import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { queryPg } from "@/lib/db";

export const dynamic = "force-dynamic";

async function probeEndpoint(
  name: string,
  url: string,
  headers?: Record<string, string>
): Promise<{ name: string; status: "online" | "degraded" | "offline"; latencyMs: number; detail: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 CinePVQ-Admin-HealthCheck/1.0",
        ...headers,
      },
      cache: "no-store",
    });
    const latencyMs = Date.now() - start;
    return {
      name,
      status: res.ok ? "online" : "degraded",
      latencyMs,
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name,
      status: "offline",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "Timeout",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const dbStart = Date.now();
    const countsRes = await queryPg<{
      users_count: string;
      movies_count: string;
      episodes_count: string;
      history_count: string;
      favorites_count: string;
      watchlist_count: string;
      comments_count: string;
      notifications_count: string;
      rankings_count: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM public.users) AS users_count,
        (SELECT COUNT(*) FROM public.movies) AS movies_count,
        (SELECT COUNT(*) FROM public.episodes) AS episodes_count,
        (SELECT COUNT(*) FROM public.watch_history) AS history_count,
        (SELECT COUNT(*) FROM public.favorites) AS favorites_count,
        (SELECT COUNT(*) FROM public.watchlist) AS watchlist_count,
        (SELECT COUNT(*) FROM public.comments) AS comments_count,
        (SELECT COUNT(*) FROM public.notifications) AS notifications_count,
        (SELECT COUNT(*) FROM public.platform_rankings_cache) AS rankings_count
    `);
    const dbLatencyMs = Date.now() - dbStart;
    const row = countsRes.rows[0];

    // Recent watch activity
    const recentActivityRes = await queryPg<{
      id: string;
      movie_slug: string;
      episode_slug: string;
      episode_name: string | null;
      watched_at: string;
      email: string;
      username: string | null;
      movie_name: string | null;
    }>(`
      SELECT
        wh.id,
        wh.movie_slug,
        wh.episode_slug,
        wh.episode_name,
        wh.watched_at,
        u.email,
        u.username,
        m.name AS movie_name
      FROM public.watch_history wh
      JOIN public.users u ON u.id = wh.user_id
      LEFT JOIN public.movies m ON m.slug = wh.movie_slug
      ORDER BY wh.watched_at DESC
      LIMIT 8
    `);

    // Probe external services in parallel
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const [supabaseHealth, kkphimHealth, vsmovHealth, doubanHealth] =
      await Promise.all([
        probeEndpoint(
          "Supabase Auth & API",
          `${supabaseUrl}/auth/v1/health`,
          { apikey: supabaseAnon }
        ),
        probeEndpoint(
          "KKPhim Upstream API",
          "https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1"
        ),
        probeEndpoint(
          "VSMOV Backup Stream API",
          "https://vsmov.com/api/danh-sach/phim-moi-cap-nhat?page=1"
        ),
        probeEndpoint(
          "Douban BXH Crawler",
          "https://movie.douban.com/j/search_subjects?type=tv&tag=%E7%83%AD%E9%97%A8&page_limit=2&page_start=0"
        ),
      ]);

    return NextResponse.json({
      status: true,
      adminEmail: auth.user.email,
      counts: {
        users: Number(row?.users_count || 0),
        movies: Number(row?.movies_count || 0),
        episodes: Number(row?.episodes_count || 0),
        watchHistory: Number(row?.history_count || 0),
        favorites: Number(row?.favorites_count || 0),
        watchlist: Number(row?.watchlist_count || 0),
        comments: Number(row?.comments_count || 0),
        notifications: Number(row?.notifications_count || 0),
        cachedPlatforms: Number(row?.rankings_count || 0),
      },
      health: [
        {
          name: "PostgreSQL Database (Supabase Pooler)",
          status: "online",
          latencyMs: dbLatencyMs,
          detail: "Connected (SSL Pool)",
        },
        supabaseHealth,
        kkphimHealth,
        vsmovHealth,
        doubanHealth,
      ],
      recentActivity: recentActivityRes.rows,
    });
  } catch (err) {
    console.error("[GET /api/admin/stats] Error:", err);
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to load admin stats",
      },
      { status: 500 }
    );
  }
}
