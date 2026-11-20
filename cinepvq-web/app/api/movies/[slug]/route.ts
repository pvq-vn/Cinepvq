// ==============================================================================
// app/api/movies/[slug]/route.ts
// Unified Multi-Dataset Movie Detail Endpoint
// Resolves across KKPhim1 + VSMOV + NguonC + ChoPhim + PhimHDCSS + PostgreSQL
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { movieRepository } from "@/lib/repositories/movieRepository";
import { getUnifiedMovieDetail } from "@/services/unifiedCatalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.trim().length === 0) {
    return NextResponse.json(
      { status: "error", message: "Movie slug is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Resolve live from Unified 6-Dataset Catalog (KKPhim -> VSMOV/NguonC/ChoPhim/PhimHDCSS)
    const unified = await getUnifiedMovieDetail(slug);
    if (unified && unified.movie) {
      // Asynchronously persist to PostgreSQL cache for enrichment & offline resilience
      if (isDbConfigured()) {
        movieRepository.upsertMovieFromNguonC(unified.movie).catch((upsertErr) => {
          console.warn(
            `[MovieCache] Background upsert failed for ${slug}:`,
            upsertErr instanceof Error ? upsertErr.message : String(upsertErr)
          );
        });
      }
      return NextResponse.json({
        ...unified,
        cached: false,
      });
    }

    // 2. Fallback to PostgreSQL Persistent Cache if all upstream datasets failed
    if (isDbConfigured()) {
      try {
        const cachedMovie = await movieRepository.findMovieBySlug(slug);
        if (cachedMovie && cachedMovie.episodes && cachedMovie.episodes.length > 0) {
          return NextResponse.json({
            status: "success",
            movie: cachedMovie,
            cached: true,
          });
        }
      } catch (err) {
        console.warn(
          `[MovieCache] Failed to read from database for slug ${slug}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return NextResponse.json(
      { status: "error", message: "Không tìm thấy thông tin phim trên hệ thống" },
      { status: 404 }
    );
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === "TimeoutError";
    return NextResponse.json(
      {
        status: "error",
        message: isTimeout
          ? "Movie service timed out"
          : "Could not connect to upstream movie service",
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
