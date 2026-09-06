// ==============================================================================
// app/api/notifications/route.ts
// User Notifications API (List & Mark as Read)
// Hardened with Server-Side Supabase Authentication Guard
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { notificationRepository } from "@/lib/repositories/notificationRepository";
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
      notifications: [],
      message: "Database not connected; fallback to localStorage mode",
    });
  }

  try {
    const notifications = await notificationRepository.getNotificationsByUserId(
      userId
    );
    return NextResponse.json({ status: "success", notifications });
  } catch (error) {
    console.error("[Notifications GET error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch notifications" },
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
    const { notificationId, markAll } = body;

    if (markAll) {
      await notificationRepository.markAllAsRead(userId);
      return NextResponse.json({
        status: "success",
        message: "All notifications marked as read",
      });
    }

    if (notificationId) {
      await notificationRepository.markAsRead(notificationId);
      return NextResponse.json({
        status: "success",
        message: "Notification marked as read",
      });
    }

    return NextResponse.json(
      { status: "error", message: "Specify notificationId or markAll" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Notifications POST error]", error);
    return NextResponse.json(
      { status: "error", message: "Failed to update notification" },
      { status: 500 }
    );
  }
}
