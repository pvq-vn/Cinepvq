import { NextRequest, NextResponse } from "next/server";
import {
  crawlAllPlatformRankings,
  type PlatformId,
} from "@/services/trendingCrawler";

export const dynamic = "force-dynamic";

/**
 * GET /api/trending?platform=all|netflix|douban|vieon|fptplay|iqiyi&refresh=true
 * Backend BXH Crawler endpoint shared by Web and Android clients.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platformParam = (searchParams.get("platform") || "all").toLowerCase();
    const forceRefresh = searchParams.get("refresh") === "true";

    const payload = await crawlAllPlatformRankings(forceRefresh);

    if (platformParam !== "all") {
      const filtered = payload.platforms.filter(
        (p) => p.id === (platformParam as PlatformId)
      );
      return NextResponse.json({
        status: true,
        updatedAt: payload.updatedAt,
        platforms: filtered,
      });
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[GET /api/trending] Error:", err);
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to crawl trending rankings",
        platforms: [],
      },
      { status: 500 }
    );
  }
}
