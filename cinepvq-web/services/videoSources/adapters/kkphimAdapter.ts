// ==============================================================================
// services/videoSources/adapters/kkphimAdapter.ts
// Fallback 2 Video Source Adapter: KKPhim1 Direct HLS (.m3u8) / Embed
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";

const KKPHIM_BASE = "https://phimapi.com";
const TIMEOUT_MS = 4000;

interface KKPhimEpisodeItem {
  name: string;
  slug: string;
  link_m3u8?: string;
  link_embed?: string;
}

interface KKPhimEpisodeGroup {
  server_name: string;
  server_data: KKPhimEpisodeItem[];
}

interface KKPhimMovieData {
  status: boolean;
  movie?: {
    name: string;
    slug: string;
    quality?: string;
    year?: number;
    imdb?: { id?: string };
  };
  episodes?: KKPhimEpisodeGroup[];
}

export class KKPhimAdapter implements VideoSourceAdapter {
  readonly sourceId = "kkphim" as const;
  readonly name = "KKPhim1 Direct HLS (Dự Phòng 2)";
  readonly priority = 3;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, title, episode = 1 } = options;
    if (!slug && !title) return null;

    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    let movieData: KKPhimMovieData | null = null;

    // 1. Try direct slug lookup
    if (slug) {
      const cleanSlug = slug.trim().toLowerCase();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${KKPHIM_BASE}/phim/${cleanSlug}`, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data: KKPhimMovieData = await res.json();
          if (data.status && data.movie && data.episodes && data.episodes.length > 0) {
            movieData = data;
          }
        }
      } catch {
        clearTimeout(timer);
      }
    }

    // 2. Try title search if slug lookup didn't yield movie
    if (!movieData && title) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(
          `${KKPHIM_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(title.trim())}&limit=10`,
          { headers, signal: controller.signal }
        );
        clearTimeout(timer);
        if (res.ok) {
          const sData = await res.json();
          const items: Array<{ name: string; slug: string }> = sData.data?.items || [];
          if (items.length > 0) {
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

  // If targetTitle has no trailing number, test with season
  if (!/\d+$/.test(t)) {
    const seasonVariant = norm(`${targetTitle} ${season}`);
    if (parts.some((p) => p === seasonVariant)) return true;
  }
  return false;
}

            const matched =
              items.find((i) => i.slug === slug) ||
              items.find((i) => matchTitle(i.name || "", title, options.season || 1));

            if (matched) {
              const detailRes = await fetch(`${KKPHIM_BASE}/phim/${matched.slug}`, {
                headers,
              });
              if (detailRes.ok) {
                const d: KKPhimMovieData = await detailRes.json();
                if (d.status && d.movie && d.episodes && d.episodes.length > 0) {
                  movieData = d;
                }
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

    const reqServer = (options.serverName || "").toLowerCase();
    const isTM = /thuy[eế]t\s*minh|\btm\b/.test(reqServer);
    const isLT = /l[oồ]ng\s*ti[eế]ng/.test(reqServer);
    const isVS = /vietsub/.test(reqServer);

    // Sort episode groups to prioritize matching requested audio track
    const sortedGroups = [...movieData.episodes].sort((a, b) => {
      const aName = (a.server_name || "").toLowerCase();
      const bName = (b.server_name || "").toLowerCase();

      if (isTM) {
        const aMatch = /thuy[eế]t\s*minh|\btm\b/.test(aName);
        const bMatch = /thuy[eế]t\s*minh|\btm\b/.test(bName);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      } else if (isLT) {
        const aMatch = /l[oồ]ng\s*ti[eế]ng/.test(aName);
        const bMatch = /l[oồ]ng\s*ti[eế]ng/.test(bName);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      } else if (isVS) {
        const aMatch = /vietsub/.test(aName);
        const bMatch = /vietsub/.test(bName);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      return 0;
    });

    for (const group of sortedGroups) {
      const epItems = group.server_data || [];
      const ep = epItems.find((item) => {
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

      if (ep) {
        const groupIsTM = /thuy[eế]t\s*minh|\btm\b/i.test(group.server_name || "");
        const groupIsLT = /l[oồ]ng\s*ti[eế]ng/i.test(group.server_name || "");

        if (ep.link_m3u8 && ep.link_m3u8.includes(".m3u8")) {
          return {
            sourceId: this.sourceId,
            name: this.name,
            displayName: groupIsTM
              ? "KKPhim1 (Thuyết Minh)"
              : groupIsLT
              ? "KKPhim1 (Lồng Tiếng)"
              : "KKPhim1 Direct",
            type: "hls",
            url: ep.link_m3u8,
            priority: this.priority,
            quality: movieData.movie?.quality || "HD",
            serverName: group.server_name || "KKPhim Direct CDN",
            isAvailable: true,
          };
        } else if (ep.link_embed) {
          return {
            sourceId: this.sourceId,
            name: "KKPhim1 Embed (Dự Phòng 2)",
            displayName: groupIsTM
              ? "KKPhim1 Embed (Thuyết Minh)"
              : groupIsLT
              ? "KKPhim1 Embed (Lồng Tiếng)"
              : "KKPhim1 Embed",
            type: "iframe",
            url: ep.link_embed,
            priority: this.priority,
            quality: movieData.movie?.quality || "HD",
            serverName: group.server_name || "KKPhim Server",
            isAvailable: true,
          };
        }
      }
    }

    return null;
  }
}
