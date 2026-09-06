// ==============================================================================
// app/api/history/route.ts
// Watch History API (List, Record, Clear)
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { historyRepository } from "@/lib/repositories/historyRepository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  // Identity is strictly bound to verified server session; client cannot spoof userId
  const userId = user.id;

  if (!isDbConfigured()) {
    return NextResponse.json({
      status: "success",
      history: [],
      message: "Database not connected; fallback to localStorage mode",
    });
  }

  try {
    const history = await historyRepository.getHistoryByUserId(userId);
    return NextResponse.json({ status: "success", history });
  } catch (error) {
    console.error("[History GET error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch watch history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  // Identity is strictly bound to verified server session; client cannot spoof userId
  const userId = user.id;

  if (!isDbConfigured()) {
    return NextResponse.json(
      { status: "error", message: "Database is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { action, movieSlug, movie, episodeSlug, episode, position, duration, history, slug } = body;

    // Bulk sync from localStorage migration
    if (action === "sync") {
      if (!Array.isArray(history)) {
        return NextResponse.json(
          { status: "error", message: "history array is required for sync" },
          { status: 400 }
        );
      }
      const synced = await historyRepository.bulkSyncHistory(userId, history);
      return NextResponse.json({
        status: "success",
        syncedCount: synced.length,
        history: synced,
        message: "History synced successfully",
      });
    }

    // Clear entire history
    if (action === "clear") {
      await historyRepository.clearHistory(userId);
      return NextResponse.json({
        status: "success",
        history: [],
        message: "Watch history cleared",
      });
    }

    // Remove single movie from history
    if (action === "remove" || action === "delete") {
      const targetSlug = slug || movieSlug || (typeof movie === "string" ? movie : movie?.slug);
      if (!targetSlug) {
        return NextResponse.json(
          { status: "error", message: "movieSlug or slug is required" },
          { status: 400 }
        );
      }
      await historyRepository.removeHistory(userId, targetSlug);
      return NextResponse.json({
        status: "success",
        message: "Movie removed from history",
      });
    }

    // Record single history entry
    const targetMovie = movie || movieSlug || slug;
    if (!targetMovie) {
      return NextResponse.json(
        { status: "error", message: "movie or movieSlug is required" },
        { status: 400 }
      );
    }

    const targetEpisode = episode || episodeSlug;

    const success = await historyRepository.upsertHistory(
      userId,
      targetMovie,
      targetEpisode,
      typeof position === "number" ? Math.floor(position) : 0,
      typeof duration === "number" ? Math.floor(duration) : 0
    );

    return NextResponse.json({ status: "success", recorded: success });
  } catch (error) {
    console.error("[History POST error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to record watch history" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  // Identity is strictly bound to verified server session; client cannot spoof userId
  const userId = user.id;

  if (!isDbConfigured()) {
    return NextResponse.json(
      { status: "error", message: "Database is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { movieSlug, clearAll } = body;

    if (clearAll) {
      await historyRepository.clearHistory(userId);
      return NextResponse.json({ status: "success", message: "History cleared" });
    }

    if (movieSlug) {
      await historyRepository.removeHistory(userId, movieSlug);
      return NextResponse.json({ status: "success", message: "Movie removed from history" });
    }

    return NextResponse.json(
      { status: "error", message: "Specify movieSlug or clearAll" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[History DELETE error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to delete history" },
      { status: 500 }
    );
  }
}
