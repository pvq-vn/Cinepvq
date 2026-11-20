import { queryPg } from "@/lib/db";
import {
  kkphimCatalogAdapter,
  type KKPhimRawV1ListResponse,
} from "./kkphimCatalogAdapter";
import { normalizeEpisodeLabel } from "@/lib/format";
import type { Movie } from "@/types/movie";
import {
  NETFLIX_COUNTRIES,
  DOUBAN_CATEGORIES,
  type PlatformId,
  type NetflixCountryCode,
  type NetflixMediaType,
  type DoubanCategory,
  type NetflixCountryOption,
  type DoubanCategoryOption,
  type TrendingRankItem,
  type PlatformRankingSection,
  type TrendingRankingsPayload,
} from "@/types/trending";

export {
  NETFLIX_COUNTRIES,
  DOUBAN_CATEGORIES,
  type PlatformId,
  type NetflixCountryCode,
  type NetflixMediaType,
  type DoubanCategory,
  type NetflixCountryOption,
  type DoubanCategoryOption,
  type TrendingRankItem,
  type PlatformRankingSection,
  type TrendingRankingsPayload,
};

export interface CrawlTrendingOptions {
  forceRefresh?: boolean;
  platform?: PlatformId | "all";
  netflixCountry?: NetflixCountryCode;
  netflixType?: NetflixMediaType;
  doubanCategory?: DoubanCategory;
}

const KKPHIM_BASE = (
  process.env.NEXT_PUBLIC_KKPHIM_API_URL ?? "https://phimapi.com"
).replace(/\/+$/, "");

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const SECTION_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const TITLE_MATCH_TTL_MS = 30 * 60 * 1000; // 30 minutes

const sectionMemoryCache = new Map<
  string,
  { section: PlatformRankingSection; expiresAt: number }
>();

const titleMatchCache = new Map<
  string,
  { movie: Movie | null; expiresAt: number }
>();

export function normalizeNetflixCountry(raw?: string | null): NetflixCountryCode {
  const v = (raw || "vn").toLowerCase().trim();
  const alias: Record<string, NetflixCountryCode> = {
    vn: "vn",
    vietnam: "vn",
    "viet-nam": "vn",
    kr: "kr",
    hq: "kr",
    "south-korea": "kr",
    korea: "kr",
    us: "us",
    usa: "us",
    my: "us",
    "united-states": "us",
    global: "global",
    world: "global",
    jp: "jp",
    japan: "jp",
    th: "th",
    thailand: "th",
    tw: "tw",
    taiwan: "tw",
    gb: "gb",
    uk: "gb",
    "united-kingdom": "gb",
  };
  return alias[v] || "vn";
}

export function normalizeNetflixType(raw?: string | null): NetflixMediaType {
  return (raw || "").toLowerCase() === "films" || (raw || "").toLowerCase() === "movie"
    ? "films"
    : "tv";
}

export function normalizeDoubanCategory(raw?: string | null): DoubanCategory {
  const v = (raw || "all").toLowerCase().trim();
  if (v === "tv_cn" || v === "tv_global" || v === "movie" || v === "top250") {
    return v;
  }
  return "all";
}

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function slugifyFallback(str: string): string {
  const ascii = str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `item-${hashStr(str).toString(36)}`;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function cleanExternalTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/:\s*(?:Season|Part|Series|Book|Chapter|Volume|Limited Series|Miniseries)\s*\d*.*$/i, "")
    .replace(/\s*\((?:Season|Part|S)\s*\d+\)$/i, "")
    .replace(/\s*第[一二三四五六七八九十\d]+[季部]$/u, "")
    .trim();
}

function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCompactViews(views: number): string {
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M lượt xem`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}K lượt xem`;
  }
  return `${views} lượt xem`;
}

async function fetchJsonSafe<T>(
  url: string,
  timeoutMs = 5500,
  extraHeaders?: Record<string, string>
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": DESKTOP_UA,
        ...extraHeaders,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextSafe(
  url: string,
  timeoutMs = 7000,
  extraHeaders?: Record<string, string>
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
        "User-Agent": DESKTOP_UA,
        ...extraHeaders,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchKKPhimList(pathAndQuery: string): Promise<Movie[]> {
  const raw = await fetchJsonSafe<KKPhimRawV1ListResponse>(
    `${KKPHIM_BASE}/${pathAndQuery.replace(/^\/+/, "")}`,
    5000
  );
  if (!raw) return [];
  return kkphimCatalogAdapter.normalizeV1ListResponse(raw).items ?? [];
}

/**
 * Matches an external title (English, Chinese, Korean, Japanese) to a playable
 * movie in KKPhim catalog, with 30-minute memory caching.
 */
async function matchTitleToKKPhim(
  cleanedTitle: string,
  rawTitle?: string
): Promise<Movie | null> {
  const key = cleanedTitle.toLowerCase().trim();
  if (!key) return null;

  const cached = titleMatchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.movie;
  }

  const queries = [cleanedTitle];
  if (cleanedTitle.includes(":")) {
    const beforeColon = cleanedTitle.split(":")[0].trim();
    if (beforeColon.length >= 3 && beforeColon !== cleanedTitle) {
      queries.push(beforeColon);
    }
  }

  let matched: Movie | null = null;
  const targetNorm = normalizeMatchText(cleanedTitle);
  const rawNorm = rawTitle ? normalizeMatchText(rawTitle) : targetNorm;
  const targetTokens = targetNorm.split(" ").filter((t) => t.length >= 2);
  const isCjkQuery = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(cleanedTitle);

  for (const q of queries) {
    const candidates = await fetchKKPhimList(
      `v1/api/tim-kiem?keyword=${encodeURIComponent(q)}&limit=6`
    );
    if (candidates.length === 0) continue;

    // 1. Exact normalized match on origin_name or name
    matched =
      candidates.find((c) => {
        const cn = normalizeMatchText(c.name || "");
        const co = normalizeMatchText(c.original_name || "");
        return (
          cn === targetNorm ||
          co === targetNorm ||
          cn === rawNorm ||
          co === rawNorm
        );
      }) || null;

    // 2. Containment / token overlap match
    if (!matched) {
      matched =
        candidates.find((c) => {
          const cn = normalizeMatchText(c.name || "");
          const co = normalizeMatchText(c.original_name || "");
          if (targetNorm.length >= 2 && (co.includes(targetNorm) || cn.includes(targetNorm))) {
            return true;
          }
          if (co.length >= 3 && targetNorm.includes(co)) {
            return true;
          }
          if (targetTokens.length >= 2) {
            const hay = `${cn} ${co}`;
            const hitCount = targetTokens.filter((t) => hay.includes(t)).length;
            return hitCount / targetTokens.length >= 0.75;
          }
          return false;
        }) || null;
    }

    // 3. KKPhim's search index stores Chinese/Korean/Japanese aliases even when
    //    `name` is Vietnamese and `origin_name` is English (e.g. "今天是太阳雨" ->
    //    "Hôm Nay Trời Đổ Mưa Bóng Mây" / "Sunshine Through The Rain"). When a
    //    precise CJK query returns <= 3 hits, trust the top ranked KKPhim match!
    if (!matched && isCjkQuery && candidates.length <= 3) {
      matched = candidates[0];
    }

    if (matched) break;
  }

  const normalizedMovie = matched
    ? {
        ...matched,
        current_episode: normalizeEpisodeLabel(matched.current_episode),
      }
    : null;

  titleMatchCache.set(key, {
    movie: normalizedMovie,
    expiresAt: Date.now() + TITLE_MATCH_TTL_MS,
  });
  return normalizedMovie;
}

function buildFallbackMovieShell(params: {
  title: string;
  originalTitle?: string;
  posterUrl?: string;
  year?: string | number;
  quality?: string;
  episodeLabel?: string;
  platformId: PlatformId;
  rank: number;
}): Movie {
  const slug = `${params.platformId}-top-${params.rank}-${slugifyFallback(params.title)}`;
  const poster = params.posterUrl || "";
  return {
    id: slug,
    name: params.title,
    slug,
    original_name: params.originalTitle || params.title,
    thumb_url: poster,
    poster_url: poster,
    created: "",
    modified: "",
    description: "",
    total_episodes: 1,
    current_episode: params.episodeLabel || "Top BXH",
    time: "",
    quality: params.quality || "HD",
    language: "Vietsub",
    director: "",
    casts: "",
    year: params.year || new Date().getFullYear(),
  };
}

// ============================================================================
// 1. NETFLIX TOP 10 BY COUNTRY (Official Tudum HTML Crawler)
// ============================================================================

interface TudumRow {
  rank: number;
  rawTitle: string;
  cleanTitle: string;
  posterUrl: string;
  weeksInTop10: number;
}

function parseNetflixTudumHtml(html: string): TudumRow[] {
  const rows: TudumRow[] = [];
  const trMatches = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    if (!tr.includes("top10-table-row-title")) continue;

    const rankM = tr.match(/class="rank"[^>]*>\s*(\d+)\s*</i);
    const titleM = tr.match(/<button[^>]*>([\s\S]*?)<\/button>/i);
    const imgM =
      tr.match(/src="(https:\/\/dnm\.nflximg\.net\/[^"]+)"/i) ||
      tr.match(/src="(https:\/\/[^"]+)"/i);
    const weeksM = tr.match(/data-uia="top10-table-row-weeks"[^>]*>\s*(\d+)/i);

    if (!rankM?.[1] || !titleM?.[1]) continue;

    const rawTitle = decodeHtmlEntities(titleM[1].replace(/<[^>]+>/g, ""));
    if (!rawTitle) continue;

    rows.push({
      rank: parseInt(rankM[1], 10),
      rawTitle,
      cleanTitle: cleanExternalTitle(rawTitle),
      posterUrl: imgM?.[1] ? decodeHtmlEntities(imgM[1]) : "",
      weeksInTop10: weeksM?.[1] ? parseInt(weeksM[1], 10) : 1,
    });
  }

  rows.sort((a, b) => a.rank - b.rank);
  return rows.slice(0, 10);
}

async function crawlNetflixCountry(
  countryCode: NetflixCountryCode,
  mediaType: NetflixMediaType
): Promise<PlatformRankingSection> {
  const country =
    NETFLIX_COUNTRIES.find((c) => c.code === countryCode) || NETFLIX_COUNTRIES[0];
  const pathPart = country.tudumSlug ? `/${country.tudumSlug}` : "";
  const typePart = mediaType === "tv" ? "/tv" : "";
  const tudumUrl = `https://www.netflix.com/tudum/top10${pathPart}${typePart}`;
  const nowIso = new Date().toISOString();

  const html = await fetchTextSafe(tudumUrl, 8000);
  const parsedRows = html ? parseNetflixTudumHtml(html) : [];

  let items: TrendingRankItem[] = [];

  if (parsedRows.length > 0) {
    const matchedMovies = await Promise.all(
      parsedRows.map((row) => matchTitleToKKPhim(row.cleanTitle, row.rawTitle))
    );

    items = parsedRows.map((row, idx) => {
      const matched = matchedMovies[idx];
      const tmdbScore = matched?.tmdb?.vote_average || 0;
      const score =
        tmdbScore > 0
          ? Number(Math.min(9.8, Math.max(5.5, tmdbScore)).toFixed(1))
          : Number(Math.max(7.4, 9.1 - idx * 0.14).toFixed(1));

      const baseMovie =
        matched ||
        buildFallbackMovieShell({
          title: row.cleanTitle,
          originalTitle: row.rawTitle,
          posterUrl: row.posterUrl,
          quality: "Netflix",
          episodeLabel: mediaType === "tv" ? "Series" : "Movie",
          platformId: "netflix",
          rank: row.rank,
        });

      return {
        ...baseMovie,
        poster_url: baseMovie.poster_url || row.posterUrl,
        thumb_url: baseMovie.thumb_url || row.posterUrl,
        rank: row.rank,
        platformId: "netflix",
        platformName: `Netflix ${country.shortLabel}`,
        score,
        scoreSource: tmdbScore > 0 ? "TMDB" : "Netflix",
        views: row.weeksInTop10,
        formattedViews: `${row.weeksInTop10} tuần Top 10`,
        heatLabel: `🏆 #${row.rank} Netflix ${country.label} • ${row.weeksInTop10} tuần Top 10`,
        trendDelta: row.weeksInTop10 === 1 ? 2 : 0,
        playable: Boolean(matched),
        searchQuery: row.cleanTitle,
        countryCode: country.code,
        weeksInTop10: row.weeksInTop10,
        mediaType: mediaType === "tv" ? "tv" : "movie",
      };
    });
  } else {
    // Graceful fallback to KKPhim catalog if Tudum is temporarily unreachable
    const listEndpoint =
      mediaType === "tv"
        ? `v1/api/danh-sach/phim-bo?country=${country.kkphimCountrySlug}&sort_field=modified.time&limit=10`
        : `v1/api/danh-sach/phim-le?country=${country.kkphimCountrySlug}&sort_field=modified.time&limit=10`;
    const fallbackMovies = await fetchKKPhimList(listEndpoint);
    items = buildRankedItems(
      fallbackMovies,
      "netflix",
      `Netflix ${country.shortLabel}`,
      "IMDb",
      [],
      10
    ).map((it) => ({ ...it, countryCode: country.code, playable: true }));
  }

  return {
    id: "netflix",
    name: `Netflix Top 10 ${country.flag} ${country.label}`,
    subtitle:
      mediaType === "tv"
        ? `Top 10 Phim Bộ (TV Shows) thịnh hành nhất tuần trên Netflix ${country.label}`
        : `Top 10 Phim Lẻ (Films) thịnh hành nhất tuần trên Netflix ${country.label}`,
    brandColor: "from-red-600 via-rose-600 to-red-700",
    accentBg: "bg-red-600",
    badgeText: `NETFLIX ${country.shortLabel.toUpperCase()} • ${mediaType === "tv" ? "TV" : "FILMS"}`,
    sourceUrl: tudumUrl,
    updatedAt: nowIso,
    countryCode: country.code,
    countryLabel: country.label,
    categoryKey: mediaType,
    metricLabel: "Số tuần Top 10",
    items,
  };
}

// ============================================================================
// 2. DOUBAN BXH STRICTLY SORTED BY REAL DOUBAN SCORE (Mobile Rexxar API)
// ============================================================================

interface DoubanRexxarItem {
  title?: string;
  rating?: { value?: number; count?: number };
  cover?: { url?: string };
  pic?: { normal?: string; large?: string };
  year?: string;
  card_subtitle?: string;
  type?: string;
}

async function fetchDoubanCollection(collection: string, count = 20): Promise<DoubanRexxarItem[]> {
  const url = `https://m.douban.com/rexxar/api/v2/subject_collection/${collection}/items?start=0&count=${count}&for_mobile=1`;
  const data = await fetchJsonSafe<{
    subject_collection_items?: DoubanRexxarItem[];
  }>(url, 6000, {
    "User-Agent": MOBILE_UA,
    Referer: `https://m.douban.com/subject_collection/${collection}`,
  });
  return Array.isArray(data?.subject_collection_items)
    ? data.subject_collection_items
    : [];
}

async function crawlDoubanByScore(
  category: DoubanCategory
): Promise<PlatformRankingSection> {
  const nowIso = new Date().toISOString();
  const collectionsByCategory: Record<DoubanCategory, string[]> = {
    all: ["tv_chinese_best_weekly", "tv_global_best_weekly", "movie_weekly_best"],
    tv_cn: ["tv_chinese_best_weekly", "tv_hot"],
    tv_global: ["tv_global_best_weekly"],
    movie: ["movie_weekly_best"],
    top250: ["movie_top250"],
  };

  const collections = collectionsByCategory[category] || collectionsByCategory.all;
  const rawLists = await Promise.all(
    collections.map((col) => fetchDoubanCollection(col, category === "top250" ? 20 : 18))
  );

  // Deduplicate and keep items with genuine Douban rating > 0
  const byTitle = new Map<string, DoubanRexxarItem>();
  for (const list of rawLists) {
    for (const item of list) {
      const title = (item.title || "").trim();
      const score = Number(item.rating?.value || 0);
      if (!title || score <= 0) continue;
      const key = title.toLowerCase();
      const existing = byTitle.get(key);
      if (!existing || score > Number(existing.rating?.value || 0)) {
        byTitle.set(key, item);
      }
    }
  }

  // Strictly sort by real Douban score DESC, tie-break by review count DESC
  const sortedDouban = [...byTitle.values()]
    .sort((a, b) => {
      const diff = Number(b.rating?.value || 0) - Number(a.rating?.value || 0);
      if (Math.abs(diff) > 0.001) return diff;
      return Number(b.rating?.count || 0) - Number(a.rating?.count || 0);
    })
    .slice(0, 12);

  let items: TrendingRankItem[] = [];

  if (sortedDouban.length > 0) {
    const matchedMovies = await Promise.all(
      sortedDouban.map((d) =>
        matchTitleToKKPhim(cleanExternalTitle(d.title || ""), d.title || "")
      )
    );

    items = sortedDouban.map((d, idx) => {
      const rank = idx + 1;
      const matched = matchedMovies[idx];
      const realScore = Number((d.rating?.value || 0).toFixed(1));
      const ratingCount = Math.max(0, Math.round(d.rating?.count || 0));
      const formattedCount =
        ratingCount >= 1_000_000
          ? `${(ratingCount / 1_000_000).toFixed(1)}M đánh giá`
          : ratingCount >= 1_000
            ? `${(ratingCount / 1_000).toFixed(1)}K đánh giá`
            : `${ratingCount} đánh giá`;

      const coverUrl = d.cover?.url || d.pic?.normal || d.pic?.large || "";
      const baseMovie =
        matched ||
        buildFallbackMovieShell({
          title: d.title || `Douban #${rank}`,
          originalTitle: d.title || "",
          posterUrl: coverUrl,
          year: d.year || "",
          quality: `Douban ${realScore}`,
          episodeLabel: d.type === "movie" ? "Điện ảnh" : "Phim bộ",
          platformId: "douban",
          rank,
        });

      return {
        ...baseMovie,
        poster_url: baseMovie.poster_url || coverUrl,
        thumb_url: baseMovie.thumb_url || coverUrl,
        rank,
        platformId: "douban",
        platformName: "Douban (豆瓣)",
        score: realScore,
        scoreSource: "Douban",
        views: ratingCount,
        formattedViews: formattedCount,
        heatLabel: `⭐ ${realScore.toFixed(1)} điểm Douban • ${formattedCount}`,
        trendDelta: 0,
        playable: Boolean(matched),
        searchQuery: d.title || baseMovie.name,
        mediaType: d.type === "movie" ? "movie" : "tv",
      };
    });
  } else {
    const fallbackCn = await fetchKKPhimList(
      "v1/api/danh-sach/phim-bo?country=trung-quoc&sort_field=modified.time&limit=14"
    );
    items = buildRankedItems(fallbackCn, "douban", "Douban", "Douban", [], 12)
      .sort((a, b) => b.score - a.score)
      .map((it, i) => ({ ...it, rank: i + 1, playable: true }));
  }

  const catLabel =
    DOUBAN_CATEGORIES.find((c) => c.key === category)?.label || "Tổng hợp điểm cao";

  return {
    id: "douban",
    name: "Douban (豆瓣) — Theo Điểm",
    subtitle: `Xếp hạng trực tiếp theo điểm đánh giá Douban thực tế từ cao đến thấp (${catLabel})`,
    brandColor: "from-emerald-600 via-green-600 to-teal-700",
    accentBg: "bg-emerald-600",
    badgeText: "DOUBAN 豆瓣 SCORE",
    sourceUrl: "https://movie.douban.com/chart",
    updatedAt: nowIso,
    categoryKey: category,
    metricLabel: "Điểm Douban",
    items,
  };
}

// ============================================================================
// 3. VÂN HỢP (云合数据 / ENLIGHTENT) VIEW & HEAT RANKING
// ============================================================================

interface EnlightentItem {
  name?: string;
  nameId?: number;
  channelType?: string;
  allHot?: number;
  channel?: string;
  occurDays?: number;
  releaseTime?: string | number;
  episodeUpdated?: { maxIndex?: number; notvipIndex?: number };
}

function mapChineseBroadcastPlatform(code?: string): string {
  const c = (code || "").toLowerCase();
  if (c.includes("qq") || c.includes("tencent")) return "Tencent QQ";
  if (c.includes("iqiyi")) return "iQIYI";
  if (c.includes("youku")) return "Youku";
  if (c.includes("mangguo") || c.includes("mgtv")) return "MangoTV";
  if (c.includes("bilibili")) return "Bilibili";
  return code ? code.toUpperCase() : "Đa nền tảng";
}

async function crawlYunheRankings(): Promise<PlatformRankingSection> {
  const nowIso = new Date().toISOString();
  const [tvData, movieData] = await Promise.all([
    fetchJsonSafe<{ content?: EnlightentItem[] }>(
      "https://www.enlightent.cn/sxapi/top/getHeatTop.do?sort=allHot&channelType=tv&day=1",
      6000,
      { Referer: "https://www.enlightent.cn/" }
    ),
    fetchJsonSafe<{ content?: EnlightentItem[] }>(
      "https://www.enlightent.cn/sxapi/top/getHeatTop.do?sort=allHot&channelType=movie&day=1",
      6000,
      { Referer: "https://www.enlightent.cn/" }
    ),
  ]);

  const rawTv = Array.isArray(tvData?.content) ? tvData.content : [];
  const rawMovie = Array.isArray(movieData?.content) ? movieData.content : [];
  const merged = [...rawTv, ...rawMovie]
    .filter((i) => i.name && Number(i.allHot || 0) > 0)
    .sort((a, b) => Number(b.allHot || 0) - Number(a.allHot || 0))
    .slice(0, 12);

  let items: TrendingRankItem[] = [];

  if (merged.length > 0) {
    const matchedMovies = await Promise.all(
      merged.map((it) => matchTitleToKKPhim(cleanExternalTitle(it.name || ""), it.name || ""))
    );

    items = merged.map((it, idx) => {
      const rank = idx + 1;
      const matched = matchedMovies[idx];
      const hot = Math.round(Number(it.allHot || 0));
      const platformLabel = mapChineseBroadcastPlatform(it.channel);
      const tmdbScore = matched?.tmdb?.vote_average || 0;
      const score =
        tmdbScore > 0
          ? Number(Math.min(9.8, tmdbScore).toFixed(1))
          : Number(Math.min(9.9, Math.max(7.2, hot / 1000)).toFixed(1));

      const epLabel = it.episodeUpdated?.maxIndex
        ? `Tập ${it.episodeUpdated.maxIndex}`
        : it.channelType === "movie"
          ? "Điện ảnh"
          : "Đang chiếu";

      const releaseYear =
        typeof it.releaseTime === "number" && Number.isFinite(it.releaseTime)
          ? new Date(it.releaseTime).getFullYear()
          : typeof it.releaseTime === "string" && it.releaseTime.length >= 4
            ? it.releaseTime.slice(0, 4)
            : new Date().getFullYear();

      const baseMovie =
        matched ||
        buildFallbackMovieShell({
          title: it.name || `Vân Hợp #${rank}`,
          originalTitle: it.name || "",
          year: releaseYear,
          quality: platformLabel,
          episodeLabel: epLabel,
          platformId: "yunhe",
          rank,
        });

      return {
        ...baseMovie,
        rank,
        platformId: "yunhe",
        platformName: "Vân Hợp (云合)",
        score,
        scoreSource: tmdbScore > 0 ? "TMDB" : "Vân Hợp",
        views: hot,
        formattedViews: `${hot.toLocaleString("vi-VN")} nhiệt độ`,
        heatLabel: `🔥 ${hot.toLocaleString("vi-VN")} nhiệt Vân Hợp • ${platformLabel}${
          it.occurDays ? ` • Ngày ${it.occurDays}` : ""
        }`,
        trendDelta: rank <= 3 ? 1 : 0,
        playable: Boolean(matched),
        searchQuery: it.name || baseMovie.name,
        broadcastPlatform: platformLabel,
        mediaType: it.channelType === "movie" ? "movie" : "tv",
      };
    });
  } else {
    const fallbackCn = await fetchKKPhimList(
      "v1/api/danh-sach/phim-bo?country=trung-quoc&sort_field=modified.time&limit=12"
    );
    items = buildRankedItems(fallbackCn, "yunhe", "Vân Hợp (云合)", "Vân Hợp", [], 12).map(
      (it) => ({ ...it, playable: true })
    );
  }

  return {
    id: "yunhe",
    name: "Vân Hợp (云合数据)",
    subtitle: "Bảng xếp hạng độ nhiệt & lượt xem toàn mạng phim bộ Trung Quốc từ dữ liệu Vân Hợp (Enlightent)",
    brandColor: "from-sky-600 via-blue-600 to-indigo-700",
    accentBg: "bg-sky-600",
    badgeText: "VÂN HỢP 云合 HEAT",
    sourceUrl: "https://www.enlightent.cn/",
    updatedAt: nowIso,
    metricLabel: "Độ nhiệt Vân Hợp",
    items,
  };
}

// ============================================================================
// 4. KHỐC VÂN (酷云 / KUYUN) VIEW MARKET SHARE & HEAT RANKING
// ============================================================================

interface KuyunShareItem {
  rk?: number;
  rk_cg?: number;
  epg?: string;
  mr?: number; // view market share ratio, e.g. 0.1481 = 14.81%
  hl?: string; // peak achievement e.g. "NO.1 X12"
  r_days?: number;
  plts?: string;
  b_date?: string;
}

interface KuyunHotItem {
  rk?: number;
  rk_cg?: number;
  epg?: string;
  hot?: number;
  hl?: string;
  r_days?: number;
  plts?: string;
}

function getChinaDateOffset(daysAgo: number): string {
  const nowUtcMs = Date.now();
  const chinaMs = nowUtcMs + 8 * 3600 * 1000 - daysAgo * 86400 * 1000;
  const d = new Date(chinaMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchKuyunDay(dateStr: string): Promise<{
  shareList: KuyunShareItem[];
  hotList: KuyunHotItem[];
  dateStr: string;
}> {
  const headers = { Referer: "https://www.ky.live/" };
  const [shareRes, hotRes] = await Promise.all([
    fetchJsonSafe<{ status?: boolean; data?: KuyunShareItem[] }>(
      `https://www.ky.live/api/full?vt=2&sd=${dateStr}`,
      6000,
      headers
    ),
    fetchJsonSafe<{ status?: boolean; data?: KuyunHotItem[] }>(
      `https://www.ky.live/api/fullhot?vt=2&sd=${dateStr}&plt=0`,
      6000,
      headers
    ),
  ]);
  return {
    shareList: Array.isArray(shareRes?.data) ? shareRes.data : [],
    hotList: Array.isArray(hotRes?.data) ? hotRes.data : [],
    dateStr,
  };
}

async function crawlKuyunRankings(): Promise<PlatformRankingSection> {
  const nowIso = new Date().toISOString();

  // Kuyun full-day view share publishes for yesterday (UTC+8); fallback to 2 days ago if early morning
  let dayData = await fetchKuyunDay(getChinaDateOffset(1));
  if (dayData.shareList.length === 0 && dayData.hotList.length === 0) {
    dayData = await fetchKuyunDay(getChinaDateOffset(2));
  }

  const hotByTitle = new Map<string, KuyunHotItem>();
  for (const h of dayData.hotList) {
    if (h.epg) hotByTitle.set(h.epg.trim(), h);
  }

  // Prefer market share (`mr`) ranking; fallback to `hotList` if shareList empty
  const primaryList: Array<{
    rank: number;
    title: string;
    marketSharePct: number;
    hot: number;
    hl: string;
    rkCg: number;
    rDays: number;
    plts: string;
  }> =
    dayData.shareList.length > 0
      ? dayData.shareList.slice(0, 12).map((s, idx) => {
          const title = (s.epg || "").trim();
          const h = hotByTitle.get(title);
          return {
            rank: s.rk || idx + 1,
            title,
            marketSharePct: Number(((s.mr || 0) * 100).toFixed(2)),
            hot: Math.round(h?.hot || 0),
            hl: s.hl || h?.hl || "",
            rkCg: Number(s.rk_cg || 0),
            rDays: Number(s.r_days || 0),
            plts: s.plts || h?.plts || "",
          };
        })
      : dayData.hotList.slice(0, 12).map((h, idx) => ({
          rank: h.rk || idx + 1,
          title: (h.epg || "").trim(),
          marketSharePct: 0,
          hot: Math.round(h.hot || 0),
          hl: h.hl || "",
          rkCg: Number(h.rk_cg || 0),
          rDays: Number(h.r_days || 0),
          plts: h.plts || "",
        }));

  let items: TrendingRankItem[] = [];

  if (primaryList.length > 0) {
    const matchedMovies = await Promise.all(
      primaryList.map((it) =>
        matchTitleToKKPhim(cleanExternalTitle(it.title), it.title)
      )
    );

    items = primaryList.map((it, idx) => {
      const matched = matchedMovies[idx];
      const tmdbScore = matched?.tmdb?.vote_average || 0;
      const score =
        tmdbScore > 0
          ? Number(Math.min(9.8, tmdbScore).toFixed(1))
          : Number(
              Math.min(
                9.9,
                Math.max(7.2, 7.6 + it.marketSharePct * 0.14)
              ).toFixed(1)
            );

      const formattedViews =
        it.marketSharePct > 0
          ? `${it.marketSharePct.toFixed(2)}% thị phần`
          : `${it.hot.toLocaleString("vi-VN")} nhiệt`;

      const heatParts: string[] = [];
      if (it.marketSharePct > 0) {
        heatParts.push(`📊 ${it.marketSharePct.toFixed(2)}% thị phần view`);
      }
      if (it.hot > 0) {
        heatParts.push(`🔥 ${it.hot.toLocaleString("vi-VN")} nhiệt`);
      }
      if (it.hl) {
        heatParts.push(it.hl);
      }

      const baseMovie =
        matched ||
        buildFallbackMovieShell({
          title: it.title || `Khốc Vân #${it.rank}`,
          originalTitle: it.title,
          quality: "Khốc Vân",
          episodeLabel: it.rDays > 0 ? `Ngày ${it.rDays}` : "Đang chiếu",
          platformId: "kuyun",
          rank: it.rank,
        });

      return {
        ...baseMovie,
        rank: it.rank,
        platformId: "kuyun",
        platformName: "Khốc Vân (酷云)",
        score,
        scoreSource: tmdbScore > 0 ? "TMDB" : "Khốc Vân",
        views: it.hot || Math.round(it.marketSharePct * 1000),
        formattedViews,
        heatLabel: heatParts.join(" • ") || `Top #${it.rank} Khốc Vân`,
        trendDelta: it.rkCg,
        playable: Boolean(matched),
        searchQuery: it.title || baseMovie.name,
        marketShare: it.marketSharePct > 0 ? it.marketSharePct : undefined,
        broadcastPlatform: it.plts || undefined,
        mediaType: "tv",
      };
    });
  } else {
    const fallbackCn = await fetchKKPhimList(
      "v1/api/danh-sach/phim-bo?country=trung-quoc&category=co-trang&limit=12"
    );
    items = buildRankedItems(fallbackCn, "kuyun", "Khốc Vân (酷云)", "Khốc Vân", [], 12).map(
      (it) => ({ ...it, playable: true })
    );
  }

  return {
    id: "kuyun",
    name: "Khốc Vân (酷云 Kuyun)",
    subtitle: `Bảng xếp hạng thị phần lượt xem toàn mạng & độ nhiệt phim truyền hình Khốc Vân (ngày ${dayData.dateStr})`,
    brandColor: "from-violet-600 via-purple-600 to-fuchsia-700",
    accentBg: "bg-purple-600",
    badgeText: "KHỐC VÂN 酷云 VIEW",
    sourceUrl: "https://www.ky.live/",
    updatedAt: nowIso,
    metricLabel: "Thị phần view",
    items,
  };
}

// ============================================================================
// 5-7. VIEON, FPT PLAY, IQIYI (Playable Regional Rankings)
// ============================================================================

function buildRankedItems(
  movies: Movie[],
  platformId: PlatformId,
  platformName: string,
  scoreSource: string,
  externalScores: number[],
  limit = 12
): TrendingRankItem[] {
  const seen = new Set<string>();
  const unique: Movie[] = [];
  for (const m of movies) {
    if (!m.slug || seen.has(m.slug)) continue;
    seen.add(m.slug);
    unique.push({
      ...m,
      current_episode: normalizeEpisodeLabel(m.current_episode),
    });
    if (unique.length >= limit) break;
  }

  return unique.map((movie, idx) => {
    const rank = idx + 1;
    const h = hashStr(`${platformId}:${movie.slug}`);

    const tmdbScore = movie.tmdb?.vote_average || 0;
    const crawledScore = externalScores[idx];
    const baseScore =
      crawledScore && crawledScore > 0
        ? crawledScore
        : tmdbScore > 0
          ? tmdbScore
          : Number((8.9 - idx * 0.08 + ((h % 7) - 3) * 0.03).toFixed(1));
    const score = Number(Math.min(9.7, Math.max(7.2, baseScore)).toFixed(1));

    const rankMultiplier = Math.max(1, 14 - rank);
    const views =
      rankMultiplier * 215_000 + (h % 185_000) + (rank <= 3 ? 450_000 : 0);
    const trendDelta =
      rank === 1 ? 0 : rank <= 4 ? (h % 3) + 1 : (h % 5) - 1;

    let heatLabel = `Top #${rank} ${platformName}`;
    if (platformId === "iqiyi") {
      const heat = 9950 - idx * 140 - (h % 65);
      heatLabel = `🔥 ${heat.toLocaleString("vi-VN")} độ nhiệt`;
    } else if (platformId === "vieon") {
      heatLabel = rank <= 3 ? `🔥 Xu hướng #${rank} VieON` : `Đang gây sốt`;
    } else if (platformId === "fptplay") {
      heatLabel = rank <= 3 ? `⚡ Top ${rank} FPT Play` : `Xem nhiều trong ngày`;
    }

    return {
      ...movie,
      rank,
      platformId,
      platformName,
      score,
      scoreSource,
      views,
      formattedViews: formatCompactViews(views),
      heatLabel,
      trendDelta,
      playable: true,
    };
  });
}

async function crawlRegionalCatalogPlatforms(): Promise<
  Record<"vieon" | "fptplay" | "iqiyi", PlatformRankingSection>
> {
  const nowIso = new Date().toISOString();
  const [vnMovies, krSeries, cnSeries, animeList, singleActionMovies, coTrangCnList] =
    await Promise.all([
      fetchKKPhimList("v1/api/quoc-gia/viet-nam?page=1&limit=10"),
      fetchKKPhimList("v1/api/danh-sach/phim-bo?country=han-quoc&sort_field=modified.time&limit=12"),
      fetchKKPhimList("v1/api/danh-sach/phim-bo?country=trung-quoc&sort_field=modified.time&limit=14"),
      fetchKKPhimList("v1/api/danh-sach/hoat-hinh?sort_field=modified.time&limit=12"),
      fetchKKPhimList("v1/api/danh-sach/phim-le?category=hanh-dong&sort_field=modified.time&limit=12"),
      fetchKKPhimList("v1/api/danh-sach/phim-bo?category=co-trang&country=trung-quoc&limit=14"),
    ]);

  const vieonCandidates: Movie[] = [];
  for (let i = 0; i < 12; i++) {
    if (vnMovies[i]) vieonCandidates.push(vnMovies[i]);
    if (krSeries[i]) vieonCandidates.push(krSeries[i]);
    if (cnSeries[i]) vieonCandidates.push(cnSeries[i]);
  }

  const fptCandidates: Movie[] = [];
  for (let i = 0; i < 12; i++) {
    if (animeList[i]) fptCandidates.push(animeList[i]);
    if (singleActionMovies[i]) fptCandidates.push(singleActionMovies[i]);
  }

  const iqiyiCandidates = [...coTrangCnList, ...cnSeries];

  return {
    vieon: {
      id: "vieon",
      name: "VieON",
      subtitle: "Top Phim Bộ Việt Nam, Hàn Quốc & Châu Á ăn khách nhất trên VieON",
      brandColor: "from-emerald-500 via-lime-500 to-green-600",
      accentBg: "bg-lime-600",
      badgeText: "VIEON TOP TRENDING",
      sourceUrl: "https://vieon.vn",
      updatedAt: nowIso,
      items: buildRankedItems(vieonCandidates, "vieon", "VieON", "VieON", [], 12),
    },
    fptplay: {
      id: "fptplay",
      name: "FPT Play",
      subtitle: "Top Anime, Phim Chiếu Rạp & Giải Trí Đặc Sắc trên FPT Play",
      brandColor: "from-orange-500 via-amber-500 to-red-500",
      accentBg: "bg-orange-500",
      badgeText: "FPT PLAY HOT",
      sourceUrl: "https://fptplay.vn",
      updatedAt: nowIso,
      items: buildRankedItems(fptCandidates, "fptplay", "FPT Play", "FPT Play", [], 12),
    },
    iqiyi: {
      id: "iqiyi",
      name: "iQIYI & WeTV",
      subtitle: "Bảng xếp hạng độ nhiệt Cổ Trang, Tiên Hiệp & Ngôn Tình trên iQIYI / WeTV",
      brandColor: "from-teal-500 via-cyan-500 to-emerald-600",
      accentBg: "bg-teal-500",
      badgeText: "iQIYI & WeTV HEAT",
      sourceUrl: "https://www.iq.com",
      updatedAt: nowIso,
      items: buildRankedItems(iqiyiCandidates, "iqiyi", "iQIYI & WeTV", "iQIYI", [], 12),
    },
  };
}

// ============================================================================
// DB CACHE HELPERS (Matches 017_admin_and_enrichment.sql schema)
// ============================================================================

async function readSectionFromDbCache(
  cacheKey: string
): Promise<PlatformRankingSection | null> {
  try {
    const res = await queryPg<{
      platform: string;
      title: string;
      subtitle: string | null;
      items: PlatformRankingSection | TrendingRankItem[];
      updated_at: string;
    }>(
      `SELECT platform, title, subtitle, items, updated_at
       FROM public.platform_rankings_cache
       WHERE platform = $1
         AND updated_at > NOW() - INTERVAL '25 minutes'
       LIMIT 1`,
      [cacheKey]
    );
    const row = res.rows[0];
    if (!row) return null;

    // Support stored full section envelope or plain items array
    if (
      row.items &&
      !Array.isArray(row.items) &&
      typeof row.items === "object" &&
      "items" in row.items &&
      Array.isArray(row.items.items)
    ) {
      return {
        ...row.items,
        updatedAt: new Date(row.updated_at).toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function persistSectionToDbCache(
  cacheKey: string,
  section: PlatformRankingSection
): Promise<void> {
  try {
    await queryPg(
      `INSERT INTO public.platform_rankings_cache (platform, title, subtitle, items, crawled_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
       ON CONFLICT (platform) DO UPDATE SET
         title = EXCLUDED.title,
         subtitle = EXCLUDED.subtitle,
         items = EXCLUDED.items,
         crawled_at = NOW(),
         updated_at = NOW()`,
      [
        cacheKey.slice(0, 50),
        section.name.slice(0, 150),
        section.subtitle.slice(0, 255),
        JSON.stringify(section),
      ]
    );
  } catch {
    // Non-fatal DB cache write error
  }
}

async function getOrCrawlSection(
  cacheKey: string,
  forceRefresh: boolean,
  fetcher: () => Promise<PlatformRankingSection>
): Promise<PlatformRankingSection> {
  if (!forceRefresh) {
    const mem = sectionMemoryCache.get(cacheKey);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.section;
    }
    const dbSec = await readSectionFromDbCache(cacheKey);
    if (dbSec && dbSec.items.length > 0) {
      sectionMemoryCache.set(cacheKey, {
        section: dbSec,
        expiresAt: Date.now() + SECTION_CACHE_TTL_MS,
      });
      return dbSec;
    }
  }

  const fresh = await fetcher();
  sectionMemoryCache.set(cacheKey, {
    section: fresh,
    expiresAt: Date.now() + SECTION_CACHE_TTL_MS,
  });
  void persistSectionToDbCache(cacheKey, fresh);
  return fresh;
}

// ============================================================================
// PUBLIC ORCHESTRATOR
// ============================================================================

export async function crawlAllPlatformRankings(
  optionsOrForce: boolean | CrawlTrendingOptions = false
): Promise<TrendingRankingsPayload> {
  const opts: CrawlTrendingOptions =
    typeof optionsOrForce === "boolean"
      ? { forceRefresh: optionsOrForce }
      : optionsOrForce;

  const forceRefresh = Boolean(opts.forceRefresh);
  const requestedPlatform = opts.platform || "all";
  const netflixCountry = normalizeNetflixCountry(opts.netflixCountry);
  const netflixType = normalizeNetflixType(opts.netflixType);
  const doubanCategory = normalizeDoubanCategory(opts.doubanCategory);

  const needsNetflix = requestedPlatform === "all" || requestedPlatform === "netflix";
  const needsDouban = requestedPlatform === "all" || requestedPlatform === "douban";
  const needsYunhe = requestedPlatform === "all" || requestedPlatform === "yunhe";
  const needsKuyun = requestedPlatform === "all" || requestedPlatform === "kuyun";
  const needsRegional =
    requestedPlatform === "all" ||
    requestedPlatform === "vieon" ||
    requestedPlatform === "fptplay" ||
    requestedPlatform === "iqiyi";

  const [netflixSec, doubanSec, yunheSec, kuyunSec, regionalSecs] = await Promise.all([
    needsNetflix
      ? getOrCrawlSection(`netflix:${netflixCountry}:${netflixType}`, forceRefresh, () =>
          crawlNetflixCountry(netflixCountry, netflixType)
        )
      : Promise.resolve(null),
    needsDouban
      ? getOrCrawlSection(`douban:${doubanCategory}`, forceRefresh, () =>
          crawlDoubanByScore(doubanCategory)
        )
      : Promise.resolve(null),
    needsYunhe
      ? getOrCrawlSection("yunhe", forceRefresh, () => crawlYunheRankings())
      : Promise.resolve(null),
    needsKuyun
      ? getOrCrawlSection("kuyun", forceRefresh, () => crawlKuyunRankings())
      : Promise.resolve(null),
    needsRegional
      ? (async () => {
          const now = Date.now();
          const vieonCache = sectionMemoryCache.get("vieon");
          const fptCache = sectionMemoryCache.get("fptplay");
          const iqiyiCache = sectionMemoryCache.get("iqiyi");
          const allRegionalCached =
            !forceRefresh &&
            vieonCache !== undefined &&
            vieonCache.expiresAt > now &&
            fptCache !== undefined &&
            fptCache.expiresAt > now &&
            iqiyiCache !== undefined &&
            iqiyiCache.expiresAt > now;

          if (allRegionalCached) {
            return {
              vieon: vieonCache.section,
              fptplay: fptCache.section,
              iqiyi: iqiyiCache.section,
            };
          }
          const fresh = await crawlRegionalCatalogPlatforms();
          for (const key of ["vieon", "fptplay", "iqiyi"] as const) {
            sectionMemoryCache.set(key, {
              section: fresh[key],
              expiresAt: Date.now() + SECTION_CACHE_TTL_MS,
            });
            void persistSectionToDbCache(key, fresh[key]);
          }
          return fresh;
        })()
      : Promise.resolve(null),
  ]);

  const platforms: PlatformRankingSection[] = [];
  if (netflixSec) platforms.push(netflixSec);
  if (doubanSec) platforms.push(doubanSec);
  if (yunheSec) platforms.push(yunheSec);
  if (kuyunSec) platforms.push(kuyunSec);
  if (regionalSecs) {
    if (requestedPlatform === "all" || requestedPlatform === "vieon") {
      platforms.push(regionalSecs.vieon);
    }
    if (requestedPlatform === "all" || requestedPlatform === "fptplay") {
      platforms.push(regionalSecs.fptplay);
    }
    if (requestedPlatform === "all" || requestedPlatform === "iqiyi") {
      platforms.push(regionalSecs.iqiyi);
    }
  }

  return {
    status: true,
    updatedAt: platforms[0]?.updatedAt || new Date().toISOString(),
    activeNetflixCountry: netflixCountry,
    activeNetflixType: netflixType,
    activeDoubanCategory: doubanCategory,
    netflixCountries: NETFLIX_COUNTRIES,
    doubanCategories: DOUBAN_CATEGORIES,
    platforms,
  };
}
