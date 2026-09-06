// ==============================================================================
// app/api/video-sources/resolve/route.ts
// Server-side Multi-Source Video Resolver API Route
// Resolves available streams across K20, VSMOV, KKPhim1, and NguonC
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { resolveAllAvailableSourcesServer } from "@/services/videoSources";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || undefined;
  const imdbId = searchParams.get("imdbId") || undefined;
  const tmdbId = searchParams.get("tmdbId") || undefined;
  const title = searchParams.get("title") || undefined;
  const season = searchParams.get("season")
    ? parseInt(searchParams.get("season")!)
    : 1;
  const episode = searchParams.get("episode")
    ? parseInt(searchParams.get("episode")!)
    : 1;
  const type = (searchParams.get("type") as "movie" | "series") || "series";
  const nguoncEmbedUrl = searchParams.get("nguoncEmbedUrl") || undefined;
  const serverName = searchParams.get("serverName") || undefined;
  const episodeSlug = searchParams.get("episodeSlug") || undefined;

  try {
    const sources = await resolveAllAvailableSourcesServer({
      slug,
      imdbId,
      tmdbId,
      title,
      season,
      episode,
      type,
      nguoncEmbedUrl,
      serverName,
      episodeSlug,
    });

    return NextResponse.json({
      status: "success",
      sources,
    });
  } catch (err) {
    console.error("[API Video Sources] Error resolving sources:", err);
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to resolve sources",
        sources: nguoncEmbedUrl
          ? [
              {
                sourceId: "nguonc",
                name: "Server Dự Phòng (StreamC)",
                displayName: "Server Dự Phòng",
                type: "iframe",
                url: nguoncEmbedUrl,
                priority: 4,
                isAvailable: true,
              },
            ]
          : [],
      },
      { status: 500 }
    );
  }
}
