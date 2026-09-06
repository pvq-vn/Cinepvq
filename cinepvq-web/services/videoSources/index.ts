// ==============================================================================
// services/videoSources/index.ts
// Multi-Source Video Engine: Central Resolver & Orchestration
// Priority: 1. K20 -> 2. VSMOV -> 3. KKPhim1 -> 4. NguonC (StreamC)
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

/**
 * Server-side resolution: Queries all adapters in parallel,
 * filters valid streams, and sorts them by priority.
 */
export async function resolveAllAvailableSourcesServer(
  options: ResolveSourceOptions
): Promise<ResolvedSource[]> {
  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.resolveStream(options))
  );

  const resolved: ResolvedSource[] = [];

  for (const res of results) {
    if (res.status === "fulfilled" && res.value && res.value.url) {
      resolved.push(res.value);
    }
  }

  // Sort strictly by priority (1 = K20, 2 = VSMOV, 3 = KKPhim1, 4 = NguonC)
  resolved.sort((a, b) => a.priority - b.priority);

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
      if (options.serverName) params.set("serverName", options.serverName);
      if (options.episodeSlug) params.set("episodeSlug", options.episodeSlug);

      const res = await fetch(`/api/video-sources/resolve?${params.toString()}`);
      if (!res.ok) {
        console.warn("[Multi-Source Client] API returned error status:", res.status);
        // Fallback to NguonC embed if API route failed
        if (options.nguoncEmbedUrl) {
          return [
            {
              sourceId: "nguonc",
              name: "Server Dự Phòng (StreamC)",
              displayName: "Server Dự Phòng",
              type: "iframe",
              url: options.nguoncEmbedUrl,
              priority: 4,
              isAvailable: true,
            },
          ];
        }
        return [];
      }

      const data = await res.json();
      return (data.sources as ResolvedSource[]) || [];
    } catch (err) {
      console.warn("[Multi-Source Client] Error fetching sources:", err);
      if (options.nguoncEmbedUrl) {
        return [
          {
            sourceId: "nguonc",
            name: "Server Dự Phòng (StreamC)",
            displayName: "Server Dự Phòng",
            type: "iframe",
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
