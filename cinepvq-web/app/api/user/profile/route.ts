// ==============================================================================
// app/api/user/profile/route.ts
// User Profile API (Get & Update Username, Avatar)
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { userRepository } from "@/lib/repositories/userRepository";
import { mapUserRowToProfile } from "@/lib/db/types";
import { getAuthenticatedUser, createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  const userId = authUser.id;
  let profile = null;

  if (isDbConfigured()) {
    try {
      const row = await userRepository.findUserById(userId);
      if (row) {
        profile = mapUserRowToProfile(row);
      }
    } catch (err) {
      console.warn("[Profile GET DB error]", err);
    }
  }

  if (!profile) {
    profile = {
      id: userId,
      email: authUser.email || "",
      username:
        authUser.user_metadata?.username ||
        authUser.user_metadata?.full_name ||
        authUser.email?.split("@")[0] ||
        "User",
      avatarUrl: authUser.user_metadata?.avatar_url,
      createdAt: authUser.created_at,
    };
  }

  return NextResponse.json({
    status: "success",
    user: profile,
  });
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  const userId = authUser.id;

  try {
    const body = await request.json();
    const { username, avatarUrl } = body;

    if (!username && avatarUrl === undefined) {
      return NextResponse.json(
        { status: "error", message: "No profile update fields provided" },
        { status: 400 }
      );
    }

    // 1. Update Supabase Auth user metadata
    const supabase = await createServerSupabase();
    if (supabase) {
      const metaUpdates: Record<string, unknown> = {};
      if (username) metaUpdates.username = username.trim();
      if (avatarUrl !== undefined) metaUpdates.avatar_url = avatarUrl;
      try {
        await supabase.auth.updateUser({ data: metaUpdates });
      } catch (authErr) {
        console.warn("[Supabase auth.updateUser error]", authErr);
      }
    }

    // 2. Update PostgreSQL users table if database is configured
    if (isDbConfigured()) {
      const updatedRow = await userRepository.updateProfile(userId, {
        username: username?.trim(),
        avatarUrl,
      });

      if (updatedRow) {
        return NextResponse.json({
          status: "success",
          user: mapUserRowToProfile(updatedRow),
          message: "Cập nhật hồ sơ thành công",
        });
      }
    }

    // Fallback response if DB offline but Auth succeeded
    return NextResponse.json({
      status: "success",
      user: {
        id: userId,
        email: authUser.email || "",
        username: username?.trim() || authUser.user_metadata?.username || "User",
        avatarUrl: avatarUrl !== undefined ? avatarUrl : authUser.user_metadata?.avatar_url,
        createdAt: authUser.created_at,
      },
      message: "Cập nhật hồ sơ thành công",
    });
  } catch (error: unknown) {
    console.error("[Profile PATCH error]", error);
    const err = error as { code?: string; message?: string };
    if (err.code === "23505" || err.message?.includes("users_username_key")) {
      return NextResponse.json(
        { status: "error", message: "Tên người dùng đã tồn tại. Vui lòng chọn tên khác." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { status: "error", message: "Failed to update user profile" },
      { status: 500 }
    );
  }
}
