// ==============================================================================
// app/api/comments/route.ts
// Movie Comments API (List & Post)
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { commentRepository } from "@/lib/repositories/commentRepository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { status: "error", message: "Movie slug is required" },
      { status: 400 }
    );
  }

  if (!isDbConfigured()) {
    return NextResponse.json({
      status: "success",
      comments: [],
      message: "Database not connected; comments in local state mode",
    });
  }

  try {
    const comments = await commentRepository.getCommentsByMovieSlug(slug);
    return NextResponse.json({ status: "success", comments });
  } catch (error) {
    console.error("[Comments GET error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required to post comments" },
      { status: 401 }
    );
  }

  // Identity is strictly bound to verified server session; client cannot spoof userId
  const userId = user.id;

  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        status: "error",
        message: "Database is not configured for persistent comments",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { movieSlug, content } = body;

    if (!movieSlug || typeof movieSlug !== "string") {
      return NextResponse.json(
        { status: "error", message: "Invalid or missing movieSlug" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { status: "error", message: "Content cannot be empty" },
        { status: 400 }
      );
    }

    const newComment = await commentRepository.createComment(
      userId,
      movieSlug,
      content.trim()
    );

    if (!newComment) {
      return NextResponse.json(
        { status: "error", message: "Movie not found or comment creation failed" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { status: "success", comment: newComment },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Comments POST error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to save comment" },
      { status: 500 }
    );
  }
}
