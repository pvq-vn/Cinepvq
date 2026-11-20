// ==============================================================================
// app/api/hls-proxy/route.ts
// Lightweight HLS Manifest Cleaner, PNG-TS Unwrapper & Subtitle Proxy
// - KKPhim1: cleans injected ad segments from .m3u8 (~25KB), segments stay direct CDN
// - VSMOV: proxies master.m3u8 + strips 478-byte PNG header from MPEG-TS segments + VTT subs
// - PhimHDCSS (FHDC): serves fresh inline HLS manifest from tiktok.phimhdc.com
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { rewriteHlsManifest, stripPngPrefixFromTs } from "@/lib/hlsCleaner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
};

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phimhdcssEmbed = searchParams.get("phimhdcssEmbed");

  // Mode A: PhimHDCSS FHDC live inline manifest extraction (tiktok.phimhdc.com)
  if (phimhdcssEmbed) {
    if (!isAllowedExternalUrl(phimhdcssEmbed)) {
      return NextResponse.json(
        { error: "Invalid embed URL" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    try {
      const host = new URL(phimhdcssEmbed).hostname.toLowerCase();
      if (!host.includes("phimhdc")) {
        return NextResponse.json(
          { error: "Unsupported embed host" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const res = await fetch(phimhdcssEmbed, {
        headers: {
          "User-Agent": UA,
          Referer: "https://phimhdcss.com/",
          Accept: "text/html,*/*",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Upstream returned ${res.status}` },
          { status: 502, headers: CORS_HEADERS }
        );
      }

      const html = await res.text();
      const bootMatch = html.match(
        /window\.__edgePlayBootstrap\s*=\s*Object\.freeze\(Object\.assign\((\{[\s\S]*?\})\s*,\s*\{/
      ) || html.match(/window\.__edgePlayBootstrap\s*=\s*(\{[\s\S]*?\});/);

      let inlineManifest = "";
      if (bootMatch?.[1]) {
        try {
          const parsed = JSON.parse(bootMatch[1]) as { manifest?: string };
          if (parsed.manifest && parsed.manifest.includes("#EXTM3U")) {
            inlineManifest = parsed.manifest;
          }
        } catch {
          // Fallback regex extraction of manifest JSON string
        }
      }

      if (!inlineManifest) {
        const mStr = html.match(/"manifest"\s*:\s*"(#EXTM3U(?:\\.|[^"\\])*)"/);
        if (mStr?.[1]) {
          inlineManifest = JSON.parse(`"${mStr[1]}"`);
        }
      }

      if (!inlineManifest || !inlineManifest.includes("#EXTM3U")) {
        return NextResponse.json(
          { error: "Manifest not found in embed" },
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const proxySegments = searchParams.get("proxySegments") === "1";
      const { manifest } = rewriteHlsManifest(inlineManifest, phimhdcssEmbed, {
        proxyBasePath: "/api/hls-proxy",
        stripAds: false,
        proxySegments,
        stripPng: proxySegments,
      });

      return new NextResponse(manifest, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "public, max-age=120",
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to load FHDC manifest" },
        { status: 502, headers: CORS_HEADERS }
      );
    }
  }

  // Mode B: Standard URL proxy (M3U8 cleaning, PNG-TS segment unwrap, or WebVTT subtitle)
  const targetUrl = searchParams.get("url");
  if (!targetUrl || !isAllowedExternalUrl(targetUrl)) {
    return NextResponse.json(
      { error: "Invalid or missing url" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const stripAds = searchParams.get("stripAds") === "1";
  const proxySegments = searchParams.get("proxySegments") === "1";
  const stripPng = searchParams.get("stripPng") === "1";
  const isVtt = searchParams.get("vtt") === "1";
  const referer = searchParams.get("ref") || undefined;

  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
  };
  if (referer && isAllowedExternalUrl(referer)) {
    headers["Referer"] = referer;
    try {
      headers["Origin"] = new URL(referer).origin;
    } catch {
      // ignore
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error ${upstream.status}`, {
        status: upstream.status >= 500 ? 502 : upstream.status,
        headers: CORS_HEADERS,
      });
    }

    // WebVTT Subtitle pass-through
    if (isVtt || targetUrl.toLowerCase().includes(".vtt")) {
      const vttText = await upstream.text();
      return new NextResponse(vttText, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/vtt; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const ct = (upstream.headers.get("content-type") || "").toLowerCase();
    const looksLikePlaylist =
      targetUrl.toLowerCase().includes(".m3u8") ||
      ct.includes("mpegurl") ||
      ct.includes("x-mpegurl");

    if (looksLikePlaylist) {
      const rawManifest = await upstream.text();
      if (!rawManifest.includes("#EXTM3U")) {
        return new NextResponse(rawManifest, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": ct || "text/plain; charset=utf-8",
          },
        });
      }

      const finalUrl = upstream.url || targetUrl;
      const { manifest, removedSegments, removedSeconds } = rewriteHlsManifest(
        rawManifest,
        finalUrl,
        {
          proxyBasePath: "/api/hls-proxy",
          stripAds,
          proxySegments,
          stripPng,
          referer,
        }
      );

      return new NextResponse(manifest, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "X-Cinepvq-Ads-Removed": String(removedSegments),
          "X-Cinepvq-Ads-Seconds": String(removedSeconds),
        },
      });
    }

    // Binary video segment (unwrap fake PNG prefix if requested)
    const rawBuf = new Uint8Array(await upstream.arrayBuffer());
    const finalBuf = stripPng ? stripPngPrefixFromTs(rawBuf) : rawBuf;

    return new NextResponse(Buffer.from(finalBuf), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "video/mp2t",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HLS proxy fetch failed" },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
