// ==============================================================================
// app/api/catalog/search/route.ts
// Unified 6-Dataset Search Endpoint (shared by Web & Android)
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { searchUnifiedCatalog } from "@/services/unifiedCatalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || searchParams.get("keyword") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

    if (!q) {
      return NextResponse.json({
        status: "success",
        items: [],
        paginate: { current_page: 1, total_page: 1, total_items: 0, items_per_page: 24 },
      });
    }

    const result = await searchUnifiedCatalog(q, page);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/catalog/search] Error:", err);
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to search catalog",
        items: [],
      },
      { status: 500 }
    );
  }
}
