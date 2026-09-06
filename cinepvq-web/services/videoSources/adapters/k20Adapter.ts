// ==============================================================================
// services/videoSources/adapters/k20Adapter.ts
// Primary Video Source Adapter: K20 Direct HLS (.m3u8 CDN)
// ==============================================================================

import { resolveK20StreamServer } from "@/services/k20Resolver";
import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";

export class K20Adapter implements VideoSourceAdapter {
  readonly sourceId = "k20" as const;
  readonly name = "K20 Direct HLS (Siêu mượt)";
  readonly priority = 1;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { imdbId, season = 1, episode = 1, type = "series", slug, serverName } = options;

    if (!imdbId && !slug) {
      return null;
    }

    try {
      const stream = await resolveK20StreamServer({
        imdbId,
        season,
        episode,
        type,
        slug,
        serverName,
      });

      if (!stream || !stream.url || !stream.url.includes(".m3u8")) {
        return null;
      }

      const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(serverName || "");
      const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(serverName || "");

      return {
        sourceId: this.sourceId,
        name: this.name,
        displayName: isTM
          ? "K20 Direct (Thuyết Minh)"
          : isLT
          ? "K20 Direct (Lồng Tiếng)"
          : "K20 Direct",
        type: "hls",
        url: stream.url,
        priority: this.priority,
        quality: "FHD",
        serverName: stream.title || stream.source || "K20 CDN",
        isAvailable: true,
      };
    } catch (err) {
      console.warn("[K20 Adapter] Error resolving stream:", err);
      return null;
    }
  }
}
