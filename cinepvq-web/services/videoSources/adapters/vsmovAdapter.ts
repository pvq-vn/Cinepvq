// ==============================================================================
// services/videoSources/adapters/vsmovAdapter.ts
// Video Source Adapter: VSMOV Native HLS Extractor (with WebVTT Subtitles)
// Extracts real master.m3u8 + VTT subtitles from v8.streamvsmov.com embed HTML
// so both Web (CustomHlsPlayer) and Android (ExoPlayer + SmartHlsDataSource)
// play VSMOV natively with full controls instead of an iframe!
// ==============================================================================

import type {
  VideoSourceAdapter,
  ResolveSourceOptions,
  ResolvedSource,
  SubtitleTrack,
} from "../types";

const VSMOV_BASE = "https://vsmov.com/api";
const TIMEOUT_MS = 2800;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Cache movie episode directory per slug (15 min TTL) for near-instant episode switches
const vsmovMovieCache = new Map<string, { data: VsmovMovieData; expiresAt: number }>();

interface VsmovEpisodeItem {
  name: string;
  slug: string;
  link_embed?: string;
  link_m3u8?: string;
}

interface VsmovEpisodeGroup {
  server_name: string;
  server_data: VsmovEpisodeItem[];
}

interface VsmovMovieData {
  status: boolean;
  movie?: {
    name: string;
    slug: string;
    quality?: string;
    year?: number;
    imdb?: { id?: string };
  };
  episodes?: VsmovEpisodeGroup[];
}

function matchTitle(candidateName: string, targetTitle: string, season = 1): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[()\-:,._]/g, " ")
      .replace(/\b(phan|season)\s*(\d+)\b/g, (_m, _g1, g2) => ` ${g2} `)
      .replace(/\s+/g, " ")
      .trim();

  const t = norm(targetTitle);
  const parts = candidateName.split("/").map((p) => norm(p));
  if (parts.some((p) => p === t)) return true;

  if (!/\d+$/.test(t)) {
    const seasonVariant = norm(`${targetTitle} ${season}`);
    if (parts.some((p) => p === seasonVariant)) return true;
  }
  return false;
}

function labelForSubLang(code?: string, fallbackName?: string): string {
  const c = (code || fallbackName || "").toLowerCase();
  if (c.startsWith("vie") || c === "vi" || c.includes("viet")) return "Tiếng Việt";
  if (c.startsWith("eng") || c === "en" || c.includes("english")) return "English";
  if (c.startsWith("chi") || c.startsWith("zho") || c === "zh") return "中文";
  if (c.startsWith("kor") || c === "ko") return "한국어";
  if (c.startsWith("jpn") || c === "ja") return "日本語";
  return fallbackName || code || "Phụ đề";
}

/**
 * Extracts real master.m3u8 and WebVTT subtitle URLs directly from a VSMOV embed page.
 */
async function extractVsmovDirectHls(embedUrl: string): Promise<{
  masterUrl: string;
  subtitles: SubtitleTrack[];
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent": UA,
        Referer: "https://vsmov.com/",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const html = await res.text();
    const embedOrigin = new URL(embedUrl).origin;

    // 1. Check signedMasterUrl when enableSignedUrl is true
    let masterUrl = "";
    const enableSigned = /enableSignedUrl\s*:\s*true/i.test(html);
    const signedMatch = html.match(/signedMasterUrl\s*:\s*["']([^"']+)["']/);
    if (enableSigned && signedMatch?.[1]) {
      masterUrl = signedMatch[1].startsWith("http")
        ? signedMatch[1]
        : new URL(signedMatch[1], embedOrigin).toString();
    }

    // 2. Standard baseUrl + '/stream/' + videoHash + '/master.m3u8'
    if (!masterUrl) {
      const baseMatch = html.match(/const\s+baseUrl\s*=\s*["']([^"']+)["']/);
      const hashMatch = html.match(/const\s+videoHash\s*=\s*["']([^"']+)["']/);
      if (hashMatch?.[1]) {
        const base = (baseMatch?.[1] || embedOrigin).replace(/\/+$/, "");
        masterUrl = `${base}/stream/${hashMatch[1]}/master.m3u8`;
      }
    }

    // 3. Fallback direct m3u8 regex
    if (!masterUrl) {
      const directM = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (directM?.[0]) masterUrl = directM[0];
    }

    if (!masterUrl) return null;

    // 4. Parse WebVTT subtitles from playerOptions.subtitles
    const subtitles: SubtitleTrack[] = [];
    const subMatch = html.match(/subtitles\s*:\s*(\[[\s\S]*?\])\s*,/);
    if (subMatch?.[1]) {
      try {
        const parsedSubs = JSON.parse(subMatch[1]) as Array<{
          name?: string;
          url?: string;
          code?: string;
        }>;
        for (const s of parsedSubs) {
          if (!s.url) continue;
          const absSubUrl = s.url.startsWith("http")
            ? s.url
            : new URL(s.url, embedOrigin).toString();
          const langCode = (s.code || "vi").slice(0, 2).toLowerCase();
          subtitles.push({
            label: labelForSubLang(s.code, s.name),
            lang: langCode === "vi" || (s.code || "").startsWith("vie") ? "vi" : langCode,
            url: `/api/hls-proxy?url=${encodeURIComponent(absSubUrl)}&vtt=1&ref=${encodeURIComponent(embedUrl)}`,
            rawUrl: absSubUrl,
          });
        }
      } catch {
        // Ignore subtitle parse error
      }
    }

    return { masterUrl, subtitles };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export class VsmovAdapter implements VideoSourceAdapter {
  readonly sourceId = "vsmov" as const;
  readonly name = "VSMOV Native HLS (Có phụ đề)";
  readonly priority = 5;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, title, episode = 1 } = options;
    if (!slug && !title) return null;

    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
    };

    const cacheKey = (slug || title || "").trim().toLowerCase();
    let movieData: VsmovMovieData | null = null;
    const cachedMovie = vsmovMovieCache.get(cacheKey);
    if (cachedMovie && cachedMovie.expiresAt > Date.now()) {
      movieData = cachedMovie.data;
    }

    if (!movieData && slug) {
      const cleanSlug = slug.trim().toLowerCase();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${VSMOV_BASE}/phim/${cleanSlug}`, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data: VsmovMovieData = await res.json();
          if (data.status && data.movie && data.episodes && data.episodes.length > 0) {
            movieData = data;
          }
        }
      } catch {
        clearTimeout(timer);
      }
    }

    if (!movieData && title) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(
          `${VSMOV_BASE}/tim-kiem?keyword=${encodeURIComponent(title.trim())}`,
          { headers, signal: controller.signal }
        );
        clearTimeout(timer);
        if (res.ok) {
          const sData = await res.json();
          const items: Array<{ name: string; slug: string }> = sData.items || [];
          if (items.length > 0) {
            const matched =
              items.find((i) => i.slug === slug) ||
              items.find((i) => matchTitle(i.name || "", title, options.season || 1));

            if (matched) {
              const detailController = new AbortController();
              const detailTimer = setTimeout(() => detailController.abort(), TIMEOUT_MS);
              try {
                const detailRes = await fetch(`${VSMOV_BASE}/phim/${matched.slug}`, {
                  headers,
                  signal: detailController.signal,
                });
                clearTimeout(detailTimer);
                if (detailRes.ok) {
                  const d: VsmovMovieData = await detailRes.json();
                  if (d.status && d.movie && d.episodes && d.episodes.length > 0) {
                    movieData = d;
                  }
                }
              } catch {
                clearTimeout(detailTimer);
              }
            }
          }
        }
      } catch {
        clearTimeout(timer);
      }
    }

    if (!movieData || !movieData.episodes || movieData.episodes.length === 0) {
      return null;
    }

    if (!cachedMovie || cachedMovie.expiresAt <= Date.now()) {
      if (vsmovMovieCache.size > 300) {
        const oldest = vsmovMovieCache.keys().next().value;
        if (oldest) vsmovMovieCache.delete(oldest);
      }
      vsmovMovieCache.set(cacheKey, {
        data: movieData,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    }

    const reqServer = (options.serverName || "").toLowerCase();
    const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(reqServer);
    const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(reqServer);
    const isVS = /vietsub/i.test(reqServer);

    let candidateGroups = movieData.episodes;
    if (isTM) {
      candidateGroups = movieData.episodes.filter((g) =>
        /thuy[eế]t\s*minh|\btm\b/i.test(g.server_name || "")
      );
      if (candidateGroups.length === 0) return null;
    } else if (isLT) {
      candidateGroups = movieData.episodes.filter((g) =>
        /l[oồ]ng\s*ti[eế]ng/i.test(g.server_name || "")
      );
      if (candidateGroups.length === 0) return null;
    } else if (isVS) {
      const vsGroups = movieData.episodes.filter(
        (g) =>
          /vietsub/i.test(g.server_name || "") ||
          !/thuy[eế]t\s*minh|\btm\b|l[oồ]ng\s*ti[eế]ng/i.test(g.server_name || "")
      );
      if (vsGroups.length > 0) candidateGroups = vsGroups;
    }

    for (const group of candidateGroups) {
      const epItems = group.server_data || [];
      const ep = epItems.find((item) => {
        if (options.episodeSlug && item.slug.toLowerCase() === options.episodeSlug.toLowerCase()) {
          return true;
        }
        const isFull =
          item.name.toLowerCase().includes("full") ||
          item.slug.toLowerCase().includes("full");
        if ((isFull || epItems.length === 1) && episode === 1) {
          return true;
        }
        const num =
          parseInt(item.name.replace(/\D/g, "")) ||
          parseInt(item.slug.replace(/\D/g, "")) ||
          0;
        return num === episode;
      });

      if (ep && (ep.link_m3u8 || ep.link_embed)) {
        const groupIsTM = /thuy[eế]t\s*minh|\btm\b/i.test(group.server_name || "");
        const groupIsLT = /l[oồ]ng\s*ti[eế]ng/i.test(group.server_name || "");
        const displayName = groupIsTM
          ? "VSMOV (Thuyết Minh)"
          : groupIsLT
          ? "VSMOV (Lồng Tiếng)"
          : "VSMOV";

        // Case 1: API already gave direct .m3u8
        // v8.streamvsmov.com sends ACAO: * -> load master.m3u8 directly in browser & unwrap PNG client-side!
        if (ep.link_m3u8 && ep.link_m3u8.includes(".m3u8")) {
          const rawM3u8 = ep.link_m3u8.trim();
          return {
            sourceId: this.sourceId,
            name: this.name,
            displayName,
            type: "hls",
            url: rawM3u8,
            rawUrl: rawM3u8,
            priority: this.priority,
            quality: movieData.movie?.quality || "HD",
            serverName: group.server_name?.trim() || "VSMOV Server",
            isAvailable: true,
            stripPng: true,
            adFree: true,
          };
        }

        // Case 2: Extract real master.m3u8 + VTT subtitles from VSMOV embed page!
        // VSMOV master/edge CDN supports direct browser CORS (ACAO: *); unwrap PNG-TS client-side in PngUnwrapFragmentLoader.
        if (ep.link_embed) {
          const extracted = await extractVsmovDirectHls(ep.link_embed);
          if (extracted?.masterUrl) {
            return {
              sourceId: this.sourceId,
              name: this.name,
              displayName,
              type: "hls",
              url: extracted.masterUrl,
              rawUrl: extracted.masterUrl,
              priority: this.priority,
              quality: movieData.movie?.quality || "FHD",
              serverName: group.server_name?.trim() || "VSMOV Native",
              isAvailable: true,
              headers: {
                Referer: ep.link_embed,
                Origin: new URL(ep.link_embed).origin,
              },
              subtitles: extracted.subtitles,
              stripPng: true,
              adFree: true,
            };
          }

          // Graceful fallback to embed iframe only if direct extraction failed
          return {
            sourceId: this.sourceId,
            name: "VSMOV Embed",
            displayName,
            type: "iframe",
            url: ep.link_embed,
            rawUrl: ep.link_embed,
            priority: this.priority + 3,
            quality: movieData.movie?.quality || "HD",
            serverName: group.server_name?.trim() || "VSMOV Server",
            isAvailable: true,
          };
        }
      }
    }

    return null;
  }
}
