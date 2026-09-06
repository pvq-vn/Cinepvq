// ==============================================================================
// app/api/k20/stream/route.ts
// Server-side K20 Stream Resolver Endpoint (Bypasses Browser CORS on JSON API)
// The returned .m3u8 CDN is played directly by browser HLS.js
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { resolveK20StreamServer } from "@/services/k20Resolver";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId") || undefined;
  const slug = searchParams.get("slug") || undefined;
  const season = searchParams.get("season") ? parseInt(searchParams.get("season")!) : 1;
  const episode = searchParams.get("episode") ? parseInt(searchParams.get("episode")!) : 1;
  const type = (searchParams.get("type") as "movie" | "series") || "series";
  const serverName = searchParams.get("serverName") || undefined;

  if (!imdbId && !slug) {
    return NextResponse.json({ status: "error", message: "Missing imdbId or slug" }, { status: 400 });
  }

  try {
    const stream = await resolveK20StreamServer({
      imdbId,
      season,
      episode,
      type,
      slug,
      serverName,
    });

    return NextResponse.json({
      status: "success",
      stream,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to resolve stream",
      },
      { status: 500 }
    );
  }
}
