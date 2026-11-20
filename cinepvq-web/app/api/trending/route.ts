import { NextRequest, NextResponse } from "next/server";
import {
  crawlAllPlatformRankings,
  normalizeDoubanCategory,
  normalizeNetflixCountry,
  normalizeNetflixType,
  type PlatformId,
} from "@/services/trendingCrawler";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS = new Set<string>([
  "all",
  "netflix",
  "douban",
  "yunhe",
  "kuyun",
  "vieon",
  "fptplay",
  "iqiyi",
]);

/**
 * GET /api/trending?platform=all|netflix|douban|yunhe|kuyun|vieon|fptplay|iqiyi
 *                  &country=vn|kr|us|global|jp|th|tw|gb
 *                  &netflixType=tv|films
 *                  &doubanCategory=all|tv_cn|tv_global|movie|top250
 *                  &refresh=true
 * Backend BXH Crawler endpoint shared by Web and Android clients.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPlatform = (searchParams.get("platform") || "all").toLowerCase();
    const platform = (
      VALID_PLATFORMS.has(rawPlatform) ? rawPlatform : "all"
    ) as PlatformId | "all";
    const forceRefresh = searchParams.get("refresh") === "true";
    const netflixCountry = normalizeNetflixCountry(searchParams.get("country"));
    const netflixType = normalizeNetflixType(searchParams.get("netflixType"));
    const doubanCategory = normalizeDoubanCategory(
      searchParams.get("doubanCategory")
    );
    const doubanOffset = Math.max(
      0,
      parseInt(searchParams.get("doubanOffset") || "0", 10) || 0
    );

    const payload = await crawlAllPlatformRankings({
      forceRefresh,
      platform,
      netflixCountry,
      netflixType,
      doubanCategory,
      doubanOffset,
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[GET /api/trending] Error:", err);
    return NextResponse.json(
      {
        status: false,
        message:
          err instanceof Error
            ? err.message
            : "Failed to crawl trending rankings",
        platforms: [],
      },
      { status: 500 }
    );
  }
}
