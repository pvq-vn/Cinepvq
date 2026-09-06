// ==============================================================================
// app/api/settings/route.ts
// User Settings API (Fetch & Update)
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { settingsRepository } from "@/lib/repositories/settingsRepository";
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
      settings: {
        theme: "system",
        autoPlay: true,
        soundEnabled: true,
        preferredQuality: "auto",
      },
      message: "Database not connected; fallback to localStorage mode",
    });
  }

  try {
    const settings = await settingsRepository.getSettingsByUserId(userId);
    return NextResponse.json({ status: "success", settings });
  } catch (error) {
    console.error("[Settings GET error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

async function handleUpdateSettings(request: NextRequest) {
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
    const settings = body.settings || body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { status: "error", message: "settings object is required" },
        { status: 400 }
      );
    }

    const updated = await settingsRepository.upsertSettings(userId, settings);
    return NextResponse.json({ status: "success", settings: updated });
  } catch (error) {
    console.error("[Settings update error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleUpdateSettings(request);
}

export async function PUT(request: NextRequest) {
  return handleUpdateSettings(request);
}

export async function PATCH(request: NextRequest) {
  return handleUpdateSettings(request);
}
