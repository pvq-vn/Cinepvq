"use client";

import type {
  UserProfile,
  FavoriteMovie,
  WatchlistItem,
  WatchHistoryItem,
  AppNotification,
  AppSettings,
  Movie,
  MovieDetail,
} from "@/types/movie";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEpisodeLabel } from "@/lib/format";

const KEYS = {
  USER: "cinepvq_user",
  FAVORITES: "cinepvq_favorites",
  WATCHLIST: "cinepvq_watchlist",
  HISTORY: "cinepvq_history",
  EPISODE_PROGRESS: "cinepvq_episode_progress",
  NOTIFICATIONS: "cinepvq_notifications",
  SETTINGS: "cinepvq_settings",
};

const SOLE_ADMIN_EMAIL = "vanquyetp823@gmail.com";

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  autoPlay: true,
  soundEnabled: true,
  preferredQuality: "auto",
  playbackSpeed: 1,
  preferredSource: "auto",
  skipSeconds: 10,
};

// Initial welcome notifications
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-welcome",
    title: "Chào mừng đến với Cinépvq! 🎬",
    message: "Khám phá kho phim điện ảnh, phim bộ và anime phong phú miễn phí.",
    time: "Hôm nay",
    read: false,
    link: "/",
  },
  {
    id: "notif-trending",
    title: "Bảng xếp hạng Thịnh hành",
    message: "Xem ngay top những bộ phim được khán giả quan tâm nhất tuần này.",
    time: "Mới đây",
    read: false,
    link: "/thinh-hanh",
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ─── High-Performance In-Memory Storage Cache ───────────────────────────────
// Eliminates thousands of synchronous localStorage.getItem + JSON.parse calls
// when hundreds of MovieCards mount or scroll into view.
const rawStorageCache = new Map<string, unknown>();
const derivedCache = new Map<string, unknown>();

function invalidateMemoryCaches(specificKey?: string) {
  if (specificKey) {
    rawStorageCache.delete(specificKey);
  } else {
    rawStorageCache.clear();
  }
  derivedCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", () => {
    invalidateMemoryCaches();
  });
}

function safeGetItem<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  if (rawStorageCache.has(key)) {
    return rawStorageCache.get(key) as T;
  }
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T) : fallback;
    rawStorageCache.set(key, parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    rawStorageCache.set(key, value);
    derivedCache.clear();
    localStorage.setItem(key, JSON.stringify(value));
    // Dispatch custom event to sync across components and hooks
    window.dispatchEvent(new Event("cinepvq_storage_update"));
  } catch (err) {
    console.warn("Error saving to localStorage", err);
  }
}

/**
 * Gets the current active user ID to namespace all local caches.
 * Prevents any cross-user data leakage when switching accounts.
 */
export function getActiveUserId(): string {
  if (!isBrowser()) return "guest";
  const user = safeGetItem<UserProfile | null>(KEYS.USER, null);
  return user?.id || "guest";
}

/**
 * Produces a strictly user-scoped localStorage key.
 * e.g. "cinepvq_favorites_ab4cfd10-af3f-4d78-9229-b9774679c391"
 */
function getUserStorageKey(baseKey: string, explicitUserId?: string): string {
  const uid = explicitUserId || getActiveUserId();
  return `${baseKey}_${uid}`;
}

function enrichUserRole(user: UserProfile): UserProfile {
  const isAdmin = user.email?.toLowerCase() === SOLE_ADMIN_EMAIL;
  return {
    ...user,
    role: isAdmin ? "admin" : (user.role || "user"),
  };
}

/**
 * Safely migrate legacy un-namespaced items for the original legacy user only once.
 * Brand new users will never inherit un-namespaced legacy items.
 */
function migrateLegacyStorageIfNeeded(userId: string, email?: string) {
  if (!isBrowser() || !userId || userId === "guest") return;
  try {
    const userFavKey = getUserStorageKey(KEYS.FAVORITES, userId);
    const legacyFavs = localStorage.getItem(KEYS.FAVORITES);
    const userHasFavs = localStorage.getItem(userFavKey);

    if (!userHasFavs && legacyFavs) {
      const isLegacyMigrated = localStorage.getItem(
        `cinepvq_migrated_${email?.toLowerCase()}`
      );
      if (isLegacyMigrated) {
        localStorage.setItem(userFavKey, legacyFavs);
        localStorage.removeItem(KEYS.FAVORITES);
        invalidateMemoryCaches();
      }
    }

    const userHistKey = getUserStorageKey(KEYS.HISTORY, userId);
    const legacyHist = localStorage.getItem(KEYS.HISTORY);
    const userHasHist = localStorage.getItem(userHistKey);

    if (!userHasHist && legacyHist) {
      const isLegacyMigrated = localStorage.getItem(
        `cinepvq_migrated_${email?.toLowerCase()}`
      );
      if (isLegacyMigrated) {
        localStorage.setItem(userHistKey, legacyHist);
        localStorage.removeItem(KEYS.HISTORY);
        invalidateMemoryCaches();
      }
    }
  } catch (err) {
    console.warn("Error migrating legacy storage", err);
  }
}

/**
 * Migrates local guest data (favorites, history, progress) into authenticated user storage.
 * Ensures that guests who add items before logging in keep 100% of their data without duplicates.
 */
export function migrateGuestDataToUser(userId: string) {
  if (!isBrowser() || !userId || userId === "guest") return;
  try {
    const guestFavKey = getUserStorageKey(KEYS.FAVORITES, "guest");
    const userFavKey = getUserStorageKey(KEYS.FAVORITES, userId);
    const guestFavs = safeGetItem<FavoriteMovie[]>(guestFavKey, []);
    const userFavs = safeGetItem<FavoriteMovie[]>(userFavKey, []);

    if (guestFavs.length > 0) {
      const mergedMap = new Map<string, FavoriteMovie>();
      userFavs.forEach((f) => mergedMap.set(f.slug, f));
      guestFavs.forEach((f) => {
        if (!mergedMap.has(f.slug)) {
          mergedMap.set(f.slug, f);
        }
      });
      safeSetItem(userFavKey, Array.from(mergedMap.values()));
      localStorage.removeItem(guestFavKey);
      invalidateMemoryCaches(guestFavKey);
    }

    const guestHistKey = getUserStorageKey(KEYS.HISTORY, "guest");
    const userHistKey = getUserStorageKey(KEYS.HISTORY, userId);
    const guestHist = safeGetItem<WatchHistoryItem[]>(guestHistKey, []);
    const userHist = safeGetItem<WatchHistoryItem[]>(userHistKey, []);

    if (guestHist.length > 0) {
      const mergedMap = new Map<string, WatchHistoryItem>();
      guestHist.forEach((h) => mergedMap.set(h.slug, h));
      userHist.forEach((h) => {
        if (!mergedMap.has(h.slug)) {
          mergedMap.set(h.slug, h);
        } else {
          const existing = mergedMap.get(h.slug)!;
          const timeH = h.updatedAt ? new Date(h.updatedAt).getTime() : 0;
          const timeExisting = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          if (timeH > timeExisting) {
            mergedMap.set(h.slug, h);
          }
        }
      });
      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      safeSetItem(userHistKey, mergedList.slice(0, 50));
      localStorage.removeItem(guestHistKey);
      invalidateMemoryCaches(guestHistKey);
    }

    const guestProgKey = getUserStorageKey(KEYS.EPISODE_PROGRESS, "guest");
    const userProgKey = getUserStorageKey(KEYS.EPISODE_PROGRESS, userId);
    const guestProg = safeGetItem<Record<string, { currentTime: number; duration: number; updatedAt: string }>>(guestProgKey, {});
    const userProg = safeGetItem<Record<string, { currentTime: number; duration: number; updatedAt: string }>>(userProgKey, {});

    if (Object.keys(guestProg).length > 0) {
      const mergedProg = { ...guestProg, ...userProg };
      safeSetItem(userProgKey, mergedProg);
      localStorage.removeItem(guestProgKey);
      invalidateMemoryCaches(guestProgKey);
    }

    const guestWatchlistKey = getUserStorageKey(KEYS.WATCHLIST, "guest");
    const userWatchlistKey = getUserStorageKey(KEYS.WATCHLIST, userId);
    const guestWatchlist = safeGetItem<WatchlistItem[]>(guestWatchlistKey, []);
    const userWatchlist = safeGetItem<WatchlistItem[]>(userWatchlistKey, []);

    if (guestWatchlist.length > 0) {
      const mergedMap = new Map<string, WatchlistItem>();
      userWatchlist.forEach((w) => mergedMap.set(w.slug, w));
      guestWatchlist.forEach((w) => {
        if (!mergedMap.has(w.slug)) {
          mergedMap.set(w.slug, w);
        } else {
          const existing = mergedMap.get(w.slug)!;
          const timeW = w.addedAt ? new Date(w.addedAt).getTime() : 0;
          const timeExisting = existing.addedAt ? new Date(existing.addedAt).getTime() : 0;
          if (timeW > timeExisting) {
            mergedMap.set(w.slug, w);
          }
        }
      });
      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return timeB - timeA;
      });
      safeSetItem(userWatchlistKey, mergedList.slice(0, 100));
      localStorage.removeItem(guestWatchlistKey);
      invalidateMemoryCaches(guestWatchlistKey);
    }

    const guestSettingsKey = getUserStorageKey(KEYS.SETTINGS, "guest");
    const userSettingsKey = getUserStorageKey(KEYS.SETTINGS, userId);
    const guestSettings = safeGetItem<AppSettings | null>(guestSettingsKey, null);
    const userSettings = safeGetItem<AppSettings | null>(userSettingsKey, null);
    if (guestSettings) {
      if (!userSettings) {
        safeSetItem(userSettingsKey, guestSettings);
      }
      localStorage.removeItem(guestSettingsKey);
      invalidateMemoryCaches(guestSettingsKey);
    }
  } catch (err) {
    console.warn("[UserStore] Error migrating guest data to user", err);
  }
}

// ─── Favorites Repository (Strictly User-Scoped, O(1) Lookup) ──────────────

export const favoritesStore = {
  getAll(): FavoriteMovie[] {
    const key = getUserStorageKey(KEYS.FAVORITES);
    const derivedKey = `fav_list_${key}`;
    if (derivedCache.has(derivedKey)) {
      return derivedCache.get(derivedKey) as FavoriteMovie[];
    }
    const items = safeGetItem<FavoriteMovie[]>(key, []).map((item) => ({
      ...item,
      current_episode: item.current_episode ? normalizeEpisodeLabel(item.current_episode) : item.current_episode,
    }));
    derivedCache.set(derivedKey, items);
    return items;
  },

  isFavorite(slug: string): boolean {
    if (!slug) return false;
    const key = getUserStorageKey(KEYS.FAVORITES);
    const setKey = `fav_set_${key}`;
    let slugSet = derivedCache.get(setKey) as Set<string> | undefined;
    if (!slugSet) {
      slugSet = new Set(this.getAll().map((item) => item.slug));
      derivedCache.set(setKey, slugSet);
    }
    return slugSet.has(slug);
  },

  toggle(movie: Movie | MovieDetail | FavoriteMovie): boolean {
    const key = getUserStorageKey(KEYS.FAVORITES);
    const items = [...this.getAll()];
    const existingIndex = items.findIndex((item) => item.slug === movie.slug);

    if (existingIndex >= 0) {
      items.splice(existingIndex, 1);
      safeSetItem(key, items);
      return false; // Removed
    } else {
      const newItem: FavoriteMovie = {
        slug: movie.slug,
        name: movie.name,
        original_name: movie.original_name,
        thumb_url: movie.thumb_url,
        quality: movie.quality,
        current_episode: movie.current_episode ? normalizeEpisodeLabel(movie.current_episode) : undefined,
        addedAt: new Date().toISOString(),
      };
      items.unshift(newItem);
      safeSetItem(key, items);
      return true; // Added
    }
  },

  remove(slug: string): void {
    const key = getUserStorageKey(KEYS.FAVORITES);
    const items = this.getAll().filter((item) => item.slug !== slug);
    safeSetItem(key, items);
  },

  setAll(items: FavoriteMovie[]): void {
    const key = getUserStorageKey(KEYS.FAVORITES);
    safeSetItem(key, items);
  },

  clearForCurrentUser(): void {
    const key = getUserStorageKey(KEYS.FAVORITES);
    safeSetItem(key, []);
  },
};

// ─── Watchlist Repository (Strictly User-Scoped, O(1) Lookup) ──────────────

export const watchlistStore = {
  getAll(): WatchlistItem[] {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const derivedKey = `wl_list_${key}`;
    if (derivedCache.has(derivedKey)) {
      return derivedCache.get(derivedKey) as WatchlistItem[];
    }
    const raw = safeGetItem<WatchlistItem[]>(key, []);
    const sorted = raw
      .filter((item) => Boolean(item && item.slug))
      .map((item) => ({
        ...item,
        current_episode: item.current_episode ? normalizeEpisodeLabel(item.current_episode) : item.current_episode,
      }))
      .sort((a, b) => {
        const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 100);
    derivedCache.set(derivedKey, sorted);
    return sorted;
  },

  isWatchlist(slug: string): boolean {
    if (!slug) return false;
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const setKey = `wl_set_${key}`;
    let slugSet = derivedCache.get(setKey) as Set<string> | undefined;
    if (!slugSet) {
      slugSet = new Set(this.getAll().map((item) => item.slug));
      derivedCache.set(setKey, slugSet);
    }
    return slugSet.has(slug);
  },

  add(movie: Movie | MovieDetail | WatchlistItem | FavoriteMovie): boolean {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const items = this.getAll().filter((item) => item.slug !== movie.slug);

    const yearVal = "year" in movie ? movie.year : undefined;
    const typeVal =
      "type" in movie && typeof (movie as { type?: unknown }).type === "string"
        ? (movie as { type: string }).type
        : undefined;
    const posterVal = "poster_url" in movie ? movie.poster_url : undefined;
    const addedAtVal =
      "addedAt" in movie && typeof movie.addedAt === "string" && movie.addedAt
        ? movie.addedAt
        : new Date().toISOString();

    const newItem: WatchlistItem = {
      slug: movie.slug,
      name: movie.name,
      original_name: movie.original_name,
      thumb_url: movie.thumb_url,
      poster_url: posterVal,
      year: yearVal,
      quality: movie.quality,
      current_episode: movie.current_episode ? normalizeEpisodeLabel(movie.current_episode) : undefined,
      type: typeVal,
      addedAt: addedAtVal,
    };

    items.unshift(newItem);
    const capped = items.slice(0, 100);
    safeSetItem(key, capped);
    return true;
  },

  remove(slug: string): void {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const items = this.getAll().filter((item) => item.slug !== slug);
    safeSetItem(key, items);
  },

  toggle(movie: Movie | MovieDetail | WatchlistItem | FavoriteMovie): boolean {
    if (this.isWatchlist(movie.slug)) {
      this.remove(movie.slug);
      return false; // Removed
    } else {
      this.add(movie);
      return true; // Added
    }
  },

  clear(): void {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    safeSetItem(key, []);
  },

  setAll(items: WatchlistItem[]): void {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const dedupMap = new Map<string, WatchlistItem>();
    items.forEach((item) => {
      if (item && item.slug) {
        if (!dedupMap.has(item.slug)) {
          dedupMap.set(item.slug, item);
        } else {
          const existing = dedupMap.get(item.slug)!;
          const timeItem = item.addedAt ? new Date(item.addedAt).getTime() : 0;
          const timeExisting = existing.addedAt ? new Date(existing.addedAt).getTime() : 0;
          if (timeItem > timeExisting) {
            dedupMap.set(item.slug, item);
          }
        }
      }
    });
    const sorted = Array.from(dedupMap.values())
      .sort((a, b) => {
        const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 100);
    safeSetItem(key, sorted);
  },
};

// ─── Watch History Repository (Strictly User-Scoped) ───────────────────────

export const historyStore = {
  getAll(): WatchHistoryItem[] {
    const key = getUserStorageKey(KEYS.HISTORY);
    const derivedKey = `hist_list_${key}`;
    if (derivedCache.has(derivedKey)) {
      return derivedCache.get(derivedKey) as WatchHistoryItem[];
    }
    const raw = safeGetItem<WatchHistoryItem[]>(key, []);
    const sorted = raw
      .filter((item) => Boolean(item && item.slug))
      .map((item) => ({
        ...item,
        episodeName: normalizeEpisodeLabel(item.episodeName, item.episodeSlug) || item.episodeName,
      }))
      .sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
    derivedCache.set(derivedKey, sorted);
    return sorted;
  },

  add(
    movie: { slug: string; name: string; original_name?: string; thumb_url: string },
    episode?: { slug: string; name: string; season?: number },
    currentTime?: number,
    duration?: number,
    season?: number
  ): void {
    const key = getUserStorageKey(KEYS.HISTORY);
    const items = this.getAll();
    const existing = items.find((item) => item.slug === movie.slug) || null;

    const targetEpSlug = episode?.slug || existing?.episodeSlug;
    const isSameEpisode = Boolean(existing && targetEpSlug && existing.episodeSlug === targetEpSlug);
    const epSeason = season || episode?.season || 1;

    // Determine accurate currentTime for this specific episode:
    // Never carry over existing.currentTime when switching to a DIFFERENT episode!
    let resolvedCurrentTime = 0;
    if (typeof currentTime === "number" && currentTime > 0) {
      resolvedCurrentTime = Math.floor(currentTime);
    } else if (isSameEpisode && existing?.currentTime && existing.currentTime > 0) {
      resolvedCurrentTime = existing.currentTime;
    } else if (targetEpSlug) {
      resolvedCurrentTime = episodeProgressStore.get(movie.slug, targetEpSlug, epSeason) || 0;
    }

    const resolvedDuration =
      typeof duration === "number" && duration > 0
        ? Math.floor(duration)
        : isSameEpisode
        ? existing?.duration
        : undefined;

    const cleanEpisodeName = normalizeEpisodeLabel(
      episode?.name || (isSameEpisode ? existing?.episodeName : undefined),
      targetEpSlug
    );

    const record: WatchHistoryItem = {
      slug: movie.slug,
      name: movie.name,
      original_name: movie.original_name,
      thumb_url: movie.thumb_url,
      episodeSlug: targetEpSlug,
      episodeName: cleanEpisodeName || undefined,
      currentTime: resolvedCurrentTime,
      duration: resolvedDuration,
      updatedAt: new Date().toISOString(),
    };

    const remaining = items.filter((item) => item.slug !== movie.slug);
    remaining.unshift(record);

    const finalItems = remaining.slice(0, 50);
    safeSetItem(key, finalItems);

    // Persist discrete per-episode progress when currentTime > 0
    if (episode?.slug && typeof currentTime === "number" && currentTime > 0) {
      episodeProgressStore.save(movie.slug, episode.slug, epSeason, currentTime, duration || 0);
    }
  },

  remove(slug: string): void {
    const key = getUserStorageKey(KEYS.HISTORY);
    const items = this.getAll().filter((item) => item.slug !== slug);
    safeSetItem(key, items);
  },

  clear(): void {
    const key = getUserStorageKey(KEYS.HISTORY);
    safeSetItem(key, []);
  },

  setAll(items: WatchHistoryItem[]): void {
    const key = getUserStorageKey(KEYS.HISTORY);
    const map = new Map<string, WatchHistoryItem>();
    for (const rawItem of items) {
      if (!rawItem || !rawItem.slug) continue;
      const item: WatchHistoryItem = {
        ...rawItem,
        episodeName: normalizeEpisodeLabel(rawItem.episodeName, rawItem.episodeSlug) || rawItem.episodeName,
      };
      const existing = map.get(item.slug);
      if (!existing) {
        map.set(item.slug, item);
      } else {
        const timeExisting = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const timeItem = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        if (timeItem >= timeExisting) {
          map.set(item.slug, item);
        }
      }
    }
    const deduplicated = Array.from(map.values()).sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
    safeSetItem(key, deduplicated.slice(0, 50));
  },
};

type ProgressSyncListener = (
  movieSlug: string,
  episodeSlug: string,
  season: number,
  currentTime: number,
  duration: number
) => void;

let progressSyncListener: ProgressSyncListener | null = null;

export function setProgressSyncListener(listener: ProgressSyncListener | null) {
  progressSyncListener = listener;
}

// ─── Episode Playback Progress Repository (Prevents Cross-Episode Overwrites) ──

export const episodeProgressStore = {
  getAll(): Record<string, { currentTime: number; duration: number; updatedAt: string }> {
    const key = getUserStorageKey(KEYS.EPISODE_PROGRESS);
    return safeGetItem<Record<string, { currentTime: number; duration: number; updatedAt: string }>>(key, {});
  },

  get(movieSlug: string, episodeSlug?: string, season = 1): number {
    if (!movieSlug || !episodeSlug) return 0;
    const progressKey = `${movieSlug}_s${season}_${episodeSlug}`;
    const all = this.getAll();
    return all[progressKey]?.currentTime || 0;
  },

  save(
    movieSlug: string,
    episodeSlug: string,
    season = 1,
    currentTime = 0,
    duration = 0,
    explicitUpdatedAt?: string,
    skipRemoteSync = false
  ): void {
    if (!movieSlug || !episodeSlug) return;
    const key = getUserStorageKey(KEYS.EPISODE_PROGRESS);
    const all = { ...this.getAll() };
    const progressKey = `${movieSlug}_s${season}_${episodeSlug}`;
    const updatedAt = explicitUpdatedAt || new Date().toISOString();
    all[progressKey] = {
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      updatedAt,
    };
    safeSetItem(key, all);

    if (!skipRemoteSync && progressSyncListener) {
      progressSyncListener(movieSlug, episodeSlug, season, currentTime, duration);
    }
  },
};

// ─── Authentication Repository (Supabase Auth Powered) ─────────────────────

export const authStore = {
  getUser(): UserProfile | null {
    const u = safeGetItem<UserProfile | null>(KEYS.USER, null);
    return u ? enrichUserRole(u) : null;
  },

  async login(email: string, password?: string): Promise<UserProfile> {
    const supabase = getSupabaseBrowserClient();
    if (supabase && password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error("Không thể xác thực thông tin đăng nhập");
      }
      const user = enrichUserRole({
        id: data.user.id,
        email: data.user.email || email,
        username:
          data.user.user_metadata?.username ||
          data.user.user_metadata?.full_name ||
          email.split("@")[0],
        avatarUrl: data.user.user_metadata?.avatar_url,
        createdAt: data.user.created_at,
      });
      safeSetItem(KEYS.USER, user);
      migrateGuestDataToUser(user.id);
      migrateLegacyStorageIfNeeded(user.id, user.email);
      return user;
    }

    // Fallback mode if Supabase Auth is unconfigured
    const user = enrichUserRole({
      id: "usr-" + Math.random().toString(36).substring(2, 9),
      email,
      username: email.split("@")[0],
      createdAt: new Date().toISOString(),
    });
    safeSetItem(KEYS.USER, user);
    migrateGuestDataToUser(user.id);
    return user;
  },

  async register(
    email: string,
    password: string,
    username?: string
  ): Promise<UserProfile> {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            username: username?.trim() || email.split("@")[0],
          },
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error("Không thể tạo tài khoản");
      }
      const user = enrichUserRole({
        id: data.user.id,
        email: data.user.email || email,
        username: username?.trim() || email.split("@")[0],
        createdAt: data.user.created_at,
      });
      safeSetItem(KEYS.USER, user);
      migrateGuestDataToUser(user.id);
      migrateLegacyStorageIfNeeded(user.id, user.email);
      return user;
    }

    return this.login(email);
  },

  async updateProfile(data: { username?: string; avatarUrl?: string }): Promise<UserProfile> {
    const current = this.getUser();
    if (!current) throw new Error("Chưa đăng nhập");

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok || resData.status !== "success") {
      throw new Error(resData.message || "Cập nhật hồ sơ thất bại");
    }

    const updated = enrichUserRole({
      ...current,
      username: resData.user?.username || data.username || current.username,
      avatarUrl: resData.user?.avatarUrl !== undefined ? resData.user.avatarUrl : current.avatarUrl,
    });

    safeSetItem(KEYS.USER, updated);
    if (isBrowser()) {
      window.dispatchEvent(new Event("cinepvq_storage_update"));
    }
    return updated;
  },

  updateUser(user: UserProfile): void {
    safeSetItem(KEYS.USER, enrichUserRole(user));
    if (isBrowser()) {
      window.dispatchEvent(new Event("cinepvq_storage_update"));
    }
  },

  async logout(): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("[AuthStore] Supabase signOut error", err);
      }
    }
    safeSetItem(KEYS.USER, null);
    if (isBrowser()) {
      window.dispatchEvent(new Event("cinepvq_storage_update"));
    }
  },
};

// Proactive session restore and state change listener
if (typeof window !== "undefined") {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = enrichUserRole({
          id: session.user.id,
          email: session.user.email || "",
          username:
            session.user.user_metadata?.username ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0] ||
            "User",
          avatarUrl: session.user.user_metadata?.avatar_url,
          createdAt: session.user.created_at,
        });
        safeSetItem(KEYS.USER, user);
        migrateGuestDataToUser(user.id);
        migrateLegacyStorageIfNeeded(user.id, user.email);
        window.dispatchEvent(new Event("cinepvq_storage_update"));
        if (isBrowser()) {
          import("@/services/userSyncManager").then((m) => m.userSyncManager.sync()).catch(() => {});
        }
      }
    }).catch((err) => {
      console.warn("[AuthStore] Failed to restore session", err);
    });

    supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_OUT") {
          safeSetItem(KEYS.USER, null);
          if (isBrowser()) {
            window.dispatchEvent(new Event("cinepvq_storage_update"));
          }
        } else if (session?.user) {
          const user = enrichUserRole({
            id: session.user.id,
            email: session.user.email || "",
            username:
              session.user.user_metadata?.username ||
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0] ||
              "User",
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
          });
          safeSetItem(KEYS.USER, user);
          migrateGuestDataToUser(user.id);
          migrateLegacyStorageIfNeeded(user.id, user.email);
          if (isBrowser()) {
            window.dispatchEvent(new Event("cinepvq_storage_update"));
            import("@/services/userSyncManager").then((m) => m.userSyncManager.sync()).catch(() => {});
          }
        }
      }
    );
  }
}

// ─── Notifications Repository (User-Scoped) ────────────────────────────────

export const notificationStore = {
  getAll(): AppNotification[] {
    const key = getUserStorageKey(KEYS.NOTIFICATIONS);
    return safeGetItem<AppNotification[]>(key, INITIAL_NOTIFICATIONS);
  },

  getUnreadCount(): number {
    return this.getAll().filter((n) => !n.read).length;
  },

  markAsRead(id: string): void {
    const key = getUserStorageKey(KEYS.NOTIFICATIONS);
    const items = this.getAll().map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
    safeSetItem(key, items);
  },

  markAllAsRead(): void {
    const key = getUserStorageKey(KEYS.NOTIFICATIONS);
    const items = this.getAll().map((item) => ({ ...item, read: true }));
    safeSetItem(key, items);
  },

  setAll(items: AppNotification[]): void {
    const key = getUserStorageKey(KEYS.NOTIFICATIONS);
    safeSetItem(key, items);
  },
};

// ─── App Settings Repository (User-Scoped) ─────────────────────────────────

export const settingsStore = {
  get(): AppSettings {
    const key = getUserStorageKey(KEYS.SETTINGS);
    return safeGetItem<AppSettings>(key, DEFAULT_SETTINGS);
  },

  update(partial: Partial<AppSettings>): AppSettings {
    const key = getUserStorageKey(KEYS.SETTINGS);
    const current = this.get();
    const updated = { ...current, ...partial };
    safeSetItem(key, updated);
    return updated;
  },

  set(settings: AppSettings): void {
    const key = getUserStorageKey(KEYS.SETTINGS);
    safeSetItem(key, settings);
  },
};
