import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { queryPg } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const res = await queryPg<{
      id: string;
      user_id: string;
      title: string;
      message: string;
      type: string;
      movie_slug: string | null;
      is_read: boolean;
      created_at: string;
      email: string;
    }>(
      `SELECT
        n.id,
        n.user_id,
        n.title,
        n.message,
        n.type,
        n.movie_slug,
        n.is_read,
        n.created_at,
        u.email
       FROM public.notifications n
       JOIN public.users u ON u.id = n.user_id
       ORDER BY n.created_at DESC
       LIMIT 60`
    );

    return NextResponse.json({
      status: true,
      notifications: res.rows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to load notifications",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const { title, message, type = "system", movieSlug = null, targetUserId = "all" } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json(
        { status: false, message: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo." },
        { status: 400 }
      );
    }

    if (targetUserId === "all") {
      const insertRes = await queryPg(
        `INSERT INTO public.notifications (user_id, title, message, type, movie_slug)
         SELECT id, $1, $2, $3, $4 FROM public.users`,
        [title.trim(), message.trim(), type, movieSlug || null]
      );
      return NextResponse.json({
        status: true,
        message: `Đã phát thông báo hệ thống tới toàn bộ (${insertRes.rowCount || 0}) người dùng!`,
      });
    } else {
      await queryPg(
        `INSERT INTO public.notifications (user_id, title, message, type, movie_slug)
         VALUES ($1, $2, $3, $4, $5)`,
        [targetUserId, title.trim(), message.trim(), type, movieSlug || null]
      );
      return NextResponse.json({
        status: true,
        message: "Đã gửi thông báo tới người dùng.",
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to broadcast notification",
      },
      { status: 500 }
    );
  }
}
