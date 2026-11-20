// ==============================================================================
// services/videoSources/adapters/chophimAdapter.ts
// Video Source Adapter: ChoPhim (https://chophim.wtf/)
// Parses SSR Next.js watch page `/xem/{slug}` to extract direct HLS streams
// and routes KK-hosted playlists through the automatic ad-stripper.
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";

const CHOPHIM_BASE = "https://chophim.wtf";
const TIMEOUT_MS = 3500;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

interface ChoPhimEpisodeItem {
  name?: string;
  slug?: string;
  link_m3u8?: string;
  link_embed?: string;
}

interface ChoPhimServerGroup {
  server_name: string;
  server_data: ChoPhimEpisodeItem[];
}

function unescapeRscChunk(raw: string): string {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function extractBalancedArray(str: string, startBracketIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startBracketIdx; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) return str.slice(startBracketIdx, i + 1);
      }
    }
  }
  return null;
}

function parseChoPhimServers(html: string): ChoPhimServerGroup[] {
  const groups: ChoPhimServerGroup[] = [];
  const seenServerNames = new Set<string>();

  // Unescape RSC serialized JSON segments
  const normalized = unescapeRscChunk(html);
  const re = /"server_name"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(normalized)) !== null) {
    const serverName = match[1].trim();
    if (!serverName || seenServerNames.has(serverName)) continue;

    const searchWindow = normalized.slice(match.index, match.index + 80000);
    const dataKeyIdx = searchWindow.indexOf('"server_data":[');
    if (dataKeyIdx === -1 || dataKeyIdx > 600) continue;

    const bracketStart = match.index + dataKeyIdx + '"server_data":'.length;
    const arrayText = extractBalancedArray(normalized, bracketStart);
    if (!arrayText) continue;

    try {
      const items = JSON.parse(arrayText) as ChoPhimEpisodeItem[];
      if (Array.isArray(items) && items.length > 0) {
        seenServerNames.add(serverName);
        groups.push({ server_name: serverName, server_data: items });
      }
    } catch {
      // Skip malformed chunk
    }
  }

  return groups;
}

export class ChoPhimAdapter implements VideoSourceAdapter {
  readonly sourceId = "chophim" as const;
  readonly name = "ChoPhim Direct HLS";
  readonly priority = 4;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, episode = 1, episodeSlug, serverName } = options;
    if (!slug) return null;

    const cleanSlug = slug.trim().toLowerCase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let html = "";
    try {
      const res = await fetch(`${CHOPHIM_BASE}/xem/${encodeURIComponent(cleanSlug)}`, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,*/*",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      html = await res.text();
    } catch {
      clearTimeout(timer);
      return null;
    }

    const groups = parseChoPhimServers(html);
    if (groups.length === 0) return null;

    const reqServer = (serverName || "").toLowerCase();
    const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(reqServer);
    const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(reqServer);
    const isVS = /vietsub/i.test(reqServer);

    let candidates = groups;
    if (isTM) {
      candidates = groups.filter((g) => /thuy[eế]t\s*minh|\btm\b/i.test(g.server_name));
      if (candidates.length === 0) return null;
    } else if (isLT) {
      candidates = groups.filter((g) => /l[oồ]ng\s*ti[eế]ng/i.test(g.server_name));
      if (candidates.length === 0) return null;
    } else if (isVS) {
      const vs = groups.filter(
        (g) =>
          /vietsub|song\s*ng[uữ]/i.test(g.server_name) ||
          !/thuy[eế]t\s*minh|\btm\b|l[oồ]ng\s*ti[eế]ng/i.test(g.server_name)
      );
      if (vs.length > 0) candidates = vs;
    }

    // Prefer direct public .m3u8 streams (non-session-locked) first
    for (const group of candidates) {
      const items = group.server_data || [];
      const ep = items.find((item) => {
        if (episodeSlug && item.slug?.toLowerCase() === episodeSlug.toLowerCase()) {
          return true;
        }
        const n = (item.name || "").toLowerCase();
        const s = (item.slug || "").toLowerCase();
        if ((n.includes("full") || s.includes("full") || items.length === 1) && episode === 1) {
          return true;
        }
        const num = parseInt(n.replace(/\D/g, ""), 10) || parseInt(s.replace(/\D/g, ""), 10) || 0;
        return num === episode;
      });

      if (!ep) continue;

      const rawM3u8 = ep.link_m3u8?.trim() || "";
      const rawEmbed = ep.link_embed?.trim() || "";

      // Extract inner .m3u8 if wrapped in player/?url=...
      let directM3u8 = rawM3u8.startsWith("http") && rawM3u8.includes(".m3u8") ? rawM3u8 : "";
      if (!directM3u8 && rawEmbed.includes("url=")) {
        try {
          const inner = new URL(rawEmbed).searchParams.get("url");
          if (inner && inner.includes(".m3u8")) directM3u8 = inner.trim();
        } catch {
          // ignore
        }
      }

      const gTM = /thuy[eế]t\s*minh|\btm\b/i.test(group.server_name);
      const gLT = /l[oồ]ng\s*ti[eế]ng/i.test(group.server_name);

      if (directM3u8) {
        return {
          sourceId: this.sourceId,
          name: "ChoPhim Direct HLS (Đã cắt QC)",
          displayName: gTM
            ? "ChoPhim (Thuyết Minh)"
            : gLT
            ? "ChoPhim (Lồng Tiếng)"
            : "ChoPhim Direct",
          type: "hls",
          url: `/api/hls-proxy?url=${encodeURIComponent(directM3u8)}&stripAds=1`,
          rawUrl: directM3u8,
          priority: this.priority,
          quality: "FHD",
          serverName: `ChoPhim • ${group.server_name}`,
          isAvailable: true,
          adFree: true,
        };
      }
    }

    return null;
  }
}
