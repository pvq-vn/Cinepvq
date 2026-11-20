// ==============================================================================
// app/api/catalog/latest/route.ts
// Unified Latest Movies Endpoint (KKPhim1 + VSMOV + NguonC merged & deduplicated)
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getUnifiedLatestMovies } from "@/services/unifiedCatalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

    const result = await getUnifiedLatestMovies(page);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/catalog/latest] Error:", err);
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load latest movies",
        items: [],
      },
      { status: 500 }
    );
  }
}
