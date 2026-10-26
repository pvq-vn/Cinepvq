// ==============================================================================
// services/videoSources/index.ts
// Multi-Source Video Engine: Central Resolver & Orchestration
// Priority: 1. K20 -> 2. VSMOV -> 3. KKPhim1 -> 4. NguonC (StreamC)
// Includes in-memory TTL cache for near-instant episode & server switching.
// ==============================================================================

import type {
  ResolvedSource,
  ResolveSourceOptions,
  VideoSourceAdapter,
} from "./types";
import { K20Adapter } from "./adapters/k20Adapter";
import { VsmovAdapter } from "./adapters/vsmovAdapter";
import { KKPhimAdapter } from "./adapters/kkphimAdapter";
import { NguonCAdapter } from "./adapters/nguoncAdapter";

export * from "./types";

const adapters: VideoSourceAdapter[] = [
  new K20Adapter(),
  new VsmovAdapter(),
  new KKPhimAdapter(),
  new NguonCAdapter(),
];

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

/**
 * Server-side resolution: Queries all adapters in parallel,
 * filters valid streams, deduplicates URLs, and sorts them by priority.
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
    adapters.map((adapter) => adapter.resolveStream(options))
  );

  const resolved: ResolvedSource[] = [];
  const seenUrls = new Set<string>();

  for (const res of results) {
    if (res.status === "fulfilled" && res.value && res.value.url) {
      const cleanUrl = res.value.url.trim();
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        resolved.push(res.value);
      }
    }
  }

  // Sort: prefer HLS sources first when priorities are close, otherwise strictly by priority
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
  options: ResolveSourceOptions
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

      const res = await fetch(`/api/video-sources/resolve?${params.toString()}`);
      if (!res.ok) {
        if (options.knownHlsUrl && options.knownHlsUrl.includes(".m3u8")) {
          return [
            {
              sourceId: "kkphim",
              name: "KKPhim1 Direct HLS",
              displayName: "KKPhim1 Direct",
              type: "hls",
              url: options.knownHlsUrl,
              priority: 3,
              isAvailable: true,
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
              priority: 4,
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
            name: "KKPhim1 Direct HLS",
            displayName: "KKPhim1 Direct",
            type: "hls",
            url: options.knownHlsUrl,
            priority: 3,
            isAvailable: true,
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
            priority: 4,
            isAvailable: true,
          },
        ];
      }
      return [];
    }
  }

  return resolveAllAvailableSourcesServer(options);
}
