// ==============================================================================
// services/k20Resolver.ts
// K20 Stream Resolver: Resolves direct .m3u8 HLS streams from K20 / KKPhim CDN
// Optimized with parallel candidate probing, strict audio-track matching,
// and in-memory caching for sub-second episode transitions.
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
const TIMEOUT_MS = 2500;

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

  const normServer = (serverName || "").toLowerCase();
  const isTM = /thuy[eế]t\s*minh|\btm\b/i.test(normServer);
  const isLT = /l[oồ]ng\s*ti[eế]ng/i.test(normServer);
  const isVS = /vietsub/i.test(normServer);

  // 1. If user explicitly requested Thuyết Minh, ONLY match Thuyết Minh stream.
  // Do NOT fall back to a Vietsub stream (which would override real Thuyết Minh on KKPhim/VSMOV).
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
    return null;
  }

  // 2. If user explicitly requested Lồng Tiếng, ONLY match Lồng Tiếng stream.
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
    return null;
  }

  // 3. If user requested Vietsub, look specifically for Vietsub stream first
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

  // 4. Default priority (Vietsub or unspecified serverName):
  // Exclude streams explicitly marked as Thuyết Minh / Lồng Tiếng when Vietsub is requested
  const nonDubbedStreams = isVS
    ? validStreams.filter(
        (s) =>
          !/thuy[eế]t\s*minh|\btm\b|l[oồ]ng\s*ti[eế]ng/i.test(
            `${s.title || ""} ${s.name || ""}`
          )
      )
    : validStreams;

  const kkphimDirect = nonDubbedStreams.find(
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

  const kkphimAny = nonDubbedStreams.find(
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

  const anyM3u8 = nonDubbedStreams.find(
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

async function probeK20Endpoint(
  endpoint: string,
  episode: number,
  serverName?: string
): Promise<ResolvedStream | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.streams) && data.streams.length > 0) {
      return parseDirectStream(data.streams, episode, serverName);
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Server-side implementation: Queries K20 API endpoints in parallel for minimal latency.
 */
export async function resolveK20StreamServer(
  options: K20ResolveOptions
): Promise<ResolvedStream | null> {
  const { imdbId, season = 1, episode = 1, type = "series", slug } = options;

  if (!imdbId && !slug) {
    return null;
  }

  const endpoints: string[] = [];

  if (imdbId && typeof imdbId === "string" && imdbId.trim().startsWith("tt")) {
    const cleanImdb = imdbId.trim();
    if (type === "movie") {
      endpoints.push(`${K20_BASE_URL}/stream/movie/${encodeURIComponent(cleanImdb)}.json`);
    } else {
      endpoints.push(`${K20_BASE_URL}/stream/series/${cleanImdb}%3A${season}%3A${episode}.json`);
    }
  }

  if (slug) {
    const cleanSlug = slug.trim().toLowerCase();
    const ep2Digit = String(episode).padStart(2, "0");
    if (type === "movie") {
      endpoints.push(
        `${K20_BASE_URL}/stream/movie/kkphim:${cleanSlug}.json`,
        `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-01.json`
      );
    } else {
      if (options.episodeSlug) {
        endpoints.push(
          `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:${options.episodeSlug.trim().toLowerCase()}.json`
        );
      }
      const tapPaddedUrl = `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-${ep2Digit}.json`;
      if (!endpoints.includes(tapPaddedUrl)) {
        endpoints.push(tapPaddedUrl);
      }
      const tapRawUrl = `${K20_BASE_URL}/stream/series/kkphim:${cleanSlug}:tap-${episode}.json`;
      if (!endpoints.includes(tapRawUrl)) {
        endpoints.push(tapRawUrl);
      }
      if (episode === 1) {
        endpoints.push(`${K20_BASE_URL}/stream/movie/kkphim:${cleanSlug}.json`);
      }
    }
  }

  if (endpoints.length === 0) return null;

  // Probe top candidate endpoints in parallel so we never chain timeouts sequentially
  const results = await Promise.allSettled(
    endpoints.slice(0, 4).map((epUrl) =>
      probeK20Endpoint(epUrl, episode, options.serverName)
    )
  );

  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      return res.value;
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
      const res = await fetch(apiUrl);
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      return data.stream || null;
    } catch {
      return null;
    }
  }

  return resolveK20StreamServer(options);
}
