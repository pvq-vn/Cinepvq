import { NextRequest, NextResponse } from "next/server";
import { enrichMovieData } from "@/services/movieEnricher";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json(
        { status: false, error: "Thiếu movie slug" },
        { status: 400 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const title = sp.get("title") || undefined;
    const originalTitle = sp.get("originalTitle") || undefined;
    const year = sp.get("year") || undefined;
    const type = (sp.get("type") === "movie" ? "movie" : "series") as "movie" | "series";
    const imdbId = sp.get("imdbId") || undefined;
    const tmdbId = sp.get("tmdbId") || undefined;
    const thumbUrl = sp.get("thumbUrl") || undefined;
    const posterUrl = sp.get("posterUrl") || undefined;
    const force = sp.get("force") === "true";

    const data = await enrichMovieData(
      {
        slug,
        title,
        originalTitle,
        year,
        type,
        imdbId,
        tmdbId,
        thumbUrl,
        posterUrl,
      },
      force
    );

    return NextResponse.json(
      {
        status: true,
        data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[API /api/movies/[slug]/enrich] Error:", err);
    return NextResponse.json(
      { status: false, error: "Không thể làm giàu dữ liệu phim" },
      { status: 500 }
    );
  }
}
