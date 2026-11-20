// ==============================================================================
// services/videoSources/adapters/nguoncAdapter.ts
// Final Fallback Video Source Adapter: NguonC / StreamC
// Supports both direct NguonC API lookup and passed fallback embed URLs
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";

const NGUONC_BASE = "https://phim.nguonc.com/api";
const TIMEOUT_MS = 2200;

type NguonCServerGroup = {
  server_name?: string;
  items?: Array<{ name?: string; slug?: string; embed?: string; m3u8?: string }>;
};

const nguoncServersCache = new Map<string, { servers: NguonCServerGroup[]; expiresAt: number }>();

export class NguonCAdapter implements VideoSourceAdapter {
  readonly sourceId = "nguonc" as const;
  readonly name = "Server Dự Phòng (StreamC)";
  readonly priority = 6;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, episode = 1, episodeSlug, serverName, nguoncEmbedUrl } = options;

    const reqServer = (serverName || "").toLowerCase();
    const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(reqServer);
    const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(reqServer);
    const isVS = /vietsub/i.test(reqServer);

    // 1. Try real NguonC API lookup by slug (with 15m cache for instant episode switches)
    if (slug) {
      const cleanSlug = slug.trim().toLowerCase();
      let servers: NguonCServerGroup[] = [];
      const cached = nguoncServersCache.get(cleanSlug);
      if (cached && cached.expiresAt > Date.now()) {
        servers = cached.servers;
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(`${NGUONC_BASE}/film/${encodeURIComponent(cleanSlug)}`, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            servers = (data?.movie?.episodes as NguonCServerGroup[]) || [];
            if (servers.length > 0) {
              if (nguoncServersCache.size > 300) {
                const oldest = nguoncServersCache.keys().next().value;
                if (oldest) nguoncServersCache.delete(oldest);
              }
              nguoncServersCache.set(cleanSlug, {
                servers,
                expiresAt: Date.now() + 15 * 60 * 1000,
              });
            }
          }
        } catch {
          clearTimeout(timer);
        }
      }

      if (servers.length > 0) {
            let candidateGroups = servers;
            if (isTM) {
              candidateGroups = servers.filter((g) =>
                /thuy[eế]t\s*minh|\btm\b/i.test(g.server_name || "")
              );
            } else if (isLT) {
              candidateGroups = servers.filter((g) =>
                /l[oồ]ng\s*ti[eế]ng/i.test(g.server_name || "")
              );
            } else if (isVS) {
              const vs = servers.filter(
                (g) =>
                  /vietsub/i.test(g.server_name || "") ||
                  !/thuy[eế]t\s*minh|\btm\b|l[oồ]ng\s*ti[eế]ng/i.test(g.server_name || "")
              );
              if (vs.length > 0) candidateGroups = vs;
            }

            for (const group of candidateGroups) {
              const items = group.items || [];
              const ep = items.find((item) => {
                if (episodeSlug && item.slug?.toLowerCase() === episodeSlug.toLowerCase()) {
                  return true;
                }
                const isFull =
                  (item.name || "").toLowerCase().includes("full") ||
                  (item.slug || "").toLowerCase().includes("full");
                if ((isFull || items.length === 1) && episode === 1) {
                  return true;
                }
                const num =
                  parseInt((item.name || "").replace(/\D/g, "")) ||
                  parseInt((item.slug || "").replace(/\D/g, "")) ||
                  0;
                return num === episode;
              });

              const streamUrl = ep?.m3u8 || ep?.embed;
              if (streamUrl) {
                const isHls = streamUrl.includes(".m3u8");
                return {
                  sourceId: this.sourceId,
                  name: this.name,
                  displayName: isTM
                    ? "StreamC (Thuyết Minh)"
                    : isLT
                    ? "StreamC (Lồng Tiếng)"
                    : "Server Dự Phòng (StreamC)",
                  type: isHls ? "hls" : "iframe",
                  url: streamUrl,
                  priority: this.priority,
                  quality: "FHD",
                  serverName: group.server_name || "StreamC",
                  isAvailable: true,
                };
              }
            }
          }
    }

    // 2. Fallback to passed embed URL if present
    if (!nguoncEmbedUrl || typeof nguoncEmbedUrl !== "string") {
      return null;
    }

    const isHlsUrl = nguoncEmbedUrl.includes(".m3u8");

    return {
      sourceId: this.sourceId,
      name: this.name,
      displayName: isTM
        ? "Server Dự Phòng (Thuyết Minh)"
        : isLT
        ? "Server Dự Phòng (Lồng Tiếng)"
        : "Server Dự Phòng",
      type: isHlsUrl ? "hls" : "iframe",
      url: nguoncEmbedUrl,
      priority: this.priority,
      quality: "FHD",
      serverName: serverName ? `StreamC (${serverName})` : "StreamC",
      isAvailable: true,
    };
  }
}
