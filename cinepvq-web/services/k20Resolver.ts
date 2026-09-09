// ==============================================================================
// services/k20Resolver.ts
// K20 Stream Resolver: Resolves direct .m3u8 HLS streams from K20 / KKPhim CDN
// When called from the browser, routes through /api/k20/stream to bypass browser
// CORS restrictions on the sc.k-20.xyz JSON endpoint.
// The resulting .m3u8 and .ts segments are streamed DIRECTLY by the browser from CDN.
// ==============================================================================

export interface K20ResolveOptions {
  imdbId?: string;
  season?: number;
  episode?: number;
  type?: "movie" | "series";
  slug?: string;
  serverName?: string;
  episodeSlug?: string;
}

export interface ResolvedStream {
  type: "hls";
  url: string;
  source: string;
  title: string;
  name?: string;
}

const K20_BASE_URL = "https://sc.k-20.xyz";
const TIMEOUT_MS = 6000;

interface RawStream {
  name?: string;
  title?: string;
  url?: string;
  behaviorHints?: { notWebReady?: boolean };
}

function parseDirectStream(
  streams: RawStream[],
  episode: number,
  serverName?: string
): ResolvedStream | null {
  // If episode > 1, reject streams whose title or name explicitly declares a different episode (e.g. "Tập 01" when episode is 5)
  const isEpisodeMismatch = (str?: string) => {
    if (!str || episode <= 1) return false;
    const match = str.match(/t[ậa]p\s*0*(\d+)/i);
    if (match && match[1]) {
      const epNum = parseInt(match[1], 10);
      if (epNum > 0 && epNum !== episode) {
        return true;
      }
    }
    return false;
  };

  const validStreams = streams.filter(
    (s) => !isEpisodeMismatch(s.title) && !isEpisodeMismatch(s.name)
  );

  // Audio track targeting based on serverName
  const normServer = (serverName || "").toLowerCase();
  const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(normServer);
  const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(normServer);
  const isVS = /vietsub/i.test(normServer);

  // 1. If user requested Thuyết Minh, look specifically for Thuyết Minh / TM stream
  if (isTM) {
    const tmStream = validStreams.find(
      (s) =>
        s.url &&
        s.url.includes(".m3u8") &&
        (/thuy[eế]t\s*minh|\btm\b/i.test(s.title || "") ||
          /thuy[eế]t\s*minh|\btm\b/i.test(s.name || ""))
    );
    if (tmStream && tmStream.url) {
      return {
        type: "hls",
        url: tmStream.url,
        source: tmStream.name || "K20 Thuyết Minh",
        title: tmStream.title?.split("\n")[0] || `Tập ${episode} (Thuyết Minh)`,
        name: tmStream.name,
      };
    }
  }

  // 2. If user requested Lồng Tiếng, look specifically for Lồng Tiếng stream
  if (isLT) {
    const ltStream = validStreams.find(
      (s) =>
        s.url &&
        s.url.includes(".m3u8") &&
        (/l[oồ]ng\s*ti[eế]ng/i.test(s.title || "") ||
          /l[oồ]ng\s*ti[eế]ng/i.test(s.name || ""))
    );
    if (ltStream && ltStream.url) {
      return {
        type: "hls",
        url: ltStream.url,
        source: ltStream.name || "K20 Lồng Tiếng",
        title: ltStream.title?.split("\n")[0] || `Tập ${episode} (Lồng Tiếng)`,
        name: ltStream.name,
      };
    }
  }

  // 3. If user requested Vietsub, look specifically for Vietsub stream
  if (isVS) {
    const vsStream = validStreams.find(
      (s) =>
        s.url &&
        s.url.includes(".m3u8") &&
        (/vietsub/i.test(s.title || "") || /vietsub/i.test(s.name || ""))
    );
    if (vsStream && vsStream.url) {
      return {
        type: "hls",
        url: vsStream.url,
        source: vsStream.name || "KKPhim",
        title: vsStream.title?.split("\n")[0] || `Tập ${episode} (Vietsub)`,
        name: vsStream.name,
      };
    }
  }

  // 4. Default priority if no audio-specific stream matched or no serverName specified:
  // Prioritize KKPhim streams with Direct CDN & .m3u8
  const kkphimDirect = validStreams.find(
    (s) =>
      s.url &&
      s.url.includes(".m3u8") &&
      (s.name?.includes("KKPhim") || s.title?.includes("KKPhim")) &&
      (s.title?.includes("Direct CDN") || s.title?.includes("Vietsub"))
  );

  if (kkphimDirect && kkphimDirect.url) {
    return {
      type: "hls",
      url: kkphimDirect.url,
      source: "KKPhim",
      title: kkphimDirect.title?.split("\n")[0] || `Tập ${episode}`,
      name: kkphimDirect.name,
    };
  }

  // 5. Any KKPhim stream with .m3u8
  const kkphimAny = validStreams.find(
    (s) =>
      s.url &&
      s.url.includes(".m3u8") &&
      (s.name?.includes("KKPhim") || s.title?.includes("KKPhim"))
  );

  if (kkphimAny && kkphimAny.url) {
    return {
      type: "hls",
      url: kkphimAny.url,
      source: "KKPhim",
      title: kkphimAny.title?.split("\n")[0] || `Tập ${episode}`,
      name: kkphimAny.name,
    };
  }

  // 6. Fallback to any direct .m3u8 that is not an embed iframe
  const anyM3u8 = validStreams.find(
    (s) =>
      s.url &&
      s.url.includes(".m3u8") &&
      !s.url.includes("embed") &&
      !s.behaviorHints?.notWebReady
  );

  if (anyM3u8 && anyM3u8.url) {
    return {
      type: "hls",
      url: anyM3u8.url,
      source: anyM3u8.name || "Direct CDN",
      title: anyM3u8.title?.split("\n")[0] || `Tập ${episode}`,
      name: anyM3u8.name,
    };
  }

  return null;
}

/**
 * Server-side implementation: Queries K20 API directly.
 */
export async function resolveK20StreamServer(
  options: K20ResolveOptions
): Promise<ResolvedStream | null> {
  const { imdbId, season = 1, episode = 1, type = "series", slug } = options;

  if (!imdbId && !slug) {
    return null;
  }

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  // 1. Primary: Attempt K20 IMDb endpoint if IMDb ID is provided
  if (imdbId && typeof imdbId === "string" && imdbId.trim().startsWith("tt")) {
    const cleanImdb = imdbId.trim();
    const imdbEndpoints =
      type === "movie"
        ? [
            `${K20_BASE_URL}/stream/movie/${encodeURIComponent(cleanImdb)}.json`,
            ...(episode === 1
              ? [`${K20_BASE_URL}/stream/series/${cleanImdb}%3A${season}%3A1.json`]
              : []),
          ]
        : [
            `${K20_BASE_URL}/stream/series/${cleanImdb}%3A${season}%3A${episode}.json`,
            `${K20_BASE_URL}/stream/series/${cleanImdb}:${season}:${episode}.json`,
            ...(episode === 1
              ? [`${K20_BASE_URL}/stream/movie/${encodeURIComponent(cleanImdb)}.json`]
              : []),
          ];

    for (const endpoint of imdbEndpoints) {
      console.log("[K20 RESOLVER SERVER] Trying primary IMDb endpoint:", endpoint);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.streams) && data.streams.length > 0) {
            const stream = parseDirectStream(data.streams, episode, options.serverName);
            if (stream) {
              console.log("[K20 RESOLVER SERVER] Successfully resolved via IMDb endpoint:", stream.url);
              return stream;
            }
          }
        } else {
          console.warn(`[K20 RESOLVER SERVER] IMDb endpoint returned status ${res.status}`);
        }
      } catch (err: unknown) {
        clearTimeout(timer);
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("[K20 RESOLVER SERVER] IMDb endpoint fetch error:", err.message);
        }
      }
    }
  }

  // 2. Resilient Fallback: Query K20 direct provider endpoints on sc.k-20.xyz
  // When K20's Cinemeta worker throws Error 1101 on complex IMDb lookups,
  // K20's own direct KKPhim provider on sc.k-20.xyz serves the exact same Direct CDN stream.
  if (slug) {
    const cleanSlug = slug.trim().toLowerCase();
    const ep2Digit = String(episode).padStart(2, "0");
    const directEndpoints =
      type === "movie"
        ? [
            `${K20_BASE_URL}/stream/movie/kkphim:${cleanSlug}.json`,
            `${K20_BASE_URL}/stream/movie/nguonc:${cleanSlug}.json`,
            `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-01.json`,
            `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-1.json`,
            `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}.json`,
          ]
        : [
            ...(options.episodeSlug
              ? [`${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:${options.episodeSlug.trim().toLowerCase()}.json`]
              : []),
            `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-${ep2Digit}.json`,
            `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-${episode}.json`,
            ...(episode === 1
              ? [
                  `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}.json`,
                  `${K20_BASE_URL}/stream/movie/kkphim:${cleanSlug}.json`,
                ]
              : []),
          ];

    for (const endpoint of directEndpoints) {
      console.log("[K20 RESOLVER SERVER] Trying K20 direct provider endpoint:", endpoint);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.streams) && data.streams.length > 0) {
            const stream = parseDirectStream(data.streams, episode, options.serverName);
            if (stream) {
              console.log("[K20 RESOLVER SERVER] Successfully resolved via K20 direct provider:", stream.url);
              return stream;
            }
          }
        }
      } catch (err: unknown) {
        clearTimeout(timer);
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("[K20 RESOLVER SERVER] Direct endpoint fetch error:", err.message);
        }
      }
    }
  }

  return null;
}

/**
 * Universal resolver:
 * In client browser: calls /api/k20/stream to bypass browser CORS on sc.k-20.xyz.
 * On server: queries K20 directly.
 */
export async function resolveK20Stream(
  options: K20ResolveOptions
): Promise<ResolvedStream | null> {
  const { imdbId, season = 1, episode = 1, type = "series", slug, serverName } = options;

  if (!imdbId && !slug) {
    return null;
  }

  if (typeof window !== "undefined") {
    try {
      const cleanImdb = imdbId ? encodeURIComponent(imdbId.trim()) : "";
      const cleanSlug = slug ? encodeURIComponent(slug.trim()) : "";
      const cleanServer = serverName ? encodeURIComponent(serverName.trim()) : "";
      const apiUrl = `/api/k20/stream?imdbId=${cleanImdb}&season=${season}&episode=${episode}&type=${type}&slug=${cleanSlug}&serverName=${cleanServer}`;
      console.log("[K20 CLIENT RESOLVER] Requesting via internal API route:", apiUrl);
      const res = await fetch(apiUrl);
      if (!res.ok) {
        console.warn("[K20 CLIENT RESOLVER] API route returned error status:", res.status);
        return null;
      }
      const data = await res.json();
      console.log("[K20 CLIENT RESOLVER] API route returned:", data);
      return data.stream || null;
    } catch (err) {
      console.warn("[K20 CLIENT RESOLVER] Error calling internal API route:", err);
      return null;
    }
  }

  return resolveK20StreamServer(options);
}
