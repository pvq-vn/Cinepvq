// ==============================================================================
// services/videoSources/index.ts
// Multi-Source Video Engine: Central Resolver & Orchestration
// Priority: 1. VSMOV Native HLS -> 2. PhimHDCSS (FHDC) -> 3. K20 -> 4. KKPhim1 (Ad-Free) -> 5. ChoPhim -> 6. NguonC
// Includes in-memory TTL cache + strict per-adapter deadline for sub-3s resolution & 0ms cached switching.
// ==============================================================================

import type {
  ResolvedSource,
  ResolveSourceOptions,
  VideoSourceAdapter,
} from "./types";
import { K20Adapter } from "./adapters/k20Adapter";
import { VsmovAdapter } from "./adapters/vsmovAdapter";
import { PhimHdcssAdapter } from "./adapters/phimhdcssAdapter";
import { ChoPhimAdapter } from "./adapters/chophimAdapter";
import { KKPhimAdapter } from "./adapters/kkphimAdapter";
import { NguonCAdapter } from "./adapters/nguoncAdapter";

export * from "./types";

const adapters: VideoSourceAdapter[] = [
  new VsmovAdapter(),
  new PhimHdcssAdapter(),
  new K20Adapter(),
  new KKPhimAdapter(),
  new ChoPhimAdapter(),
  new NguonCAdapter(),
];

const ADAPTER_SOFT_DEADLINE_MS = 3200;

function withSoftTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  sources: ResolvedSource[];
  expiresAt: number;
}

const streamResolveCache = new Map<string, CacheEntry>();

function buildCacheKey(options: ResolveSourceOptions): string {
  return [
    (options.slug || "").trim().toLowerCase(),
    options.season || 1,
    options.episode || 1,
    (options.episodeSlug || "").trim().toLowerCase(),
    (options.serverName || "").trim().toLowerCase(),
    options.type || "series",
    options.knownHlsUrl || "",
  ].join("|");
}

export function clearStreamResolveCache(): number {
  const count = streamResolveCache.size;
  streamResolveCache.clear();
  return count;
}

export function getStreamResolveCacheSize(): number {
  return streamResolveCache.size;
}

export function getCachedSources(
  options: ResolveSourceOptions
): ResolvedSource[] | null {
  const cacheKey = buildCacheKey(options);
  const cached = streamResolveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.sources.length > 0) {
    return cached.sources;
  }
  return null;
}

/**
 * Server-side resolution: Queries all adapters in parallel with a strict soft deadline,
 * filters valid streams, deduplicates by sourceId, and sorts them by speed priority.
 */
export async function resolveAllAvailableSourcesServer(
  options: ResolveSourceOptions
): Promise<ResolvedSource[]> {
  const cacheKey = buildCacheKey(options);
  const now = Date.now();
  const cached = streamResolveCache.get(cacheKey);
  if (cached && cached.expiresAt > now && cached.sources.length > 0) {
    return cached.sources;
  }

  const results = await Promise.allSettled(
    adapters.map((adapter) =>
      withSoftTimeout(adapter.resolveStream(options), ADAPTER_SOFT_DEADLINE_MS)
    )
  );

  const resolved: ResolvedSource[] = [];
  const seenSourceIds = new Set<string>();

  for (const res of results) {
    if (res.status === "fulfilled" && res.value && res.value.url) {
      const sid = res.value.sourceId;
      if (!seenSourceIds.has(sid)) {
        seenSourceIds.add(sid);
        resolved.push(res.value);
      }
    }
  }

  // Share VSMOV's clean WebVTT subtitles with PhimHDCSS (FHDC) when FHDC lacks softsubs
  const vsmovSubtitles = resolved.find(
    (s) => s.sourceId === "vsmov" && Array.isArray(s.subtitles) && s.subtitles.length > 0
  )?.subtitles;
  if (vsmovSubtitles && vsmovSubtitles.length > 0) {
    for (let i = 0; i < resolved.length; i++) {
      if (
        resolved[i].sourceId === "phimhdcss" &&
        (!resolved[i].subtitles || resolved[i].subtitles!.length === 0)
      ) {
        resolved[i] = {
          ...resolved[i],
          subtitles: vsmovSubtitles,
        };
      }
    }
  }

  // Always prefer native HLS sources over iframes, then sort by priority
  resolved.sort((a, b) => {
    if (a.type === "hls" && b.type !== "hls") return -1;
    if (a.type !== "hls" && b.type === "hls") return 1;
    return a.priority - b.priority;
  });

  if (resolved.length > 0) {
    if (streamResolveCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = streamResolveCache.keys().next().value;
      if (oldestKey) streamResolveCache.delete(oldestKey);
    }
    streamResolveCache.set(cacheKey, {
      sources: resolved,
      expiresAt: now + CACHE_TTL_MS,
    });
  }

  return resolved;
}

/**
 * Universal Client/Server Resolver:
 * In browser: calls `/api/video-sources/resolve` to bypass CORS.
 * On server: queries adapters directly.
 */
export async function resolveAllSources(
  options: ResolveSourceOptions,
  fetchConfig?: { priority?: "high" | "low" | "auto" }
): Promise<ResolvedSource[]> {
  if (typeof window !== "undefined") {
    const cacheKey = buildCacheKey(options);
    const now = Date.now();
    const cached = streamResolveCache.get(cacheKey);
    if (cached && cached.expiresAt > now && cached.sources.length > 0) {
      return cached.sources;
    }

    try {
      const params = new URLSearchParams();
      if (options.slug) params.set("slug", options.slug);
      if (options.imdbId) params.set("imdbId", options.imdbId);
      if (options.tmdbId) params.set("tmdbId", options.tmdbId);
      if (options.title) params.set("title", options.title);
      if (options.season) params.set("season", String(options.season));
      if (options.episode) params.set("episode", String(options.episode));
      if (options.type) params.set("type", options.type);
      if (options.nguoncEmbedUrl) params.set("nguoncEmbedUrl", options.nguoncEmbedUrl);
      if (options.knownHlsUrl) params.set("knownHlsUrl", options.knownHlsUrl);
      if (options.serverName) params.set("serverName", options.serverName);
      if (options.episodeSlug) params.set("episodeSlug", options.episodeSlug);

      const reqInit: RequestInit & { priority?: "high" | "low" | "auto" } = {};
      if (fetchConfig?.priority) {
        reqInit.priority = fetchConfig.priority;
      }

      const res = await fetch(`/api/video-sources/resolve?${params.toString()}`, reqInit);
      if (!res.ok) {
        if (options.knownHlsUrl && options.knownHlsUrl.includes(".m3u8")) {
          return [
            {
              sourceId: "kkphim",
              name: "KKPhim1 Direct HLS (Đã cắt QC)",
              displayName: "KKPhim1 Direct",
              type: "hls",
              url: `/api/hls-proxy?url=${encodeURIComponent(options.knownHlsUrl.trim())}&stripAds=1`,
              rawUrl: options.knownHlsUrl.trim(),
              priority: 5,
              isAvailable: true,
              adFree: true,
            },
          ];
        }
        if (options.nguoncEmbedUrl) {
          return [
            {
              sourceId: "nguonc",
              name: "Server Dự Phòng (StreamC)",
              displayName: "Server Dự Phòng",
              type: options.nguoncEmbedUrl.includes(".m3u8") ? "hls" : "iframe",
              url: options.nguoncEmbedUrl,
              priority: 6,
              isAvailable: true,
            },
          ];
        }
        return [];
      }

      const data = await res.json();
      const sources = (data.sources as ResolvedSource[]) || [];
      if (sources.length > 0) {
        streamResolveCache.set(cacheKey, {
          sources,
          expiresAt: now + CACHE_TTL_MS,
        });
      }
      return sources;
    } catch {
      if (options.knownHlsUrl && options.knownHlsUrl.includes(".m3u8")) {
        return [
          {
            sourceId: "kkphim",
            name: "KKPhim1 Direct HLS (Đã cắt QC)",
            displayName: "KKPhim1 Direct",
            type: "hls",
            url: `/api/hls-proxy?url=${encodeURIComponent(options.knownHlsUrl.trim())}&stripAds=1`,
            rawUrl: options.knownHlsUrl.trim(),
            priority: 5,
            isAvailable: true,
            adFree: true,
          },
        ];
      }
      if (options.nguoncEmbedUrl) {
        return [
          {
            sourceId: "nguonc",
            name: "Server Dự Phòng (StreamC)",
            displayName: "Server Dự Phòng",
            type: options.nguoncEmbedUrl.includes(".m3u8") ? "hls" : "iframe",
            url: options.nguoncEmbedUrl,
            priority: 6,
            isAvailable: true,
          },
        ];
      }
      return [];
    }
  }

  return resolveAllAvailableSourcesServer(options);
}
