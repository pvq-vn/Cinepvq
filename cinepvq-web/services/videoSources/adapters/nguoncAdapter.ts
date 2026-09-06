// ==============================================================================
// services/videoSources/adapters/nguoncAdapter.ts
// Final Fallback Video Source Adapter: NguonC / StreamC Iframe
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";

export class NguonCAdapter implements VideoSourceAdapter {
  readonly sourceId = "nguonc" as const;
  readonly name = "Server Dự Phòng (StreamC)";
  readonly priority = 4;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { nguoncEmbedUrl } = options;

    if (!nguoncEmbedUrl || typeof nguoncEmbedUrl !== "string") {
      return null;
    }

    const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(options.serverName || "");
    const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(options.serverName || "");

    return {
      sourceId: this.sourceId,
      name: this.name,
      displayName: isTM
        ? "Server Dự Phòng (Thuyết Minh)"
        : isLT
        ? "Server Dự Phòng (Lồng Tiếng)"
        : "Server Dự Phòng",
      type: "iframe",
      url: nguoncEmbedUrl,
      priority: this.priority,
      quality: "FHD",
      serverName: options.serverName ? `StreamC (${options.serverName})` : "StreamC Iframe",
      isAvailable: true,
    };
  }
}
