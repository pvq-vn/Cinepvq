// ==============================================================================
// app/api/movies/[slug]/route.ts
// Movie Detail Cache-Aside Endpoint (PostgreSQL + NguonC Upstream Fallback)
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { movieRepository } from "@/lib/repositories/movieRepository";
import type { MovieDetailResponse } from "@/types/movie";

const UPSTREAM_API_URL =
  process.env.NGUONC_API_URL ?? "https://phim.nguonc.com/api";
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.trim().length === 0) {
    return NextResponse.json(
      { status: "error", message: "Movie slug is required" },
      { status: 400 }
    );
  }

  // ─── 1. Check PostgreSQL Persistent Cache ──────────────────────────────────
  if (isDbConfigured()) {
    try {
      const cachedMovie = await movieRepository.findMovieBySlug(slug);
      if (cachedMovie && cachedMovie.episodes && cachedMovie.episodes.length > 0) {
        return NextResponse.json({
          status: "success",
          movie: cachedMovie,
          cached: true,
          source: "database",
        });
      }
    } catch (err) {
      console.warn(
        `[MovieCache] Failed to read from database for slug ${slug}, falling back to upstream:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // ─── 2. Upstream Fetch from NguonC ─────────────────────────────────────────
  const targetUrl = new URL(
    `film/${encodeURIComponent(slug)}`,
    `${UPSTREAM_API_URL.replace(/\/$/, "")}/`
  );

  try {
    const upstreamRes = await fetch(targetUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { status: "error", message: "Movie service upstream unavailable" },
        { status: upstreamRes.status >= 500 ? 502 : upstreamRes.status }
      );
    }

    const data: MovieDetailResponse = await upstreamRes.json();

    // ─── 3. Asynchronously Upsert Into PostgreSQL Cache ───────────────────────
    if (data.status === "success" && data.movie && isDbConfigured()) {
      movieRepository.upsertMovieFromNguonC(data.movie).catch((upsertErr) => {
        console.warn(
          `[MovieCache] Background upsert failed for ${slug}:`,
          upsertErr instanceof Error ? upsertErr.message : String(upsertErr)
        );
      });
    }

    return NextResponse.json({
      ...data,
      cached: false,
      source: "nguonc",
    });
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
