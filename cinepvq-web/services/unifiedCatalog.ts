// ==============================================================================
// services/unifiedCatalog.ts
// Unified 6-Dataset Catalog Engine (KKPhim1 + NguonC + VSMOV + ChoPhim + PhimHDCSS)
// Treats all datasets as ONE single catalog outside the player — no source
// branding exposed on cards/search/detail; source switching happens inside player.
// ==============================================================================

import {
  kkphimCatalogAdapter,
  normalizeImageUrl,
  type KKPhimRawLatestResponse,
  type KKPhimRawV1ListResponse,
  type KKPhimRawDetailResponse,
} from "./kkphimCatalogAdapter";
import { normalizeEpisodeLabel } from "@/lib/format";
import type {
  Movie,
  MovieDetail,
  MovieDetailResponse,
  PaginatedResponse,
  EpisodeServer,
  CategoryDict,
} from "@/types/movie";

const KKPHIM_BASE = (
  process.env.NEXT_PUBLIC_KKPHIM_API_URL ?? "https://phimapi.com"
).replace(/\/+$/, "");
const NGUONC_BASE = (
  process.env.NGUONC_API_URL ?? "https://phim.nguonc.com/api"
).replace(/\/+$/, "");
const VSMOV_BASE = "https://vsmov.com/api";
const CHOPHIM_BASE = "https://chophim.wtf";
const PHIMHDCSS_BASE = "https://phimhdcss.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const LATEST_CACHE_TTL_MS = 3 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const HINT_CACHE_TTL_MS = 60 * 60 * 1000;
const MATCH_CACHE_TTL_MS = 30 * 60 * 1000;

interface SlugSourceHint {
  title?: string;
  originalName?: string;
  year?: string | number;
  phimHdcssUrl?: string;
  choPhimSlug?: string;
  vsmovSlug?: string;
  nguoncSlug?: string;
  kkphimSlug?: string;
  expiresAt: number;
}

const searchCache = new Map<string, { data: PaginatedResponse; expiresAt: number }>();
const latestCache = new Map<number, { data: PaginatedResponse; expiresAt: number }>();
const detailCache = new Map<string, { data: MovieDetailResponse; expiresAt: number }>();
const slugHints = new Map<string, SlugSourceHint>();
const titleMatchCache = new Map<string, { movie: Movie | null; expiresAt: number }>();

function rememberHint(slug: string, partial: Partial<SlugSourceHint>) {
  if (!slug) return;
  const key = slug.trim().toLowerCase();
  const prev = slugHints.get(key);
  slugHints.set(key, {
    ...(prev || {}),
    ...partial,
    expiresAt: Date.now() + HINT_CACHE_TTL_MS,
  });
  if (slugHints.size > 2000) {
    const oldest = slugHints.keys().next().value;
    if (oldest) slugHints.delete(oldest);
  }
}

export function getSlugSourceHint(slug: string): SlugSourceHint | null {
  const entry = slugHints.get(slug.trim().toLowerCase());
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry;
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

function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSlugKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDedupeFingerprint(movie: Movie): string {
  const normName = normalizeMatchText(movie.name || "");
  const year = movie.year ? String(movie.year).replace(/\D/g, "").slice(0, 4) : "";
  if (normName && year) return `${normName}|${year}`;
  if (normName) return normName;
  return normalizeSlugKey(movie.slug || "");
}

/**
 * Filters out sidebar/trending/recommended widget links scraped from HTML search pages
 * (ChoPhim, PhimHDCSS) so only results actually relevant to the search keyword survive.
 */
function matchesSearchKeyword(
  keyword: string,
  name: string,
  originalName = "",
  slug = ""
): boolean {
  const normQ = normalizeMatchText(keyword);
  if (!normQ) return true;

  const haystack = normalizeMatchText(`${name} ${originalName} ${slug.replace(/-/g, " ")}`);
  if (!haystack) return false;
  if (haystack.includes(normQ)) return true;

  const tokens = normQ.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return haystack.includes(normQ);
  if (tokens.length === 1) return haystack.includes(tokens[0]);

  const hitCount = tokens.filter((t) => haystack.includes(t)).length;
  const required = Math.max(2, Math.ceil(tokens.length * 0.5));
  return hitCount >= required;
}

async function fetchJsonSafe<T>(url: string, timeoutMs = 3000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": UA,
      },
      cache: "no-store",
      signal: controller.signal,
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
  timeoutMs = 3200,
  referer?: string
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "User-Agent": UA,
        ...(referer ? { Referer: referer } : {}),
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 1. PER-DATASET SEARCH ADAPTERS
// ============================================================================

async function searchKKPhim(keyword: string, page = 1): Promise<{
  items: Movie[];
  totalPages: number;
  totalItems: number;
}> {
  const raw = await fetchJsonSafe<KKPhimRawV1ListResponse>(
    `${KKPHIM_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=24`,
    3200
  );
  if (!raw) return { items: [], totalPages: 1, totalItems: 0 };
  const normalized = kkphimCatalogAdapter.normalizeV1ListResponse(raw);
  for (const m of normalized.items) {
    rememberHint(m.slug, {
      title: m.name,
      originalName: m.original_name,
      year: m.year,
      kkphimSlug: m.slug,
    });
  }
  return {
    items: normalized.items,
    totalPages: normalized.paginate?.total_page || 1,
    totalItems: normalized.paginate?.total_items || normalized.items.length,
  };
}

interface NguonCRawItem {
  name?: string;
  original_name?: string;
  slug?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number | string;
  current_episode?: string;
  total_episodes?: number;
  quality?: string;
  language?: string;
  time?: string;
  description?: string;
  director?: string;
  casts?: string;
  created?: string;
  modified?: string;
}

async function searchNguonC(keyword: string, page = 1): Promise<Movie[]> {
  const raw = await fetchJsonSafe<{
    status?: string;
    items?: NguonCRawItem[];
  }>(
    `${NGUONC_BASE}/films/search?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    2800
  );
  if (!raw || !Array.isArray(raw.items)) return [];

  return raw.items
    .filter((i) => i.slug && i.name)
    .map((i) => {
      const slug = i.slug!.trim();
      const thumb = i.thumb_url || i.poster_url || "";
      const poster = i.poster_url || i.thumb_url || "";
      rememberHint(slug, {
        title: i.name,
        originalName: i.original_name,
        year: i.year,
        nguoncSlug: slug,
      });
      return {
        name: i.name!,
        slug,
        original_name: i.original_name || "",
        thumb_url: thumb,
        poster_url: poster,
        created: i.created || "",
        modified: i.modified || "",
        description: i.description || "",
        total_episodes: i.total_episodes || 0,
        current_episode: normalizeEpisodeLabel(i.current_episode || ""),
        time: i.time || "",
        quality: i.quality || "HD",
        language: i.language || "Vietsub",
        director: i.director || "",
        casts: i.casts || "",
        year: i.year,
      };
    });
}

interface VsmovRawItem {
  name?: string;
  origin_name?: string;
  slug?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number | string;
  episode_current?: string;
  episode_total?: string | number;
  quality?: string;
  lang?: string;
  time?: string;
  content?: string;
  modified?: { time?: string } | string;
}

async function searchVsmov(keyword: string, page = 1, timeoutMs = 2600): Promise<Movie[]> {
  const raw = await fetchJsonSafe<{
    status?: boolean;
    items?: VsmovRawItem[];
    pathImage?: string;
  }>(
    `${VSMOV_BASE}/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    timeoutMs
  );
  if (!raw || !Array.isArray(raw.items)) return [];
  const imgBase = raw.pathImage || "https://vsmov.com";

  return raw.items
    .filter((i) => i.slug && i.name)
    .map((i) => {
      const slug = i.slug!.trim();
      const thumb = normalizeImageUrl(i.thumb_url, imgBase);
      const poster = normalizeImageUrl(i.poster_url, imgBase);
      const mod =
        typeof i.modified === "string"
          ? i.modified
          : i.modified?.time || "";
      rememberHint(slug, {
        title: i.name,
        originalName: i.origin_name,
        year: i.year,
        vsmovSlug: slug,
      });
      return {
        name: i.name!,
        slug,
        original_name: i.origin_name || "",
        thumb_url: thumb || poster,
        poster_url: poster || thumb,
        created: mod,
        modified: mod,
        description: i.content || "",
        total_episodes: parseInt(String(i.episode_total || "0").replace(/\D/g, ""), 10) || 0,
        current_episode: normalizeEpisodeLabel(i.episode_current || ""),
        time: i.time || "",
        quality: i.quality || "FHD",
        language: i.lang || "Vietsub",
        director: "",
        casts: "",
        year: i.year,
      };
    });
}

function unescapeRsc(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractBalancedObject(str: string, startBraceIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startBraceIdx; i < str.length; i++) {
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
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return str.slice(startBraceIdx, i + 1);
      }
    }
  }
  return null;
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

export async function searchChoPhim(keyword: string, timeoutMs = 2800): Promise<Movie[]> {
  const html = await fetchTextSafe(
    `${CHOPHIM_BASE}/tim-kiem?keyword=${encodeURIComponent(keyword)}`,
    timeoutMs,
    `${CHOPHIM_BASE}/`
  );
  if (!html) return [];

  const unesc = unescapeRsc(html);
  const items: Movie[] = [];
  const seen = new Set<string>();

  const markerRe = /"movie":\{"slug":"([a-z0-9-]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = markerRe.exec(unesc)) !== null) {
    const slug = match[1].trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;

    const braceStart = match.index + '"movie":'.length;
    const objStr = extractBalancedObject(unesc, braceStart);
    if (!objStr) continue;

    try {
      const obj = JSON.parse(objStr) as {
        slug?: string;
        name?: string;
        origin_name?: string;
        thumb_url?: string;
        poster_url?: string;
        year?: number | string;
        episode_current?: string;
        episode_total?: string | number;
        quality?: string;
        lang?: string;
        time?: string;
      };
      if (!obj.name || !obj.slug) continue;
      if (!matchesSearchKeyword(keyword, obj.name, obj.origin_name || "", slug)) continue;
      seen.add(slug);

      const thumb = normalizeImageUrl(obj.thumb_url, "https://phimimg.com");
      const poster = normalizeImageUrl(obj.poster_url, "https://phimimg.com");
      rememberHint(slug, {
        title: obj.name,
        originalName: obj.origin_name,
        year: obj.year,
        choPhimSlug: slug,
      });

      items.push({
        name: obj.name,
        slug,
        original_name: obj.origin_name || "",
        thumb_url: thumb || poster,
        poster_url: poster || thumb,
        created: "",
        modified: "",
        description: "",
        total_episodes: parseInt(String(obj.episode_total || "0").replace(/\D/g, ""), 10) || 0,
        current_episode: normalizeEpisodeLabel(obj.episode_current || ""),
        time: obj.time || "",
        quality: obj.quality || "HD",
        language: obj.lang || "Vietsub",
        director: "",
        casts: "",
        year: obj.year,
      });
    } catch {
      // Skip malformed chunk
    }
  }

  return items;
}

async function searchPhimHdcss(keyword: string, timeoutMs = 2800): Promise<Movie[]> {
  const html = await fetchTextSafe(
    `${PHIMHDCSS_BASE}/?search=${encodeURIComponent(keyword)}`,
    timeoutMs,
    `${PHIMHDCSS_BASE}/`
  );
  if (!html) return [];

  const items: Movie[] = [];
  const seen = new Set<string>();

  // Parse movie cards containing href="https://phimhdcss.com/{slug}-{id}"
  const cardRe =
    /<a\b[^>]*href="(https:\/\/phimhdcss\.com\/([a-z0-9-]+)-(\d+))"[^>]*>([\s\S]{0,1400}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const fullUrl = m[1];
    const cleanSlug = m[2].toLowerCase();
    const inner = m[4];
    if (!cleanSlug || seen.has(cleanSlug)) continue;

    const imgM =
      inner.match(/(?:data-src|data-original|data-lazy-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i) ||
      inner.match(/background-image\s*:\s*url\(['"]?(https?:\/\/[^'")]+)['"]?\)/i);
    const titleAttrM = m[0].match(/title="([^"]+)"/i);
    const hTitleM =
      inner.match(/class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)</i) ||
      inner.match(/alt="([^"]+)"/i);

    const rawTitle = decodeHtmlEntities(titleAttrM?.[1] || hTitleM?.[1] || "").trim();
    if (!rawTitle || rawTitle.length < 2) continue;

    // Exclude sidebar/trending/widget links that do not match the user's search query
    if (!matchesSearchKeyword(keyword, rawTitle, "", cleanSlug)) continue;

    const epM = inner.match(/(?:Tập\s*\d+(?:\/\d+)?|Full|Hoàn\s*tất[^<]*)/i);
    const yearM = inner.match(/\b(19\d{2}|20[0-3]\d)\b/);
    const imgUrl = imgM?.[1] || "";

    seen.add(cleanSlug);
    rememberHint(cleanSlug, {
      title: rawTitle,
      year: yearM?.[1],
      phimHdcssUrl: fullUrl,
    });

    items.push({
      name: rawTitle,
      slug: cleanSlug,
      original_name: "",
      thumb_url: imgUrl,
      poster_url: imgUrl,
      created: "",
      modified: "",
      description: "",
      total_episodes: 0,
      current_episode: normalizeEpisodeLabel(epM?.[0] || ""),
      time: "",
      quality: "HD",
      language: "Vietsub",
      director: "",
      casts: "",
      year: yearM?.[1] ? parseInt(yearM[1], 10) : undefined,
    });
  }

  return items.slice(0, 20);
}

// ============================================================================
// 2. SMART MERGE & DEDUPLICATION (TREATING ALL 6 DATASETS AS 1 CATALOG)
// ============================================================================

function mergeMovieLists(listsInPriorityOrder: Movie[][]): Movie[] {
  const bySlug = new Map<string, Movie>();
  const byFingerprint = new Map<string, string>(); // fingerprint -> canonical slug

  for (const list of listsInPriorityOrder) {
    for (const item of list) {
      if (!item || !item.slug || !item.name) continue;
      const slugKey = item.slug.trim().toLowerCase();
      const fp = buildDedupeFingerprint(item);

      const existingSlug = bySlug.has(slugKey)
        ? slugKey
        : fp
          ? byFingerprint.get(fp)
          : undefined;

      if (existingSlug && bySlug.has(existingSlug)) {
        // Enrich missing fields (poster, original_name, year, current_episode) without duplicating card
        const cur = bySlug.get(existingSlug)!;
        bySlug.set(existingSlug, {
          ...cur,
          original_name: cur.original_name || item.original_name,
          thumb_url: cur.thumb_url || item.thumb_url,
          poster_url: cur.poster_url || item.poster_url,
          year: cur.year || item.year,
          quality: cur.quality || item.quality,
          current_episode: cur.current_episode || item.current_episode,
        });
        // Cross-link hints so detail lookup knows alternate slugs across datasets
        const altHint = getSlugSourceHint(slugKey);
        if (altHint) {
          rememberHint(existingSlug, {
            phimHdcssUrl: altHint.phimHdcssUrl,
            choPhimSlug: altHint.choPhimSlug,
            vsmovSlug: altHint.vsmovSlug,
            nguoncSlug: altHint.nguoncSlug,
          });
        }
      } else {
        bySlug.set(slugKey, item);
        if (fp) byFingerprint.set(fp, slugKey);
      }
    }
  }

  return Array.from(bySlug.values());
}

/**
 * Unified Search across ALL 6 datasets (KKPhim1 + VSMOV + NguonC + ChoPhim + PhimHDCSS).
 * Returns deduplicated Movie[] with zero dataset branding on cards.
 */
export async function searchUnifiedCatalog(
  keyword: string,
  page = 1
): Promise<PaginatedResponse> {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return {
      status: "success",
      items: [],
      paginate: { current_page: 1, total_page: 1, total_items: 0, items_per_page: 24 },
    };
  }

  const cacheKey = `${trimmed.toLowerCase()}|${page}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // On page 1 query all 5 searchable catalogs in parallel; on deeper pages query paginated APIs
  const [kkRes, vsmovItems, nguoncItems, chophimItems, phimHdcssItems] =
    await Promise.all([
      searchKKPhim(trimmed, page),
      searchVsmov(trimmed, page),
      searchNguonC(trimmed, page),
      page === 1 ? searchChoPhim(trimmed) : Promise.resolve([]),
      page === 1 ? searchPhimHdcss(trimmed) : Promise.resolve([]),
    ]);

  const merged = mergeMovieLists([
    kkRes.items,
    vsmovItems,
    nguoncItems,
    chophimItems,
    phimHdcssItems,
  ]);

  // Rank exact / prefix title matches slightly higher while preserving natural catalog relevance
  const normQ = normalizeMatchText(trimmed);
  merged.sort((a, b) => {
    const scoreOf = (m: Movie): number => {
      const n = normalizeMatchText(m.name || "");
      const o = normalizeMatchText(m.original_name || "");
      let s = 0;
      if (n === normQ || o === normQ) s += 100;
      else if (n.startsWith(normQ) || o.startsWith(normQ)) s += 50;
      else if (n.includes(normQ) || o.includes(normQ)) s += 20;
      if (m.thumb_url || m.poster_url) s += 5;
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });

  const totalItems = Math.max(merged.length, kkRes.totalItems);
  const totalPages = Math.max(kkRes.totalPages, merged.length > 0 ? page : 1);

  const response: PaginatedResponse = {
    status: "success",
    items: merged,
    paginate: {
      current_page: page,
      total_page: totalPages,
      total_items: totalItems,
      items_per_page: Math.max(24, merged.length),
    },
  };

  if (searchCache.size > 300) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(cacheKey, { data: response, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  return response;
}

/**
 * Unified Latest Movies feed (merges KKPhim1 + VSMOV + NguonC newest releases seamlessly).
 */
export async function getUnifiedLatestMovies(page = 1): Promise<PaginatedResponse> {
  const cached = latestCache.get(page);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [kkRaw, vsmovRaw, nguoncRaw] = await Promise.all([
    fetchJsonSafe<KKPhimRawLatestResponse>(
      `${KKPHIM_BASE}/danh-sach/phim-moi-cap-nhat?page=${page}`,
      3500
    ),
    page <= 2
      ? fetchJsonSafe<{ status?: boolean; items?: VsmovRawItem[]; pathImage?: string }>(
          `${VSMOV_BASE}/danh-sach/phim-moi-cap-nhat?page=${page}`,
          2500
        )
      : Promise.resolve(null),
    page <= 2
      ? fetchJsonSafe<{ status?: string; items?: NguonCRawItem[] }>(
          `${NGUONC_BASE}/films/phim-moi-cap-nhat?page=${page}`,
          2500
        )
      : Promise.resolve(null),
  ]);

  const kkNorm = kkRaw
    ? kkphimCatalogAdapter.normalizeLatestResponse(kkRaw)
    : {
        status: "success",
        items: [],
        paginate: { current_page: page, total_page: 1, total_items: 0, items_per_page: 24 },
      };

  const vsmovImgBase = vsmovRaw?.pathImage || "https://vsmov.com";
  const vsmovItems: Movie[] = (vsmovRaw?.items || [])
    .filter((i) => i.slug && i.name)
    .slice(0, 12)
    .map((i) => {
      const slug = i.slug!.trim();
      const thumb = normalizeImageUrl(i.thumb_url, vsmovImgBase);
      const poster = normalizeImageUrl(i.poster_url, vsmovImgBase);
      rememberHint(slug, { title: i.name, originalName: i.origin_name, year: i.year, vsmovSlug: slug });
      return {
        name: i.name!,
        slug,
        original_name: i.origin_name || "",
        thumb_url: thumb || poster,
        poster_url: poster || thumb,
        created: "",
        modified: typeof i.modified === "string" ? i.modified : i.modified?.time || "",
        description: "",
        total_episodes: 0,
        current_episode: normalizeEpisodeLabel(i.episode_current || ""),
        time: i.time || "",
        quality: i.quality || "FHD",
        language: i.lang || "Vietsub",
        director: "",
        casts: "",
        year: i.year,
      };
    });

  const nguoncItems: Movie[] = (nguoncRaw?.items || [])
    .filter((i) => i.slug && i.name)
    .slice(0, 12)
    .map((i) => {
      const slug = i.slug!.trim();
      rememberHint(slug, { title: i.name, originalName: i.original_name, year: i.year, nguoncSlug: slug });
      return {
        name: i.name!,
        slug,
        original_name: i.original_name || "",
        thumb_url: i.thumb_url || i.poster_url || "",
        poster_url: i.poster_url || i.thumb_url || "",
        created: i.created || "",
        modified: i.modified || "",
        description: i.description || "",
        total_episodes: i.total_episodes || 0,
        current_episode: normalizeEpisodeLabel(i.current_episode || ""),
        time: i.time || "",
        quality: i.quality || "HD",
        language: i.language || "Vietsub",
        director: i.director || "",
        casts: i.casts || "",
        year: i.year,
      };
    });

  const merged = mergeMovieLists([kkNorm.items, vsmovItems, nguoncItems]);

  const response: PaginatedResponse = {
    status: "success",
    items: merged,
    paginate: {
      current_page: page,
      total_page: kkNorm.paginate?.total_page || 1,
      total_items: Math.max(merged.length, kkNorm.paginate?.total_items || 0),
      items_per_page: merged.length,
    },
  };

  latestCache.set(page, { data: response, expiresAt: Date.now() + LATEST_CACHE_TTL_MS });
  return response;
}

// ============================================================================
// 3. UNIFIED MOVIE DETAIL RESOLVER (ACROSS ALL 6 DATASETS!)
// ============================================================================

async function fetchDetailFromKKPhim(slug: string): Promise<MovieDetail | null> {
  const raw = await fetchJsonSafe<KKPhimRawDetailResponse>(
    `${KKPHIM_BASE}/phim/${encodeURIComponent(slug)}`,
    3500
  );
  if (!raw || !raw.movie || !raw.movie.name) return null;
  return kkphimCatalogAdapter.normalizeMovieDetail(raw.movie, raw.episodes || []);
}

async function fetchDetailFromVsmov(slug: string): Promise<MovieDetail | null> {
  const raw = await fetchJsonSafe<{
    status?: boolean;
    movie?: {
      _id?: string | number;
      name?: string;
      origin_name?: string;
      slug?: string;
      content?: string;
      type?: string;
      thumb_url?: string;
      poster_url?: string;
      year?: number | string;
      episode_current?: string;
      episode_total?: string | number;
      quality?: string;
      lang?: string;
      time?: string;
      director?: string[] | string;
      actor?: string[] | string;
      category?: Array<{ id?: string; name: string; slug: string }>;
      country?: Array<{ id?: string; name: string; slug: string }>;
      tmdb?: { id?: string | number; type?: string; season?: number; vote_average?: number };
      imdb?: { id?: string | null };
      modified?: { time?: string } | string;
    };
    episodes?: Array<{
      server_name?: string;
      server_data?: Array<{
        name?: string;
        slug?: string;
        link_embed?: string;
        link_m3u8?: string;
      }>;
    }>;
  }>(`${VSMOV_BASE}/phim/${encodeURIComponent(slug)}`, 3200);

  if (!raw?.status || !raw.movie?.name) return null;
  const m = raw.movie;
  const normalizedEpisodes: EpisodeServer[] = (raw.episodes || []).map((srv) => ({
    server_name: srv.server_name || "Vietsub",
    items: (srv.server_data || []).map((ep, idx) => ({
      name: normalizeEpisodeLabel(ep.name, ep.slug) || `Tập ${String(idx + 1).padStart(2, "0")}`,
      slug: ep.slug || `tap-${String(idx + 1).padStart(2, "0")}`,
      embed: ep.link_embed || ep.link_m3u8 || "",
      m3u8: ep.link_m3u8 || "",
    })),
  }));

  const thumb = normalizeImageUrl(m.thumb_url, "https://vsmov.com");
  const poster = normalizeImageUrl(m.poster_url, "https://vsmov.com");
  const dir = Array.isArray(m.director) ? m.director.join(", ") : m.director || "";
  const act = Array.isArray(m.actor) ? m.actor.join(", ") : m.actor || "";

  return {
    id: String(m._id || m.slug || slug),
    name: m.name || slug,
    slug: m.slug || slug,
    original_name: m.origin_name || "",
    thumb_url: thumb || poster,
    poster_url: poster || thumb,
    created: "",
    modified: typeof m.modified === "string" ? m.modified : m.modified?.time || "",
    description: m.content || "",
    total_episodes: parseInt(String(m.episode_total || "0").replace(/\D/g, ""), 10) || 0,
    current_episode: normalizeEpisodeLabel(m.episode_current || ""),
    time: m.time || "",
    quality: m.quality || "FHD",
    language: m.lang || "Vietsub",
    director: dir,
    casts: act,
    year: m.year,
    category: kkphimCatalogAdapter.buildCategoryDict(m.category, m.country, m.year, m.type),
    country: kkphimCatalogAdapter.normalizeCountries(m.country),
    episodes: normalizedEpisodes,
    imdb_id: m.imdb?.id || undefined,
    tmdb_id: m.tmdb?.id ? String(m.tmdb.id) : undefined,
  };
}

async function fetchDetailFromNguonC(slug: string): Promise<MovieDetail | null> {
  const raw = await fetchJsonSafe<{
    status?: string;
    movie?: MovieDetail;
  }>(`${NGUONC_BASE}/film/${encodeURIComponent(slug)}`, 3200);
  if (!raw?.movie?.name) return null;
  const movie = raw.movie;
  const normalizedEpisodes: EpisodeServer[] = (movie.episodes || []).map((srv) => ({
    server_name: srv.server_name || "Vietsub",
    items: (srv.items || []).map((ep, idx) => ({
      name: normalizeEpisodeLabel(ep.name, ep.slug) || `Tập ${String(idx + 1).padStart(2, "0")}`,
      slug: ep.slug || `tap-${String(idx + 1).padStart(2, "0")}`,
      embed: ep.embed || ep.m3u8 || "",
      m3u8: ep.m3u8 || "",
    })),
  }));
  return {
    ...movie,
    slug: movie.slug || slug,
    current_episode: normalizeEpisodeLabel(movie.current_episode || ""),
    episodes: normalizedEpisodes,
  };
}

async function fetchDetailFromChoPhim(slug: string): Promise<MovieDetail | null> {
  const html = await fetchTextSafe(
    `${CHOPHIM_BASE}/xem/${encodeURIComponent(slug)}`,
    3500,
    `${CHOPHIM_BASE}/`
  );
  if (!html) return null;

  const unesc = unescapeRsc(html);

  // Extract movie metadata object if present
  let movieMeta: Record<string, unknown> | null = null;
  const metaMatch = new RegExp(`"slug":"${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).exec(unesc);
  if (metaMatch) {
    // Walk backwards to nearest '{'
    let start = metaMatch.index;
    while (start > 0 && unesc[start] !== "{") start--;
    const objStr = extractBalancedObject(unesc, start);
    if (objStr) {
      try {
        movieMeta = JSON.parse(objStr) as Record<string, unknown>;
      } catch {
        // ignore
      }
    }
  }

  // Extract episode groups
  const servers: EpisodeServer[] = [];
  const seenSrv = new Set<string>();
  const srvRe = /"server_name"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = srvRe.exec(unesc)) !== null) {
    const serverName = m[1].trim();
    if (!serverName || seenSrv.has(serverName)) continue;
    const win = unesc.slice(m.index, m.index + 80000);
    const dataIdx = win.indexOf('"server_data":[');
    if (dataIdx === -1 || dataIdx > 600) continue;
    const arrStr = extractBalancedArray(unesc, m.index + dataIdx + '"server_data":'.length);
    if (!arrStr) continue;
    try {
      const items = JSON.parse(arrStr) as Array<{
        name?: string;
        slug?: string;
        link_m3u8?: string;
        link_embed?: string;
      }>;
      if (Array.isArray(items) && items.length > 0) {
        seenSrv.add(serverName);
        servers.push({
          server_name: serverName,
          items: items.map((ep, idx) => ({
            name: normalizeEpisodeLabel(ep.name, ep.slug) || `Tập ${String(idx + 1).padStart(2, "0")}`,
            slug: ep.slug || `tap-${String(idx + 1).padStart(2, "0")}`,
            embed: ep.link_embed || ep.link_m3u8 || "",
            m3u8: ep.link_m3u8 || "",
          })),
        });
      }
    } catch {
      // ignore
    }
  }

  if (servers.length === 0) return null;

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const fallbackName = (titleMatch?.[1] || slug)
    .replace(/\s*[-|•].*$/, "")
    .replace(/^Xem\s+phim\s+/i, "")
    .trim();

  const name = String(movieMeta?.name || fallbackName || slug);
  const origName = String(movieMeta?.origin_name || "");
  const thumb = normalizeImageUrl(String(movieMeta?.thumb_url || ""), "https://phimimg.com");
  const poster = normalizeImageUrl(String(movieMeta?.poster_url || ""), "https://phimimg.com");
  const year = (movieMeta?.year as string | number | undefined) || "";
  const categoryDict: CategoryDict = kkphimCatalogAdapter.buildCategoryDict(
    movieMeta?.category as Array<{ id?: string; name: string; slug: string }> | undefined,
    movieMeta?.country as Array<{ id?: string; name: string; slug: string }> | undefined,
    year,
    movieMeta?.type ? String(movieMeta.type) : undefined
  );

  return {
    id: slug,
    name,
    slug,
    original_name: origName,
    thumb_url: thumb || poster,
    poster_url: poster || thumb,
    created: "",
    modified: "",
    description: String(movieMeta?.content || ""),
    total_episodes: servers[0]?.items.length || 0,
    current_episode: normalizeEpisodeLabel(String(movieMeta?.episode_current || "")),
    time: String(movieMeta?.time || ""),
    quality: String(movieMeta?.quality || "FHD"),
    language: String(movieMeta?.lang || "Vietsub"),
    director: Array.isArray(movieMeta?.director) ? (movieMeta.director as string[]).join(", ") : "",
    casts: Array.isArray(movieMeta?.actor) ? (movieMeta.actor as string[]).join(", ") : "",
    year,
    category: categoryDict,
    episodes: servers,
  };
}

async function fetchDetailFromPhimHdcss(slug: string): Promise<MovieDetail | null> {
  const hint = getSlugSourceHint(slug);
  let detailUrl = hint?.phimHdcssUrl || "";

  if (!detailUrl) {
    const query = (hint?.title || slug.replace(/-/g, " ")).trim();
    const searchHtml = await fetchTextSafe(
      `${PHIMHDCSS_BASE}/?search=${encodeURIComponent(query)}`,
      3000,
      `${PHIMHDCSS_BASE}/`
    );
    if (!searchHtml) return null;

    const targetSlug = normalizeSlugKey(slug);
    const matches = [
      ...searchHtml.matchAll(/href="(https:\/\/phimhdcss\.com\/([a-z0-9-]+)-(\d+))"/gi),
    ].map((m) => ({ url: m[1], linkSlug: m[2].toLowerCase() }));

    const exact =
      matches.find((m) => m.linkSlug === targetSlug) ||
      matches.find(
        (m) => m.linkSlug.startsWith(targetSlug) || targetSlug.startsWith(m.linkSlug)
      );
    if (!exact) return null;
    detailUrl = exact.url;
    rememberHint(slug, { phimHdcssUrl: detailUrl });
  }

  const detailHtml = await fetchTextSafe(detailUrl, 3200, `${PHIMHDCSS_BASE}/`);
  if (!detailHtml) return null;

  const epLinks = [
    ...new Set(
      [
        ...detailHtml.matchAll(
          /href="(https:\/\/phimhdcss\.com\/[a-z0-9-]+\/(?:tap-[^"'\s]+|full[^"'\s]*))"/gi
        ),
      ].map((m) => m[1])
    ),
  ];
  if (epLinks.length === 0) return null;

  const h1Match = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle = detailHtml.match(/property="og:title"\s+content="([^"]+)"/i);
  const ogDesc = detailHtml.match(/property="og:description"\s+content="([^"]+)"/i);
  const ogImg = detailHtml.match(/property="og:image"\s+content="([^"]+)"/i);

  const name = decodeHtmlEntities(
    (h1Match?.[1] || ogTitle?.[1] || hint?.title || slug).replace(/<[^>]+>/g, "")
  ).trim();
  const poster = ogImg?.[1] || "";

  // Sort episodes numerically
  const parsedEps = epLinks
    .map((u, idx) => {
      const tapM = u.match(/\/tap-0*(\d+)-\d+$/i);
      const isFull = /\/full(?:-\d+)?$/i.test(u);
      const num = tapM ? parseInt(tapM[1], 10) : isFull ? 1 : idx + 1;
      const epSlug = isFull ? "full" : `tap-${num}`;
      const epName = isFull ? "Full" : `Tập ${String(num).padStart(2, "0")}`;
      return { num, epSlug, epName, url: u };
    })
    .sort((a, b) => a.num - b.num);

  // Deduplicate by epSlug
  const uniqueEps: Array<{ name: string; slug: string; embed: string; m3u8: string }> = [];
  const seenEp = new Set<string>();
  for (const e of parsedEps) {
    if (seenEp.has(e.epSlug)) continue;
    seenEp.add(e.epSlug);
    uniqueEps.push({
      name: e.epName,
      slug: e.epSlug,
      embed: e.url,
      m3u8: "",
    });
  }

  return {
    id: slug,
    name: name || slug,
    slug,
    original_name: hint?.originalName || "",
    thumb_url: poster,
    poster_url: poster,
    created: "",
    modified: "",
    description: decodeHtmlEntities(ogDesc?.[1] || ""),
    total_episodes: uniqueEps.length,
    current_episode: uniqueEps[uniqueEps.length - 1]?.name || "Full",
    time: "",
    quality: "FHD",
    language: "Vietsub",
    director: "",
    casts: "",
    year: hint?.year || "",
    category: kkphimCatalogAdapter.buildCategoryDict([], [], hint?.year),
    episodes: [{ server_name: "Vietsub", items: uniqueEps }],
  };
}

/**
 * Resolves full MovieDetail seamlessly across ALL datasets:
 * KKPhim1 (primary) -> parallel fallback to VSMOV, NguonC, ChoPhim, PhimHDCSS.
 */
export async function getUnifiedMovieDetail(
  slug: string
): Promise<MovieDetailResponse | null> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;

  const cached = detailCache.get(cleanSlug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 1. Fast primary check on KKPhim1
  const kkDetail = await fetchDetailFromKKPhim(cleanSlug);
  if (kkDetail && kkDetail.episodes && kkDetail.episodes.length > 0) {
    const res: MovieDetailResponse = { status: "success", movie: kkDetail };
    detailCache.set(cleanSlug, { data: res, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });
    return res;
  }

  // 2. Parallel fallback across VSMOV, NguonC, ChoPhim, and PhimHDCSS!
  const hint = getSlugSourceHint(cleanSlug);
  const [vsmovDetail, nguoncDetail, choPhimDetail, phimHdcssDetail] = await Promise.all([
    fetchDetailFromVsmov(hint?.vsmovSlug || cleanSlug),
    fetchDetailFromNguonC(hint?.nguoncSlug || cleanSlug),
    fetchDetailFromChoPhim(hint?.choPhimSlug || cleanSlug),
    fetchDetailFromPhimHdcss(cleanSlug),
  ]);

  const best =
    [vsmovDetail, nguoncDetail, choPhimDetail, phimHdcssDetail, kkDetail].find(
      (d) => d && d.episodes && d.episodes.length > 0
    ) ||
    vsmovDetail ||
    nguoncDetail ||
    choPhimDetail ||
    phimHdcssDetail ||
    kkDetail;

  if (!best) return null;

  // Ensure slug stays canonical to what was requested so routes/history stay consistent
  const normalizedBest: MovieDetail = {
    ...best,
    slug: cleanSlug,
  };
  const res: MovieDetailResponse = { status: "success", movie: normalizedBest };
  if (detailCache.size > 400) {
    const oldest = detailCache.keys().next().value;
    if (oldest) detailCache.delete(oldest);
  }
  detailCache.set(cleanSlug, { data: res, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });
  return res;
}

// ============================================================================
// 4. UNIFIED 6-DATASET TITLE MATCHER (FOR DOUBAN, NETFLIX, VÂN HỢP, KHỐC VÂN)
// ============================================================================

function findBestCandidateMatch(
  candidates: Movie[],
  cleanedTitle: string,
  rawTitle?: string,
  allowSingleCjkFallback = false
): Movie | null {
  if (candidates.length === 0) return null;
  const targetNorm = normalizeMatchText(cleanedTitle);
  const rawNorm = rawTitle ? normalizeMatchText(rawTitle) : targetNorm;
  const targetTokens = targetNorm.split(" ").filter((t) => t.length >= 2);
  const isCjkQuery = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(cleanedTitle);

  // 1. Exact normalized match on name or original_name
  const exact = candidates.find((c) => {
    const cn = normalizeMatchText(c.name || "");
    const co = normalizeMatchText(c.original_name || "");
    return (
      cn === targetNorm ||
      co === targetNorm ||
      cn === rawNorm ||
      co === rawNorm
    );
  });
  if (exact) return exact;

  // 2. Containment / token overlap match
  const partial = candidates.find((c) => {
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
  });
  if (partial) return partial;

  // 3. CJK alias trust (KKPhim/VSMOV/NguonC index Chinese/Korean/Japanese original titles
  //    even when returned `name` is Vietnamese & `origin_name` is English)
  if (allowSingleCjkFallback && isCjkQuery && candidates.length <= 4) {
    const withPoster = candidates.find((c) => Boolean(c.thumb_url || c.poster_url));
    return withPoster || candidates[0];
  }

  return null;
}

/**
 * Matches an external title (Chinese, English, Korean, Japanese, Vietnamese)
 * across ALL 6 datasets (KKPhim1 -> VSMOV + NguonC + ChoPhim + PhimHDCSS).
 */
export async function matchTitleAcrossAllDatasets(
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
  if (cleanedTitle.includes("：")) {
    const beforeColon = cleanedTitle.split("：")[0].trim();
    if (beforeColon.length >= 2 && beforeColon !== cleanedTitle) {
      queries.push(beforeColon);
    }
  }

  let matched: Movie | null = null;
  const isPureCjk = /^[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\s0-9：:·\-—]+$/.test(cleanedTitle);

  for (const q of queries) {
    // Tier 1: Fast parallel JSON API search across KKPhim1, VSMOV, and NguonC
    const [kkRes, vsmovItems, nguoncItems] = await Promise.all([
      searchKKPhim(q, 1),
      searchVsmov(q, 1, 1800),
      searchNguonC(q, 1),
    ]);

    matched =
      findBestCandidateMatch(kkRes.items.slice(0, 8), cleanedTitle, rawTitle, true) ||
      findBestCandidateMatch(vsmovItems.slice(0, 6), cleanedTitle, rawTitle, true) ||
      findBestCandidateMatch(nguoncItems.slice(0, 6), cleanedTitle, rawTitle, true);
    if (matched) break;

    // Tier 2: Secondary HTML dataset search (ChoPhim + PhimHDCSS) only if JSON APIs missed
    const [choPhimItems, phimHdcssItems] = await Promise.all([
      searchChoPhim(q, 1200),
      isPureCjk ? Promise.resolve([]) : searchPhimHdcss(q, 1400),
    ]);

    matched =
      findBestCandidateMatch(choPhimItems.slice(0, 6), cleanedTitle, rawTitle, true) ||
      findBestCandidateMatch(phimHdcssItems.slice(0, 6), cleanedTitle, rawTitle, false);

    if (matched) break;
  }

  // Ensure matched item has a valid slug and poster
  const finalMovie =
    matched && matched.slug && (matched.thumb_url || matched.poster_url)
      ? {
          ...matched,
          current_episode: normalizeEpisodeLabel(matched.current_episode),
        }
      : null;

  if (titleMatchCache.size > 1500) {
    const oldest = titleMatchCache.keys().next().value;
    if (oldest) titleMatchCache.delete(oldest);
  }
  titleMatchCache.set(key, {
    movie: finalMovie,
    expiresAt: Date.now() + MATCH_CACHE_TTL_MS,
  });
  return finalMovie;
}
