import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_API_URL =
  process.env.NGUONC_API_URL ?? "https://phim.nguonc.com/api";
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  if (
    path.length === 0 ||
    path.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return NextResponse.json(
      { status: "error", message: "Invalid API path" },
      { status: 400 }
    );
  }

  const targetUrl = new URL(
    `${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    `${UPSTREAM_API_URL.replace(/\/$/, "")}/`
  );

  try {
    const response = await fetch(targetUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await response.text();

    if (!response.ok) {
      console.error("[NguonC proxy] Upstream error", {
        status: response.status,
        path: path.join("/"),
      });

      return NextResponse.json(
        { status: "error", message: "Movie service is unavailable" },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    try {
      return NextResponse.json(JSON.parse(body), {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      console.error("[NguonC proxy] Upstream returned non-JSON data", {
        contentType: response.headers.get("content-type"),
        path: path.join("/"),
      });

      return NextResponse.json(
        { status: "error", message: "Movie service returned invalid data" },
        { status: 502 }
      );
    }
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";

    const cause = error instanceof Error ? error.cause : undefined;
    const causeMessage =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}${
            "code" in cause && cause.code ? ` (${cause.code})` : ""
          }`
        : cause
          ? String(cause)
          : "none";
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[NguonC proxy] Request failed for ${path.join("/")}: ${errorMessage}; cause: ${causeMessage}`
    );

    return NextResponse.json(
      {
        status: "error",
        message: isTimeout
          ? "Movie service timed out"
          : "Could not connect to movie service",
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
