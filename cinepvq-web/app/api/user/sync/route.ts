// ==============================================================================
// app/api/user/sync/route.ts
// User Identity Synchronization with Supabase PostgreSQL
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { userRepository } from "@/lib/repositories/userRepository";
import { mapUserRowToProfile } from "@/lib/db/types";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  // Identity is strictly bound to verified server session; client cannot spoof userId
  const userId = authUser.id;
  const email = authUser.email || "";
  const username =
    authUser.user_metadata?.username ||
    authUser.user_metadata?.full_name ||
    email.split("@")[0] ||
    "User";

  if (!isDbConfigured()) {
    return NextResponse.json({
      status: "success",
      user: {
        id: userId,
        email,
        username,
        avatarUrl: authUser.user_metadata?.avatar_url,
        createdAt: authUser.created_at,
      },
      fallback: true,
    });
  }

  try {
    let userRow = await userRepository.findUserById(userId);

    if (!userRow) {
      // If trigger hasn't fired yet or legacy linking is needed
      userRow = await userRepository.ensureUser({
        id: userId,
        email,
        username,
        avatarUrl: authUser.user_metadata?.avatar_url,
      });
    }

    if (!userRow) {
      return NextResponse.json(
        { status: "error", message: "Failed to synchronize user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      user: mapUserRowToProfile(userRow),
      fallback: false,
    });
  } catch (error) {
    console.error("[User Sync POST error]", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error during user sync" },
      { status: 500 }
    );
  }
}
