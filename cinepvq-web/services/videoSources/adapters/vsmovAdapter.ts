// ==============================================================================
// services/videoSources/adapters/vsmovAdapter.ts
// Fallback 1 Video Source Adapter: VSMOV Embed Iframe
// Enforces strict audio-track matching when Thuyết Minh / Lồng Tiếng is requested
// ==============================================================================

import type { VideoSourceAdapter, ResolveSourceOptions, ResolvedSource } from "../types";

const VSMOV_BASE = "https://vsmov.com/api";
const TIMEOUT_MS = 3000;

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

export class VsmovAdapter implements VideoSourceAdapter {
  readonly sourceId = "vsmov" as const;
  readonly name = "VSMOV Embed (Dự Phòng 1)";
  readonly priority = 2;

  async resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null> {
    const { slug, title, episode = 1 } = options;
    if (!slug && !title) return null;

    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    let movieData: VsmovMovieData | null = null;

    if (slug) {
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

    const reqServer = (options.serverName || "").toLowerCase();
    const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(reqServer);
    const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(reqServer);
    const isVS = /vietsub/i.test(reqServer);

    // Filter groups strictly when a specific translation is requested
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
        const hasM3u8 = Boolean(ep.link_m3u8 && ep.link_m3u8.includes(".m3u8"));

        return {
          sourceId: this.sourceId,
          name: hasM3u8 ? "VSMOV Direct HLS (Dự Phòng 1)" : this.name,
          displayName: groupIsTM
            ? "VSMOV (Thuyết Minh)"
            : groupIsLT
            ? "VSMOV (Lồng Tiếng)"
            : "VSMOV",
          type: hasM3u8 ? "hls" : "iframe",
          url: hasM3u8 ? ep.link_m3u8! : ep.link_embed!,
          priority: this.priority,
          quality: movieData.movie?.quality || "HD",
          serverName: group.server_name?.trim() || "VSMOV Server",
          isAvailable: true,
        };
      }
    }

    return null;
  }
}
