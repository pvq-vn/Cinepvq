import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export const SOLE_ADMIN_EMAIL = "vanquyetp823@gmail.com";

export function isSoleAdminEmail(email?: string | null): boolean {
  return (email || "").trim().toLowerCase() === SOLE_ADMIN_EMAIL;
}

/**
 * Verifies that the request is from the sole administrator account (vanquyetp823@gmail.com).
 * Supports both Cookie-based Web sessions and Bearer-token Android mobile requests.
 */
export async function requireAdminUser(
  request: NextRequest
): Promise<{ user: User; errorResponse?: undefined } | { user?: undefined; errorResponse: NextResponse }> {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return {
      errorResponse: NextResponse.json(
        {
          status: false,
          message: "Unauthorized: Yêu cầu đăng nhập tài khoản quản trị.",
        },
        { status: 401 }
      ),
    };
  }

  if (!isSoleAdminEmail(authUser.email)) {
    return {
      errorResponse: NextResponse.json(
        {
          status: false,
          message: "Forbidden: Quyền truy cập chỉ dành riêng cho Quản trị viên hệ thống (vanquyetp823@gmail.com).",
        },
        { status: 403 }
      ),
    };
  }

  return { user: authUser };
}
