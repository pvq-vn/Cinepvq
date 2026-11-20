// ==============================================================================
// app/api/hls-proxy/route.ts
// Lightweight HLS Manifest Cleaner, PNG-TS Unwrapper & Subtitle Proxy
// - KKPhim1: cleans injected ad segments from .m3u8 (~25KB), segments stay direct CDN
// - VSMOV: proxies master.m3u8 + strips 478-byte PNG header from MPEG-TS segments + VTT subs
// - PhimHDCSS (FHDC): serves fresh inline HLS manifest from tiktok.phimhdc.com
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  extractSingleVariantUrl,
  findTsSyncOffsetInHeader,
  rewriteHlsManifest,
} from "@/lib/hlsCleaner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// In-memory LRU cache for cleaned HLS manifests (3 min TTL -> <5ms repeat/seek latency)
const MANIFEST_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_MANIFEST_CACHE = 300;
const manifestCache = new Map<
  string,
  { manifest: string; removedSegments: number; removedSeconds: number; expiresAt: number }
>();

function getCachedManifest(key: string) {
  const hit = manifestCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit;
  if (hit) manifestCache.delete(key);
  return null;
}

function setCachedManifest(
  key: string,
  manifest: string,
  removedSegments: number,
  removedSeconds: number
) {
  if (manifestCache.size >= MAX_MANIFEST_CACHE) {
    const oldest = manifestCache.keys().next().value;
    if (oldest) manifestCache.delete(oldest);
  }
  manifestCache.set(key, {
    manifest,
    removedSegments,
    removedSeconds,
    expiresAt: Date.now() + MANIFEST_CACHE_TTL_MS,
  });
}

/**
 * Zero-buffer streaming PNG-header unwrapper for disguised MPEG-TS segments.
 * Peeks only the first <= 2048 bytes to locate the MPEG-TS 0x47 sync triplet,
 * then streams every remaining byte straight through with minimal TTFB.
 */
function createStreamingPngUnwrapStream(
  upstreamBody: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = upstreamBody.getReader();
  let headerChunks: Uint8Array[] = [];
  let headerBytes = 0;
  let headerResolved = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerResolved) {
        while (headerBytes < 2048) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            headerChunks.push(value);
            headerBytes += value.byteLength;
          }
        }
        headerResolved = true;
        if (headerBytes === 0) {
          controller.close();
          return;
        }
        const combined = new Uint8Array(headerBytes);
        let offset = 0;
        for (const c of headerChunks) {
          combined.set(c, offset);
          offset += c.byteLength;
        }
        headerChunks = [];
        const tsOffset = findTsSyncOffsetInHeader(combined);
        const initialOut = tsOffset > 0 && tsOffset < combined.byteLength
          ? combined.subarray(tsOffset)
          : combined;
        controller.enqueue(initialOut);
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (value && value.byteLength > 0) {
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

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

    const proxySegments = searchParams.get("proxySegments") === "1";
    const fhdcCacheKey = `fhdc|${phimhdcssEmbed}|${proxySegments ? 1 : 0}`;
    const cachedFhdc = getCachedManifest(fhdcCacheKey);
    if (cachedFhdc) {
      return new NextResponse(cachedFhdc.manifest, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=300",
          "X-Cinepvq-Cache": "HIT",
        },
      });
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
        signal: AbortSignal.timeout(6500),
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

      const { manifest } = rewriteHlsManifest(inlineManifest, phimhdcssEmbed, {
        proxyBasePath: "/api/hls-proxy",
        stripAds: false,
        proxySegments,
        stripPng: proxySegments,
      });

      setCachedManifest(fhdcCacheKey, manifest, 0, 0);

      return new NextResponse(manifest, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=300",
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

  // Check fast in-memory manifest cache before making any network request
  const isManifestHint =
    !isVtt && targetUrl.toLowerCase().includes(".m3u8");
  const manifestCacheKey = `m3u8|${targetUrl}|${stripAds ? 1 : 0}|${proxySegments ? 1 : 0}|${stripPng ? 1 : 0}|${referer || ""}`;
  if (isManifestHint) {
    const cached = getCachedManifest(manifestCacheKey);
    if (cached) {
      return new NextResponse(cached.manifest, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "public, max-age=180, s-maxage=180, stale-while-revalidate=300",
          "X-Cinepvq-Ads-Removed": String(cached.removedSegments),
          "X-Cinepvq-Ads-Seconds": String(cached.removedSeconds),
          "X-Cinepvq-Cache": "HIT",
        },
      });
    }
  }

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
      signal: AbortSignal.timeout(9000),
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
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    const ct = (upstream.headers.get("content-type") || "").toLowerCase();
    const looksLikePlaylist =
      targetUrl.toLowerCase().includes(".m3u8") ||
      ct.includes("mpegurl") ||
      ct.includes("x-mpegurl");

    if (looksLikePlaylist) {
      let rawManifest = await upstream.text();
      if (!rawManifest.includes("#EXTM3U")) {
        return new NextResponse(rawManifest, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": ct || "text/plain; charset=utf-8",
          },
        });
      }

      let finalUrl = upstream.url || targetUrl;

      // Single-Variant Master Flattening: collapse master -> single media playlist in 1 RTT!
      const singleVariantUrl = extractSingleVariantUrl(rawManifest, finalUrl);
      if (singleVariantUrl && isAllowedExternalUrl(singleVariantUrl)) {
        try {
          const childRes = await fetch(singleVariantUrl, {
            headers,
            redirect: "follow",
            signal: AbortSignal.timeout(6500),
          });
          if (childRes.ok) {
            const childText = await childRes.text();
            if (childText.includes("#EXTM3U") && childText.includes("#EXTINF:")) {
              rawManifest = childText;
              finalUrl = childRes.url || singleVariantUrl;
            }
          }
        } catch {
          // Graceful fallback: return master manifest as-is
        }
      }

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

      setCachedManifest(manifestCacheKey, manifest, removedSegments, removedSeconds);

      return new NextResponse(manifest, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "public, max-age=180, s-maxage=180, stale-while-revalidate=300",
          "X-Cinepvq-Ads-Removed": String(removedSegments),
          "X-Cinepvq-Ads-Seconds": String(removedSeconds),
        },
      });
    }

    // Binary video segment: stream directly with zero full-segment memory buffering!
    if (upstream.body) {
      const outputStream = stripPng
        ? createStreamingPngUnwrapStream(upstream.body)
        : upstream.body;
      return new NextResponse(outputStream, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "video/mp2t",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    const rawBuf = new Uint8Array(await upstream.arrayBuffer());
    return new NextResponse(Buffer.from(rawBuf), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "video/mp2t",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HLS proxy fetch failed" },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
