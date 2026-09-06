// ==============================================================================
// app/api/watchlist/route.ts
// User Watchlist (Xem Sau) API
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, createServerSupabase } from "@/lib/supabase/server";
import type { WatchlistItem } from "@/types/movie";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  const rawList = user.user_metadata?.watchlist;
  const watchlist: WatchlistItem[] = Array.isArray(rawList)
    ? rawList
        .filter((item): item is WatchlistItem => Boolean(item && item.slug))
        .sort((a, b) => {
          const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 100)
    : [];

  return NextResponse.json({
    status: "success",
    watchlist,
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { status: "error", message: "Failed to initialize server auth client" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { action, watchlist, movie, slug } = body;

    const rawCloudList = user.user_metadata?.watchlist;
    const currentCloud: WatchlistItem[] = Array.isArray(rawCloudList)
      ? rawCloudList.filter((item): item is WatchlistItem => Boolean(item && item.slug))
      : [];

    let updatedList: WatchlistItem[] = [];

    if (action === "sync") {
      const clientList: WatchlistItem[] = Array.isArray(watchlist) ? watchlist : [];
      const mergedMap = new Map<string, WatchlistItem>();

      // 1. Cloud items first
      currentCloud.forEach((item) => {
        if (item && item.slug) mergedMap.set(item.slug, item);
      });

      // 2. Merge client items with timestamp reconciliation
      clientList.forEach((item) => {
        if (item && item.slug) {
          if (!mergedMap.has(item.slug)) {
            mergedMap.set(item.slug, item);
          } else {
            const existing = mergedMap.get(item.slug)!;
            const timeClient = item.addedAt ? new Date(item.addedAt).getTime() : 0;
            const timeExisting = existing.addedAt ? new Date(existing.addedAt).getTime() : 0;
            if (timeClient > timeExisting) {
              mergedMap.set(item.slug, item);
            }
          }
        }
      });

      updatedList = Array.from(mergedMap.values())
        .sort((a, b) => {
          const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 100);
    } else if (action === "add") {
      if (!movie || typeof movie !== "object" || !movie.slug) {
        return NextResponse.json(
          { status: "error", message: "movie object with slug is required to add" },
          { status: 400 }
        );
      }

      const filtered = currentCloud.filter((item) => item.slug !== movie.slug);
      const newItem: WatchlistItem = {
        slug: movie.slug,
        name: movie.name || movie.slug,
        original_name: movie.original_name,
        thumb_url: movie.thumb_url || "",
        poster_url: movie.poster_url,
        year: movie.year,
        quality: movie.quality,
        current_episode: movie.current_episode,
        type: movie.type,
        addedAt: movie.addedAt || new Date().toISOString(),
      };

      updatedList = [newItem, ...filtered].slice(0, 100);
    } else if (action === "remove") {
      const targetSlug = slug || movie?.slug;
      if (!targetSlug || typeof targetSlug !== "string") {
        return NextResponse.json(
          { status: "error", message: "slug is required to remove from watchlist" },
          { status: 400 }
        );
      }
      updatedList = currentCloud.filter((item) => item.slug !== targetSlug);
    } else if (action === "clear") {
      updatedList = [];
    } else {
      return NextResponse.json(
        { status: "error", message: "Invalid action. Expected sync, add, remove, or clear" },
        { status: 400 }
      );
    }

    // Persist to Supabase Auth user metadata
    const { error: updateErr } = await supabase.auth.updateUser({
      data: { watchlist: updatedList },
    });

    if (updateErr) {
      console.warn("[Watchlist API] Failed to update user metadata", updateErr);
      return NextResponse.json(
        { status: "error", message: updateErr.message || "Failed to persist watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      watchlist: updatedList,
      count: updatedList.length,
    });
  } catch (error) {
    console.error("[Watchlist POST error]", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error updating watchlist" },
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

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { status: "error", message: "Failed to initialize server auth client" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const clearAll = searchParams.get("clear") === "true";

    const rawCloudList = user.user_metadata?.watchlist;
    const currentCloud: WatchlistItem[] = Array.isArray(rawCloudList)
      ? rawCloudList.filter((item): item is WatchlistItem => Boolean(item && item.slug))
      : [];

    let updatedList: WatchlistItem[] = [];

    if (clearAll) {
      updatedList = [];
    } else if (slug) {
      updatedList = currentCloud.filter((item) => item.slug !== slug);
    } else {
      return NextResponse.json(
        { status: "error", message: "Specify slug or clear=true" },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      data: { watchlist: updatedList },
    });

    if (updateErr) {
      console.warn("[Watchlist DELETE error]", updateErr);
      return NextResponse.json(
        { status: "error", message: updateErr.message || "Failed to update watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      watchlist: updatedList,
    });
  } catch (error) {
    console.error("[Watchlist DELETE error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to delete item from watchlist" },
      { status: 500 }
    );
  }
}
