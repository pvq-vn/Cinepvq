// ==============================================================================
// services/videoSources/adapters/chophimAdapter.ts
// Video Source Adapter: ChoPhim (https://chophim.wtf/)
// Parses SSR Next.js watch page `/xem/{slug}` (with `/tim-kiem?keyword=...` fallback)
// to extract direct HLS streams, preferring independent non-KK servers when present.
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";
import { getSlugSourceHint, searchChoPhim } from "@/services/unifiedCatalog";

const CHOPHIM_BASE = "https://chophim.wtf";
const TIMEOUT_MS = 2800;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const resolvedSlugCache = new Map<string, { slug: string; expiresAt: number }>();
const parsedGroupsCache = new Map<string, { groups: ChoPhimServerGroup[]; expiresAt: number }>();

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
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function normalizeAsciiSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function fetchChoPhimWatchHtml(slug: string): Promise<{ html: string | null; blocked: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CHOPHIM_BASE}/xem/${encodeURIComponent(slug)}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        Referer: `${CHOPHIM_BASE}/`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 403) return { html: null, blocked: true };
    if (!res.ok) return { html: null, blocked: false };
    return { html: await res.text(), blocked: false };
  } catch {
    clearTimeout(timer);
    return { html: null, blocked: false };
  }
}

async function findChoPhimAlternateSlug(
  slug?: string,
  title?: string
): Promise<string | null> {
  const cacheKey = (slug || title || "").toLowerCase().trim();
  const cached = resolvedSlugCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }

  const query = (title || slug?.replace(/-/g, " ") || "").trim();
  if (!query) return null;

  const hits = await searchChoPhim(query);
  if (hits.length === 0) return null;

  const targetSlug = slug ? normalizeAsciiSlug(slug) : "";
  const titleSlug = title ? normalizeAsciiSlug(title) : "";

  const matched =
    hits.find((h) => targetSlug && normalizeAsciiSlug(h.slug) === targetSlug) ||
    hits.find((h) => titleSlug && normalizeAsciiSlug(h.name) === titleSlug) ||
    hits.find((h) => titleSlug && normalizeAsciiSlug(h.original_name || "") === titleSlug) ||
    hits.find(
      (h) =>
        (targetSlug &&
          (normalizeAsciiSlug(h.slug).startsWith(targetSlug) ||
            targetSlug.startsWith(normalizeAsciiSlug(h.slug)))) ||
        (titleSlug &&
          (normalizeAsciiSlug(h.name).startsWith(titleSlug) ||
            titleSlug.startsWith(normalizeAsciiSlug(h.name))))
    );

  if (!matched) return null;

  resolvedSlugCache.set(cacheKey, {
    slug: matched.slug,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });
  return matched.slug;
}

export class ChoPhimAdapter implements VideoSourceAdapter {
  readonly sourceId = "chophim" as const;
  readonly name = "ChoPhim Direct HLS";
  readonly priority = 4;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, title, episode = 1, episodeSlug, serverName, knownHlsUrl } = options;
    if (!slug && !title) return null;

    const hint = slug ? getSlugSourceHint(slug) : null;
    const primarySlug = (hint?.choPhimSlug || slug || "").trim().toLowerCase();
    const groupsCacheKey = primarySlug || (title || "").trim().toLowerCase();

    let groups: ChoPhimServerGroup[] = [];
    const cachedGroups = parsedGroupsCache.get(groupsCacheKey);
    if (cachedGroups && cachedGroups.expiresAt > Date.now()) {
      groups = cachedGroups.groups;
    } else {
      let blocked = false;
      if (primarySlug) {
        const res = await fetchChoPhimWatchHtml(primarySlug);
        blocked = res.blocked;
        if (res.html) groups = parseChoPhimServers(res.html);
      }

      // Fallback: search ChoPhim by title/slug when direct `/xem/{slug}` slug differs (skip if 403 Cloudflare blocked)!
      if (groups.length === 0 && !blocked) {
        const altSlug = await findChoPhimAlternateSlug(slug, title);
        if (altSlug && altSlug !== primarySlug) {
          const res = await fetchChoPhimWatchHtml(altSlug);
          if (res.html) groups = parseChoPhimServers(res.html);
        }
      }

      if (groups.length > 0) {
        if (parsedGroupsCache.size > 300) {
          const oldest = parsedGroupsCache.keys().next().value;
          if (oldest) parsedGroupsCache.delete(oldest);
        }
        parsedGroupsCache.set(groupsCacheKey, {
          groups,
          expiresAt: Date.now() + 15 * 60 * 1000,
        });
      }
    }

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

    // Prefer independent non-(KK) servers first (e.g., Song Ngữ, (O), (OP), (CP))
    const prioritizedCandidates = [...candidates].sort((a, b) => {
      const aIsKk = /\(kk\)/i.test(a.server_name) ? 1 : 0;
      const bIsKk = /\(kk\)/i.test(b.server_name) ? 1 : 0;
      return aIsKk - bIsKk;
    });

    let fallbackMatch: ResolvedSource | null = null;
    const knownTrimmed = (knownHlsUrl || "").trim();

    for (const group of prioritizedCandidates) {
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
        const resolved: ResolvedSource = {
          sourceId: this.sourceId,
          name: "ChoPhim Direct HLS (Đã cắt QC)",
          displayName: gTM
            ? "ChoPhim (Thuyết Minh)"
            : gLT
              ? "ChoPhim (Lồng Tiếng)"
              : "ChoPhim Direct",
          type: "hls",
          url: directM3u8,
          rawUrl: directM3u8,
          priority: this.priority,
          quality: "FHD",
          serverName: `ChoPhim • ${group.server_name}`,
          isAvailable: true,
          adFree: true,
        };

        // Return immediately if this stream is distinct from known KKPhim1 URL
        if (!knownTrimmed || directM3u8 !== knownTrimmed) {
          return resolved;
        }
        if (!fallbackMatch) {
          fallbackMatch = resolved;
        }
      }
    }

    return fallbackMatch;
  }
}
