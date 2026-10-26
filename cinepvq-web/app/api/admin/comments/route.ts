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
      movie_slug: string;
      content: string;
      rating: number | null;
      created_at: string;
      email: string;
      username: string | null;
      movie_name: string | null;
    }>(
      `SELECT
        c.id,
        c.movie_slug,
        c.content,
        c.rating,
        c.created_at,
        u.email,
        u.username,
        m.name AS movie_name
       FROM public.comments c
       JOIN public.users u ON u.id = c.user_id
       LEFT JOIN public.movies m ON m.slug = c.movie_slug
       ORDER BY c.created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({
      status: true,
      comments: res.rows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to load comments",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { status: false, message: "Thiếu ID bình luận" },
        { status: 400 }
      );
    }

    await queryPg(`DELETE FROM public.comments WHERE id = $1`, [id]);

    return NextResponse.json({
      status: true,
      message: "Đã xóa bình luận.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: false,
        message: err instanceof Error ? err.message : "Failed to delete comment",
      },
      { status: 500 }
    );
  }
}
