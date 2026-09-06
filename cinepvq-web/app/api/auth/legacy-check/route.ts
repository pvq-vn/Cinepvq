// ==============================================================================
// app/api/auth/legacy-check/route.ts
// Check if an email belongs to an unmigrated legacy user (pre-Phase 4)
// Allows safe self-activation into Supabase Auth without plaintext password leak
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { query, isDbConfigured } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ status: "success", isLegacy: false });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.toLowerCase()?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { status: "error", message: "Invalid email" },
        { status: 400 }
      );
    }

    const pubRes = await query<{ id: string; username: string }>(
      "SELECT id, username FROM public.users WHERE LOWER(email) = $1 LIMIT 1;",
      [email]
    );

    if (!pubRes || pubRes.rows.length === 0) {
      return NextResponse.json({ status: "success", isLegacy: false });
    }

    const authRes = await query<{ id: string }>(
      "SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1;",
      [email]
    );

    const existsInAuth = Boolean(authRes && authRes.rows.length > 0);

    if (existsInAuth) {
      // Auto-confirm email if unconfirmed to prevent "Email not confirmed" error
      await query(
        "UPDATE auth.users SET email_confirmed_at = CURRENT_TIMESTAMP WHERE LOWER(email) = $1 AND email_confirmed_at IS NULL;",
        [email]
      );
    }

    return NextResponse.json({
      status: "success",
      isLegacy: !existsInAuth,
      username: pubRes.rows[0].username,
    });
  } catch (error) {
    console.error("[Legacy Check Error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to check legacy status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ status: "success", isLegacy: false });
  }

  try {
    const body = await request.json();
    const email = body?.email?.toLowerCase()?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { status: "error", message: "Invalid email" },
        { status: 400 }
      );
    }

    // 1. Check if user exists in public.users
    const pubRes = await query<{ id: string; username: string }>(
      "SELECT id, username FROM public.users WHERE LOWER(email) = $1 LIMIT 1;",
      [email]
    );

    if (!pubRes || pubRes.rows.length === 0) {
      return NextResponse.json({ status: "success", isLegacy: false });
    }

    // 2. Check if user already exists in auth.users
    const authRes = await query<{ id: string }>(
      "SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1;",
      [email]
    );

    const existsInAuth = Boolean(authRes && authRes.rows.length > 0);

    if (existsInAuth) {
      await query(
        "UPDATE auth.users SET email_confirmed_at = CURRENT_TIMESTAMP WHERE LOWER(email) = $1 AND email_confirmed_at IS NULL;",
        [email]
      );
    }

    return NextResponse.json({
      status: "success",
      isLegacy: !existsInAuth,
      username: pubRes.rows[0].username,
    });
  } catch (error) {
    console.error("[Legacy Check Error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to check legacy status" },
      { status: 500 }
    );
  }
}
