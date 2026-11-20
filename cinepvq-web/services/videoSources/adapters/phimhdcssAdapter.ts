// ==============================================================================
// services/videoSources/adapters/phimhdcssAdapter.ts
// Video Source Adapter: PhimHDCSS (https://phimhdcss.com/)
// Searches & parses PhimHDCSS watch pages, decodes realObj server map,
// and extracts FHDC (tiktok.phimhdc.com ByteImg CDN) direct HLS manifests
// (with HD direct m3u8 fallback).
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";
import { getSlugSourceHint } from "@/services/unifiedCatalog";

const PHIMHDCSS_BASE = "https://phimhdcss.com";
const TIMEOUT_MS = 2800;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Cache slug -> PhimHDCSS detail URL and detail URL -> episode links for sub-second episode switches
const detailUrlCache = new Map<string, { url: string; expiresAt: number }>();
const detailEpisodesCache = new Map<string, { epLinks: string[]; expiresAt: number }>();

async function fetchHtmlSafe(url: string, referer?: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        ...(referer ? { Referer: referer } : {}),
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findPhimHdcssDetailUrl(
  slug?: string,
  title?: string
): Promise<string | null> {
  if (slug) {
    const hint = getSlugSourceHint(slug);
    if (hint?.phimHdcssUrl) return hint.phimHdcssUrl;
  }

  const cacheKey = (slug || title || "").toLowerCase();
  const cached = detailUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const query = (title || slug?.replace(/-/g, " ") || "").trim();
  if (!query) return null;

  const html = await fetchHtmlSafe(
    `${PHIMHDCSS_BASE}/?search=${encodeURIComponent(query)}`
  );
  if (!html) return null;

  const matches = [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/phimhdcss\.com\/([a-z0-9-]+)-(\d+))"/gi)].map(
        (m) => ({ url: m[1], linkSlug: m[2].toLowerCase() })
      )
    ),
  ];

  if (matches.length === 0) return null;

  const targetSlug = slug ? normalizeSlug(slug) : "";
  const titleSlug = title ? normalizeSlug(title) : "";

  // Preserve season consistency (don't match Season 1 when Season 2 is requested)
  const extractSeasonNum = (s: string): string | null => {
    const m = s.match(/(?:phan|season|mua)-(\d+)$/i);
    return m ? m[1] : null;
  };
  const targetSeason = extractSeasonNum(targetSlug) || extractSeasonNum(titleSlug);
  const seasonCompatible = (candSlug: string): boolean => {
    const candSeason = extractSeasonNum(candSlug);
    if (targetSeason && candSeason && targetSeason !== candSeason) return false;
    if (targetSeason && !candSeason && targetSeason !== "1") return false;
    return true;
  };

  const compatible = matches.filter((m) => seasonCompatible(m.linkSlug));
  const pool = compatible.length > 0 ? compatible : matches;

  const exact =
    pool.find((m) => targetSlug && m.linkSlug === targetSlug) ||
    pool.find((m) => titleSlug && m.linkSlug === titleSlug) ||
    pool.find(
      (m) =>
        (targetSlug && (m.linkSlug.startsWith(targetSlug) || targetSlug.startsWith(m.linkSlug))) ||
        (titleSlug && (m.linkSlug.startsWith(titleSlug) || titleSlug.startsWith(m.linkSlug)))
    );

  if (!exact) return null;

  detailUrlCache.set(cacheKey, {
    url: exact.url,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });
  return exact.url;
}

function decodeRealServerMap(watchHtml: string): Array<{
  id: string;
  label: string;
  url: string;
}> {
  const saltMatch = watchHtml.match(/const\s+_0xS\s*=\s*"([^"]+)"/);
  const realMatch = watchHtml.match(/var\s+realObj\s*=\s*JSON\.parse\(atob\("([^"]+)"\)\)/);
  if (!saltMatch?.[1] || !realMatch?.[1]) return [];

  const salt = saltMatch[1];
  const results: Array<{ id: string; label: string; url: string }> = [];

  try {
    const realObj = JSON.parse(
      Buffer.from(realMatch[1], "base64").toString("utf8")
    ) as Record<string, string[]>;

    for (const [id, chunks] of Object.entries(realObj)) {
      if (!Array.isArray(chunks)) continue;
      const reversed = chunks.join("").split("").reverse().join("").replace(salt, "");
      const decodedUrl = Buffer.from(reversed, "base64").toString("utf8").trim();
      if (!decodedUrl.startsWith("http")) continue;

      const btnMatch = watchHtml.match(
        new RegExp(`id="server-${id}"[^>]*>([\\s\\S]{0,80})</a>`, "i")
      );
      const label = (btnMatch?.[1] || "").replace(/<[^>]+>/g, "").trim() || "HD";
      results.push({ id, label, url: decodedUrl });
    }
  } catch {
    return [];
  }

  return results;
}

export class PhimHdcssAdapter implements VideoSourceAdapter {
  readonly sourceId = "phimhdcss" as const;
  readonly name = "PhimHDCSS Direct HLS (TikTok CDN)";
  readonly priority = 2;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, title, episode = 1, serverName } = options;
    if (!slug && !title) return null;

    // PhimHDCSS streams are primarily Vietsub; skip if user strictly requested Thuyết Minh / Lồng Tiếng
    const reqServer = (serverName || "").toLowerCase();
    const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(reqServer);
    const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(reqServer);
    if (isTM || isLT) return null;

    const detailUrl = await findPhimHdcssDetailUrl(slug, title);
    if (!detailUrl) return null;

    let epLinks: string[] = [];
    const cachedEps = detailEpisodesCache.get(detailUrl);
    if (cachedEps && cachedEps.expiresAt > Date.now()) {
      epLinks = cachedEps.epLinks;
    } else {
      const detailHtml = await fetchHtmlSafe(detailUrl, PHIMHDCSS_BASE);
      if (!detailHtml) return null;

      // Extract episode URLs from detail page (format: https://phimhdcss.com/{slug}/tap-{n}-{epId} or /full-{epId})
      epLinks = [
        ...new Set(
          [
            ...detailHtml.matchAll(
              /href="(https:\/\/phimhdcss\.com\/[a-z0-9-]+\/(?:tap-[^"'\s]+|full[^"'\s]*))"/gi
            ),
          ].map((m) => m[1])
        ),
      ];
      if (epLinks.length > 0) {
        if (detailEpisodesCache.size > 300) {
          const oldest = detailEpisodesCache.keys().next().value;
          if (oldest) detailEpisodesCache.delete(oldest);
        }
        detailEpisodesCache.set(detailUrl, {
          epLinks,
          expiresAt: Date.now() + 30 * 60 * 1000,
        });
      }
    }

    if (epLinks.length === 0) return null;

    const matchedEpUrl =
      epLinks.find((u) => new RegExp(`/tap-0*${episode}-\\d+$`, "i").test(u)) ||
      (episode === 1
        ? epLinks.find((u) => /\/(?:full|tap-0*1)(?:-\d+)?$/i.test(u)) || epLinks[0]
        : null);

    if (!matchedEpUrl) return null;

    const watchHtml = await fetchHtmlSafe(matchedEpUrl, detailUrl);
    if (!watchHtml) return null;

    const decodedServers = decodeRealServerMap(watchHtml);
    if (decodedServers.length === 0) return null;

    // Priority 1: FHDC (tiktok.phimhdc.com/embed/... -> ultra-fast ByteImg CDN HLS!)
    // Return immediately without extra 4th probe hop; /api/hls-proxy extracts & caches manifest on load.
    const fhdc = decodedServers.find(
      (s) =>
        s.url.includes("tiktok.phimhdc.com/embed/") ||
        (s.label.toUpperCase().startsWith("FHDC") && s.url.includes("phimhdc"))
    );
    if (fhdc) {
      return {
        sourceId: this.sourceId,
        name: "PhimHDCSS FHDC (Siêu nhanh • Không QC)",
        displayName: "PhimHDCSS (FHDC)",
        type: "hls",
        url: `/api/hls-proxy?phimhdcssEmbed=${encodeURIComponent(fhdc.url)}`,
        rawUrl: fhdc.url,
        priority: this.priority,
        quality: "FHD",
        serverName: "PhimHDCSS • FHDC",
        isAvailable: true,
        headers: { Referer: `${PHIMHDCSS_BASE}/` },
        stripPng: true,
        adFree: true,
      };
    }

    // Priority 2: HD server wrapping a direct .m3u8 link (`phimhdc.com/player.php?link=...m3u8`)
    const hdServer = decodedServers.find(
      (s) => s.url.includes(".m3u8") && !s.url.includes("streamxemphimhd")
    );
    if (hdServer) {
      let directM3u8 = hdServer.url;
      if (directM3u8.includes("link=")) {
        try {
          const inner = new URL(directM3u8).searchParams.get("link");
          if (inner && inner.includes(".m3u8")) directM3u8 = inner.trim();
        } catch {
          // ignore
        }
      }
      if (directM3u8.includes(".m3u8")) {
        return {
          sourceId: this.sourceId,
          name: "PhimHDCSS Direct HLS (Đã cắt QC)",
          displayName: "PhimHDCSS (HD)",
          type: "hls",
          url: `/api/hls-proxy?url=${encodeURIComponent(directM3u8)}&stripAds=1`,
          rawUrl: directM3u8,
          priority: this.priority,
          quality: "FHD",
          serverName: `PhimHDCSS • ${hdServer.label}`,
          isAvailable: true,
          adFree: true,
        };
      }
    }

    return null;
  }
}
