// ==============================================================================
// app/api/favorites/route.ts
// User Favorites API (List, Toggle, Remove)
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { favoriteRepository } from "@/lib/repositories/favoriteRepository";
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
      favorites: [],
      message: "Database not connected; fallback to localStorage mode",
    });
  }

  try {
    const favorites = await favoriteRepository.getFavoritesByUserId(userId);
    return NextResponse.json({ status: "success", favorites });
  } catch (error) {
    console.error("[Favorites GET error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch favorites" },
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
    const { action, movieSlug, movie, favorites, slug } = body;

    // Bulk sync from localStorage migration
    if (action === "sync") {
      if (!Array.isArray(favorites)) {
        return NextResponse.json(
          { status: "error", message: "favorites array is required for sync" },
          { status: 400 }
        );
      }
      const synced = await favoriteRepository.bulkSyncFavorites(userId, favorites);
      return NextResponse.json({
        status: "success",
        syncedCount: synced.length,
        favorites: synced,
        message: "Favorites synced successfully",
      });
    }

    // Explicit clear all action
    if (action === "clear") {
      await favoriteRepository.clearFavorites(userId);
      return NextResponse.json({
        status: "success",
        favorites: [],
        message: "Favorites cleared successfully",
      });
    }

    // Explicit remove action
    if (action === "remove" || action === "delete") {
      const targetSlug = slug || movieSlug || (typeof movie === "string" ? movie : movie?.slug);
      if (!targetSlug) {
        return NextResponse.json(
          { status: "error", message: "movieSlug or slug is required to remove" },
          { status: 400 }
        );
      }
      const removed = await favoriteRepository.removeFavorite(userId, targetSlug);
      return NextResponse.json({
        status: "success",
        favorited: false,
        removed,
        message: "Removed from favorites",
      });
    }

    // Default: toggle favorite
    const targetMovie = movie || movieSlug || slug;
    if (!targetMovie) {
      return NextResponse.json(
        { status: "error", message: "movie, movieSlug, or slug is required" },
        { status: 400 }
      );
    }

    const favorited = await favoriteRepository.toggleFavorite(userId, targetMovie);
    return NextResponse.json({
      status: "success",
      favorited,
      message: favorited ? "Added to favorites" : "Removed from favorites",
    });
  } catch (error) {
    console.error("[Favorites POST error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to update favorites" },
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
    const { clearAll, movieSlug, slug } = body;

    if (clearAll) {
      await favoriteRepository.clearFavorites(userId);
      return NextResponse.json({
        status: "success",
        message: "Favorites cleared",
      });
    }

    const targetSlug = movieSlug || slug;
    if (!targetSlug) {
      return NextResponse.json(
        { status: "error", message: "movieSlug or clearAll is required" },
        { status: 400 }
      );
    }

    const removed = await favoriteRepository.removeFavorite(userId, targetSlug);
    return NextResponse.json({
      status: "success",
      removed,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("[Favorites DELETE error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to delete favorite" },
      { status: 500 }
    );
  }
}
