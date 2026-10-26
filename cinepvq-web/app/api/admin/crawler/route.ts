import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { crawlAllPlatformRankings } from "@/services/trendingCrawler";
import { getLatestMovies, getMovieDetail } from "@/services/api";
import { movieRepository } from "@/lib/repositories/movieRepository";
import { enrichMovieData } from "@/services/movieEnricher";
import { queryPg } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const res = await queryPg<{
      platform_id: string;
      platform_name: string;
      category_label: string;
      items: unknown[];
      updated_at: string;
    }>(
      `SELECT platform_id, platform_name, category_label, items, updated_at
       FROM public.platform_rankings_cache
       ORDER BY platform_id ASC`
    );

    return NextResponse.json({
      status: true,
      caches: res.rows.map((r) => ({
        platformId: r.platform_id,
        platformName: r.platform_name,
        categoryLabel: r.category_label,
        itemCount: Array.isArray(r.items) ? r.items.length : 0,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to load crawler status",
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
    const { action } = body;

    if (action === "crawl_rankings") {
      const payload = await crawlAllPlatformRankings(true);
      return NextResponse.json({
        status: true,
        message: `Đã cào mới BXH từ ${payload.platforms.length} nền tảng (Netflix, Douban, VieON, FPT Play, iQIYI/WeTV)!`,
        updatedAt: payload.updatedAt,
        platformsCount: payload.platforms.length,
      });
    }

    if (action === "sync_latest_movies") {
      const limitCount = Math.min(12, Math.max(1, Number(body.limit || 6)));
      const latestRes = await getLatestMovies(1);
      const items = (latestRes.data?.items || []).slice(0, limitCount);
      const syncedSlugs: string[] = [];

      for (const item of items) {
        try {
          const detailRes = await getMovieDetail(item.slug);
          if (detailRes.data?.movie) {
            await movieRepository.upsertMovieFromNguonC(detailRes.data.movie);
            await enrichMovieData({ slug: item.slug, title: item.name, originalTitle: item.original_name }, false);
            syncedSlugs.push(item.slug);
          }
        } catch {
          // Continue with next movie
        }
      }

      return NextResponse.json({
        status: true,
        message: `Đã đồng bộ và làm giàu dữ liệu (Diễn viên, IMDb, Douban, Lượt xem) cho ${syncedSlugs.length} phim mới nhất!`,
        syncedSlugs,
      });
    }

    return NextResponse.json(
      { status: false, message: "Hành động crawler không hợp lệ" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[POST /api/admin/crawler] Error:", err);
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Crawler execution error",
      },
      { status: 500 }
    );
  }
}
