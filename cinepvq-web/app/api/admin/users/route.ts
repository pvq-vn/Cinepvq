import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, SOLE_ADMIN_EMAIL } from "@/lib/auth/admin";
import { queryPg } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    let whereSql = "";
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q}%`);
      whereSql = `WHERE u.email ILIKE $1 OR u.username ILIKE $1`;
    }

    const res = await queryPg<{
      id: string;
      email: string;
      username: string | null;
      avatar_url: string | null;
      role: string;
      status: string;
      created_at: string;
      history_count: string;
      favorites_count: string;
      watchlist_count: string;
      comments_count: string;
    }>(
      `SELECT
        u.id,
        u.email,
        u.username,
        u.avatar_url,
        CASE WHEN LOWER(u.email) = '${SOLE_ADMIN_EMAIL}' THEN 'admin' ELSE 'user' END AS role,
        u.status,
        u.created_at,
        (SELECT COUNT(*) FROM public.watch_history wh WHERE wh.user_id = u.id) AS history_count,
        (SELECT COUNT(*) FROM public.favorites f WHERE f.user_id = u.id) AS favorites_count,
        (SELECT COUNT(*) FROM public.watchlist w WHERE w.user_id = u.id) AS watchlist_count,
        (SELECT COUNT(*) FROM public.comments c WHERE c.user_id = u.id) AS comments_count
      FROM public.users u
      ${whereSql}
      ORDER BY CASE WHEN LOWER(u.email) = '${SOLE_ADMIN_EMAIL}' THEN 0 ELSE 1 END, u.created_at DESC
      LIMIT 100`,
      params
    );

    return NextResponse.json({
      status: true,
      users: res.rows.map((u) => ({
        ...u,
        historyCount: Number(u.history_count || 0),
        favoritesCount: Number(u.favorites_count || 0),
        watchlistCount: Number(u.watchlist_count || 0),
        commentsCount: Number(u.comments_count || 0),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to load users",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const { userId, status, username } = body;

    if (!userId) {
      return NextResponse.json(
        { status: false, message: "Thiếu userId" },
        { status: 400 }
      );
    }

    const userRes = await queryPg<{ email: string }>(
      `SELECT email FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const targetEmail = (userRes.rows[0]?.email || "").toLowerCase();

    if (targetEmail === SOLE_ADMIN_EMAIL && status && status !== "active") {
      return NextResponse.json(
        {
          status: false,
          message: "Không thể khóa tài khoản Quản trị viên duy nhất của hệ thống!",
        },
        { status: 400 }
      );
    }

    await queryPg(
      `UPDATE public.users
       SET
         status = COALESCE($2, status),
         username = COALESCE($3, username),
         updated_at = NOW()
       WHERE id = $1`,
      [userId, status ?? null, username ?? null]
    );

    return NextResponse.json({
      status: true,
      message: "Cập nhật người dùng thành công.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to update user",
      },
      { status: 500 }
    );
  }
}
