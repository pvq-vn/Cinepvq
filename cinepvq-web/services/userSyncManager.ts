"use client";

// ==============================================================================
// services/userSyncManager.ts
// Supabase PostgreSQL Synchronization and LocalStorage Fallback Manager
// Hardened with Server-Side Authenticated Identity & Bearer Token Authentication
// ==============================================================================

import {
  authStore,
  favoritesStore,
  watchlistStore,
  historyStore,
  settingsStore,
  notificationStore,
  episodeProgressStore,
  setProgressSyncListener,
  getActiveUserId,
} from "@/services/userStore";

// ─── User-Scoped Tombstone & Pending Sync Storage (Prevents Cross-Device Resurrection) ───
function readSlugSet(keyBase: string, uid?: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const id = uid || getActiveUserId();
  try {
    const raw = localStorage.getItem(`${keyBase}_${id}`);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSlugSet(keyBase: string, set: Set<string>, uid?: string): void {
  if (typeof window === "undefined") return;
  const id = uid || getActiveUserId();
  try {
    if (set.size === 0) {
      localStorage.removeItem(`${keyBase}_${id}`);
    } else {
      localStorage.setItem(`${keyBase}_${id}`, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

function addSlugToSet(keyBase: string, slug: string): void {
  if (!slug) return;
  const set = readSlugSet(keyBase);
  set.add(slug);
  writeSlugSet(keyBase, set);
}

function removeSlugFromSet(keyBase: string, slug: string): void {
  if (!slug) return;
  const set = readSlugSet(keyBase);
  if (set.delete(slug)) writeSlugSet(keyBase, set);
}

function isClearFlagSet(keyBase: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`${keyBase}_${getActiveUserId()}`) === "true";
}

function setClearFlag(keyBase: string, val: boolean): void {
  if (typeof window === "undefined") return;
  const key = `${keyBase}_${getActiveUserId()}`;
  if (val) localStorage.setItem(key, "true");
  else localStorage.removeItem(key);
}

const TOMBSTONE_KEYS = {
  DELETED_HIST: "cinepvq_deleted_hist",
  PENDING_HIST: "cinepvq_pending_hist",
  CLEAR_HIST: "cinepvq_clear_hist",
  DELETED_WL: "cinepvq_deleted_wl",
  PENDING_WL: "cinepvq_pending_wl",
  CLEAR_WL: "cinepvq_clear_wl",
};
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEpisodeLabel } from "@/lib/format";
import type {
  AppSettings,
  Movie,
  MovieDetail,
  FavoriteMovie,
  WatchlistItem,
  WatchHistoryItem,
} from "@/types/movie";

let isSyncing = false;
let syncScheduled = false;

let progressTimer: NodeJS.Timeout | null = null;
let pendingProgress: {
  movieSlug: string;
  episodeSlug: string;
  season: number;
  currentTime: number;
  duration: number;
  updatedAt: string;
} | null = null;

/**
 * Returns authenticated HTTP headers including Supabase Bearer token if available.
 * Essential for mobile browsers (Safari ITP / Chrome Mobile) where third-party
 * or SSR cookies may not be reliably forwarded to Next.js route handlers.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch (err) {
      console.warn("[UserSync] Failed to obtain Supabase session token", err);
    }
  }

  return headers;
}

export const userSyncManager = {
  /**
   * Main synchronization routine:
   * 1. Resolves user identity with Supabase Auth session via /api/user/sync with Bearer token.
   * 2. Migrates local items if this user hasn't completed migration yet.
   * 3. Pulls latest remote favorites, history, settings, notifications and merges with local state.
   * 4. Retains localStorage fully as optimistic cache and offline fallback.
   */
  async sync(): Promise<void> {
    if (typeof window === "undefined") return;
    if (isSyncing) {
      syncScheduled = true;
      return;
    }

    const currentUser = authStore.getUser();
    if (!currentUser || !currentUser.email) {
      // Unauthenticated: keep purely local state
      return;
    }

    isSyncing = true;

    try {
      const authHeaders = await getAuthHeaders();

      // Step 1: Ensure user identity in Supabase PostgreSQL
      try {
        const res = await fetch("/api/user/sync", {
          method: "POST",
          headers: authHeaders,
        });

        if (res.status === 401) {
          // Session expired or not logged into Supabase Auth; remain in offline mode
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && data.user) {
            if (data.user.id !== currentUser.id || data.user.role !== currentUser.role) {
              authStore.updateUser(data.user);
            }
          }
        }
      } catch (err) {
        console.warn("[UserSync] User identity sync failed, continuing offline", err);
      }

      // Step 2: Mark migration flag so new users never inherit stale guest caches
      const migrationKey = `cinepvq_migrated_${currentUser.email.toLowerCase()}`;
      const isFirstLogin = localStorage.getItem(migrationKey) !== "true";
      if (isFirstLogin) {
        localStorage.setItem(migrationKey, "true");
      }

      // Step 3: Two-way sync: Push local items (if first login migration) and pull remote items
      const localFavs = favoritesStore.getAll();
      const localWatchlist = watchlistStore.getAll();

      await Promise.allSettled([
        // Sync favorites: only migrate guest favorites on first login; otherwise always pull authoritative list from server
        (isFirstLogin && localFavs.length > 0
          ? fetch("/api/favorites", {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ action: "sync", favorites: localFavs }),
            })
          : fetch("/api/favorites", {
              headers: authHeaders,
            })
        )
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && Array.isArray(data.favorites)) {
              favoritesStore.setAll(data.favorites);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cinepvq_storage_update"));
              }
            }
          })
          .catch((err) => console.warn("[UserSync] Sync favorites failed", err)),

        // Sync history: flush local deletions first, then reconcile strictly against authoritative DB
        // so movies deleted on Android or another browser are NEVER resurrected!
        (async () => {
          try {
            if (isClearFlagSet(TOMBSTONE_KEYS.CLEAR_HIST)) {
              const clearRes = await fetch("/api/history", {
                method: "DELETE",
                headers: authHeaders,
                body: JSON.stringify({ clearAll: true }),
              });
              if (clearRes.ok) {
                setClearFlag(TOMBSTONE_KEYS.CLEAR_HIST, false);
                writeSlugSet(TOMBSTONE_KEYS.DELETED_HIST, new Set());
              }
            }

            const deletedHist = readSlugSet(TOMBSTONE_KEYS.DELETED_HIST);
            for (const delSlug of deletedHist) {
              try {
                const delRes = await fetch("/api/history", {
                  method: "DELETE",
                  headers: authHeaders,
                  body: JSON.stringify({ movieSlug: delSlug }),
                });
                if (delRes.ok) {
                  removeSlugFromSet(TOMBSTONE_KEYS.DELETED_HIST, delSlug);
                }
              } catch {}
            }

            const r = await fetch("/api/history", { headers: authHeaders });
            const data = await r.json();
            if (data.status === "success" && Array.isArray(data.history)) {
              const activeDeleted = readSlugSet(TOMBSTONE_KEYS.DELETED_HIST);
              const pendingSync = readSlugSet(TOMBSTONE_KEYS.PENDING_HIST);
              const remoteHistory: WatchHistoryItem[] = data.history
                .filter((item: WatchHistoryItem) => item && item.slug && !activeDeleted.has(item.slug))
                .map((item: WatchHistoryItem) => ({
                  ...item,
                  episodeName: normalizeEpisodeLabel(item.episodeName, item.episodeSlug) || item.episodeName,
                }));

              const currentLocal = historyStore.getAll();
              const localMap = new Map<string, WatchHistoryItem>();
              currentLocal.forEach((item) => {
                if (item && item.slug) localMap.set(item.slug, item);
              });

              const mergedMap = new Map<string, WatchHistoryItem>();
              const itemsToPush: WatchHistoryItem[] = [];

              // 1. Reconcile authoritative remote DB rows
              remoteHistory.forEach((remote) => {
                const local = localMap.get(remote.slug);
                const timeRemote = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
                const timeLocal = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;

                if (!local || timeRemote >= timeLocal) {
                  mergedMap.set(remote.slug, remote);
                  removeSlugFromSet(TOMBSTONE_KEYS.PENDING_HIST, remote.slug);

                  if (remote.episodeSlug && typeof remote.currentTime === "number") {
                    episodeProgressStore.save(
                      remote.slug,
                      remote.episodeSlug,
                      1,
                      remote.currentTime,
                      remote.duration || 0,
                      remote.updatedAt,
                      true
                    );
                  }
                } else {
                  mergedMap.set(remote.slug, local);
                  itemsToPush.push(local);
                }
              });

              // 2. Keep/push local-only items ONLY if genuinely pending offline sync or first login migration.
              //    Any previously-synced item missing from remote DB was deleted on another device -> drop locally!
              currentLocal.forEach((loc) => {
                if (!loc || !loc.slug || mergedMap.has(loc.slug) || activeDeleted.has(loc.slug)) return;
                if (isFirstLogin || pendingSync.has(loc.slug)) {
                  mergedMap.set(loc.slug, loc);
                  itemsToPush.push(loc);
                }
              });

              const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
                const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return timeB - timeA;
              });

              historyStore.setAll(mergedList);

              if (itemsToPush.length > 0) {
                const pushRes = await fetch("/api/history", {
                  method: "POST",
                  headers: authHeaders,
                  body: JSON.stringify({ action: "sync", history: itemsToPush }),
                });
                if (pushRes.ok) {
                  itemsToPush.forEach((it) => removeSlugFromSet(TOMBSTONE_KEYS.PENDING_HIST, it.slug));
                }
              }

              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cinepvq_storage_update"));
              }
            }
          } catch (err) {
            console.warn("[UserSync] Sync history failed", err);
          }
        })(),

        // Sync watchlist: flush local deletions first, then pull authoritative list
        (async () => {
          try {
            if (isClearFlagSet(TOMBSTONE_KEYS.CLEAR_WL)) {
              const clearRes = await fetch("/api/watchlist", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ action: "clear" }),
              });
              if (clearRes.ok) {
                setClearFlag(TOMBSTONE_KEYS.CLEAR_WL, false);
                writeSlugSet(TOMBSTONE_KEYS.DELETED_WL, new Set());
              }
            }

            const deletedWl = readSlugSet(TOMBSTONE_KEYS.DELETED_WL);
            for (const delSlug of deletedWl) {
              try {
                const delRes = await fetch("/api/watchlist", {
                  method: "POST",
                  headers: authHeaders,
                  body: JSON.stringify({ action: "remove", slug: delSlug }),
                });
                if (delRes.ok) {
                  removeSlugFromSet(TOMBSTONE_KEYS.DELETED_WL, delSlug);
                }
              } catch {}
            }

            const pendingWl = readSlugSet(TOMBSTONE_KEYS.PENDING_WL);
            const toMigrateWl = isFirstLogin
              ? localWatchlist
              : localWatchlist.filter((w) => pendingWl.has(w.slug));

            const r =
              toMigrateWl.length > 0
                ? await fetch("/api/watchlist", {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({ action: "sync", watchlist: toMigrateWl }),
                  })
                : await fetch("/api/watchlist", { headers: authHeaders });

            const data = await r.json();
            if (data.status === "success" && Array.isArray(data.watchlist)) {
              const activeDeleted = readSlugSet(TOMBSTONE_KEYS.DELETED_WL);
              const validRemote = (data.watchlist as WatchlistItem[]).filter(
                (w) => w && w.slug && !activeDeleted.has(w.slug)
              );
              toMigrateWl.forEach((w) => removeSlugFromSet(TOMBSTONE_KEYS.PENDING_WL, w.slug));
              watchlistStore.setAll(validRemote);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cinepvq_storage_update"));
              }
            }
          } catch (err) {
            console.warn("[UserSync] Sync watchlist failed", err);
          }
        })(),

        // Pull remote settings
        fetch("/api/settings", {
          headers: authHeaders,
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && data.settings) {
              settingsStore.set(data.settings);
            }
          })
          .catch((err) => console.warn("[UserSync] Fetch settings failed", err)),

        // Pull remote notifications
        fetch("/api/notifications", {
          headers: authHeaders,
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && Array.isArray(data.notifications)) {
              if (data.notifications.length > 0) {
                notificationStore.setAll(data.notifications);
              }
            }
          })
          .catch((err) => console.warn("[UserSync] Fetch notifications failed", err)),
      ]);
    } catch (error) {
      console.warn("[UserSync] Error during background synchronization", error);
    } finally {
      isSyncing = false;
      if (syncScheduled) {
        syncScheduled = false;
        setTimeout(() => this.sync(), 200);
      }
    }
  },

  // ─── Direct Action Sync Hooks ─────────────────────────────────────────────

  async syncFavoriteToggle(movie: Movie | MovieDetail | FavoriteMovie, isAdded: boolean) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      if (isAdded) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            movie: {
              slug: movie.slug,
              name: movie.name,
              original_name: movie.original_name,
              thumb_url: movie.thumb_url,
              poster_url: "poster_url" in movie ? movie.poster_url : undefined,
              quality: movie.quality,
              current_episode: movie.current_episode,
            },
          }),
        });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "remove",
            movieSlug: movie.slug,
          }),
        });
      }
    } catch (err) {
      console.warn("[UserSync] Favorite sync failed, local state retained", err);
    }
  },

  async syncFavoriteRemove(movieSlug: string) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/favorites", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "remove",
          movieSlug,
        }),
      });
    } catch (err) {
      console.warn("[UserSync] Favorite remove sync failed", err);
    }
  },

  async syncFavoriteClear() {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/favorites", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "clear",
        }),
      });
    } catch (err) {
      console.warn("[UserSync] Favorite clear sync failed", err);
    }
  },

  async syncHistoryAdd(
    movie: { slug: string; name: string; original_name?: string; thumb_url: string },
    episode?: { slug: string; name: string },
    position?: number,
    duration?: number
  ) {
    const user = authStore.getUser();
    if (!user) return;

    removeSlugFromSet(TOMBSTONE_KEYS.DELETED_HIST, movie.slug);
    addSlugToSet(TOMBSTONE_KEYS.PENDING_HIST, movie.slug);

    try {
      const authHeaders = await getAuthHeaders();
      const normalizedEpisode = episode
        ? {
            slug: episode.slug,
            name: normalizeEpisodeLabel(episode.name, episode.slug),
          }
        : undefined;
      const res = await fetch("/api/history", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          movie,
          episode: normalizedEpisode,
          position: typeof position === "number" ? Math.floor(position) : 0,
          duration: typeof duration === "number" ? Math.floor(duration) : 0,
          updatedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        removeSlugFromSet(TOMBSTONE_KEYS.PENDING_HIST, movie.slug);
      }
    } catch (err) {
      console.warn("[UserSync] History sync failed, local state retained", err);
    }
  },

  async syncHistoryRemove(movieSlug: string) {
    const user = authStore.getUser();
    if (!user) return;

    // Cancel any queued progress upsert for this slug so it cannot re-insert after deletion
    if (pendingProgress?.movieSlug === movieSlug) {
      if (progressTimer) {
        clearTimeout(progressTimer);
        progressTimer = null;
      }
      pendingProgress = null;
    }

    addSlugToSet(TOMBSTONE_KEYS.DELETED_HIST, movieSlug);
    removeSlugFromSet(TOMBSTONE_KEYS.PENDING_HIST, movieSlug);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({
          movieSlug,
        }),
      });
      if (res.ok) {
        removeSlugFromSet(TOMBSTONE_KEYS.DELETED_HIST, movieSlug);
      }
    } catch (err) {
      console.warn("[UserSync] History remove sync failed", err);
    }
  },

  async syncHistoryClear() {
    const user = authStore.getUser();
    if (!user) return;

    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = null;
    }
    pendingProgress = null;
    setClearFlag(TOMBSTONE_KEYS.CLEAR_HIST, true);
    writeSlugSet(TOMBSTONE_KEYS.PENDING_HIST, new Set());

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({
          clearAll: true,
        }),
      });
      if (res.ok) {
        setClearFlag(TOMBSTONE_KEYS.CLEAR_HIST, false);
        writeSlugSet(TOMBSTONE_KEYS.DELETED_HIST, new Set());
      }
    } catch (err) {
      console.warn("[UserSync] History clear sync failed", err);
    }
  },

  async syncSettings(settings: Partial<AppSettings>) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/settings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          settings,
        }),
      });
    } catch (err) {
      console.warn("[UserSync] Settings sync failed", err);
    }
  },

  async syncNotificationRead(notificationId?: string, markAll = false) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/notifications", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          notificationId,
          markAll,
        }),
      });
    } catch (err) {
      console.warn("[UserSync] Notification read sync failed", err);
    }
  },

  async syncWatchlistToggle(
    movie: Movie | MovieDetail | WatchlistItem | FavoriteMovie,
    isAdded: boolean
  ) {
    const user = authStore.getUser();
    if (!user) return;

    if (isAdded) {
      removeSlugFromSet(TOMBSTONE_KEYS.DELETED_WL, movie.slug);
      addSlugToSet(TOMBSTONE_KEYS.PENDING_WL, movie.slug);
    } else {
      addSlugToSet(TOMBSTONE_KEYS.DELETED_WL, movie.slug);
      removeSlugFromSet(TOMBSTONE_KEYS.PENDING_WL, movie.slug);
    }

    try {
      const authHeaders = await getAuthHeaders();
      if (isAdded) {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "add",
            movie: {
              slug: movie.slug,
              name: movie.name,
              original_name: movie.original_name,
              thumb_url: movie.thumb_url,
              poster_url: "poster_url" in movie ? movie.poster_url : undefined,
              year: "year" in movie ? movie.year : undefined,
              quality: movie.quality,
              current_episode: movie.current_episode,
              type:
                "type" in movie && typeof (movie as { type?: unknown }).type === "string"
                  ? (movie as { type: string }).type
                  : undefined,
              addedAt:
                "addedAt" in movie && typeof movie.addedAt === "string" && movie.addedAt
                  ? movie.addedAt
                  : new Date().toISOString(),
            },
          }),
        });
        if (res.ok) removeSlugFromSet(TOMBSTONE_KEYS.PENDING_WL, movie.slug);
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "remove",
            slug: movie.slug,
          }),
        });
        if (res.ok) removeSlugFromSet(TOMBSTONE_KEYS.DELETED_WL, movie.slug);
      }
    } catch (err) {
      console.warn("[UserSync] Watchlist toggle sync failed", err);
    }
  },

  async syncWatchlistRemove(slug: string) {
    const user = authStore.getUser();
    if (!user) return;

    addSlugToSet(TOMBSTONE_KEYS.DELETED_WL, slug);
    removeSlugFromSet(TOMBSTONE_KEYS.PENDING_WL, slug);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "remove",
          slug,
        }),
      });
      if (res.ok) removeSlugFromSet(TOMBSTONE_KEYS.DELETED_WL, slug);
    } catch (err) {
      console.warn("[UserSync] Watchlist remove sync failed", err);
    }
  },

  async syncWatchlistClear() {
    const user = authStore.getUser();
    if (!user) return;

    setClearFlag(TOMBSTONE_KEYS.CLEAR_WL, true);
    writeSlugSet(TOMBSTONE_KEYS.PENDING_WL, new Set());

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "clear",
        }),
      });
      if (res.ok) {
        setClearFlag(TOMBSTONE_KEYS.CLEAR_WL, false);
        writeSlugSet(TOMBSTONE_KEYS.DELETED_WL, new Set());
      }
    } catch (err) {
      console.warn("[UserSync] Watchlist clear sync failed", err);
    }
  },

  /**
   * Debounced sync playback progress directly to Supabase DB.
   * Prevents API flood during rapid playback updates while guaranteeing
   * cross-device synchronicity.
   */
  debouncedSyncProgress(
    movieSlug: string,
    episodeSlug: string,
    season = 1,
    currentTime = 0,
    duration = 0
  ) {
    if (typeof window === "undefined") return;
    const user = authStore.getUser();
    if (!user || !user.email) return;

    pendingProgress = {
      movieSlug,
      episodeSlug,
      season,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      updatedAt: new Date().toISOString(),
    };

    if (progressTimer) clearTimeout(progressTimer);
    progressTimer = setTimeout(async () => {
      if (!pendingProgress) return;
      const target = pendingProgress;
      pendingProgress = null;
      // Never re-insert a movie that was deleted locally while this debounce timer was pending
      if (readSlugSet(TOMBSTONE_KEYS.DELETED_HIST).has(target.movieSlug)) {
        return;
      }
      addSlugToSet(TOMBSTONE_KEYS.PENDING_HIST, target.movieSlug);
      try {
        const authHeaders = await getAuthHeaders();
        const existingHist = historyStore.getAll().find((h) => h.slug === target.movieSlug);
        const epLabel = normalizeEpisodeLabel(
          existingHist && existingHist.episodeSlug === target.episodeSlug
            ? existingHist.episodeName
            : undefined,
          target.episodeSlug
        );
        const res = await fetch("/api/history", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "upsert",
            movieSlug: target.movieSlug,
            episodeSlug: target.episodeSlug,
            episodeName: epLabel,
            position: target.currentTime,
            duration: target.duration,
            updatedAt: target.updatedAt,
          }),
        });
        if (res.ok) {
          removeSlugFromSet(TOMBSTONE_KEYS.PENDING_HIST, target.movieSlug);
        }
      } catch (err) {
        console.warn("[UserSync] Debounced progress sync failed", err);
      }
    }, 1500);
  },
};

// Wire userStore's episodeProgressStore.save to debouncedSyncProgress
if (typeof window !== "undefined") {
  setProgressSyncListener(
    userSyncManager.debouncedSyncProgress.bind(userSyncManager)
  );
}
