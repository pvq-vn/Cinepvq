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
} from "@/services/userStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
async function getAuthHeaders(): Promise<HeadersInit> {
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
            if (data.user.id !== currentUser.id) {
              authStore.updateUser(data.user);
            }
          }
        }
      } catch (err) {
        console.warn("[UserSync] User identity sync failed, continuing offline", err);
      }

      // Step 2: Mark migration flag so new users never inherit stale guest caches
      const migrationKey = `cinepvq_migrated_${currentUser.email.toLowerCase()}`;
      if (localStorage.getItem(migrationKey) !== "true") {
        localStorage.setItem(migrationKey, "true");
      }

      // Step 3: Two-way sync: Push local items (if any) and pull remote items
      const localFavs = favoritesStore.getAll();
      const localHist = historyStore.getAll();
      const localWatchlist = watchlistStore.getAll();

      await Promise.allSettled([
        // Sync favorites (push local if exists, else pull)
        (localFavs.length > 0
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

        // Sync history: BẮT BUỘC fetch tiến độ mới nhất từ Supabase, so sánh timestamp và ghi đè local storage nếu DB mới hơn
        fetch("/api/history", {
          headers: authHeaders,
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && Array.isArray(data.history)) {
              const remoteHistory: WatchHistoryItem[] = data.history;
              const currentLocal = historyStore.getAll();
              const localMap = new Map<string, WatchHistoryItem>();
              currentLocal.forEach((item) => {
                if (item && item.slug) localMap.set(item.slug, item);
              });

              const mergedMap = new Map<string, WatchHistoryItem>();
              const itemsToPush: WatchHistoryItem[] = [];

              // 1. Duyệt toàn bộ lịch sử từ DB
              remoteHistory.forEach((remote) => {
                if (!remote || !remote.slug) return;
                const local = localMap.get(remote.slug);
                const timeRemote = remote.updatedAt
                  ? new Date(remote.updatedAt).getTime()
                  : 0;
                const timeLocal = local?.updatedAt
                  ? new Date(local.updatedAt).getTime()
                  : 0;

                if (!local || timeRemote >= timeLocal) {
                  // DB có dữ liệu mới hơn hoặc bằng (hoặc thiết bị này chưa có):
                  // GHI ĐÈ local storage (cả historyStore lẫn episodeProgressStore)
                  mergedMap.set(remote.slug, remote);

                  if (remote.episodeSlug && typeof remote.currentTime === "number") {
                    episodeProgressStore.save(
                      remote.slug,
                      remote.episodeSlug,
                      1,
                      remote.currentTime,
                      remote.duration || 0,
                      remote.updatedAt,
                      true // skipRemoteSync to avoid echo
                    );
                  }
                } else {
                  // Dữ liệu local trên máy này mới hơn hẳn DB (xem offline hoặc vừa xem):
                  // Giữ local và chuẩn bị đẩy lên DB
                  mergedMap.set(remote.slug, local);
                  itemsToPush.push(local);
                }
              });

              // 2. Duyệt các phim chỉ có ở local mà DB chưa có
              currentLocal.forEach((loc) => {
                if (loc && loc.slug && !mergedMap.has(loc.slug)) {
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

              // 3. Nếu có item local mới hơn, đồng bộ đẩy lên DB
              if (itemsToPush.length > 0) {
                fetch("/api/history", {
                  method: "POST",
                  headers: authHeaders,
                  body: JSON.stringify({ action: "sync", history: itemsToPush }),
                }).catch((err) =>
                  console.warn("[UserSync] Push local history to remote failed", err)
                );
              }

              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cinepvq_storage_update"));
              }
            }
          })
          .catch((err) => console.warn("[UserSync] Sync history failed", err)),

        // Sync watchlist (push local if exists, else pull)
        (localWatchlist.length > 0
          ? fetch("/api/watchlist", {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ action: "sync", watchlist: localWatchlist }),
            })
          : fetch("/api/watchlist", {
              headers: authHeaders,
            })
        )
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && Array.isArray(data.watchlist)) {
              const currentLocal = watchlistStore.getAll();
              const mergedMap = new Map<string, WatchlistItem>();
              data.watchlist.forEach((w: WatchlistItem) => {
                if (w && w.slug) mergedMap.set(w.slug, w);
              });
              currentLocal.forEach((loc) => {
                if (loc && loc.slug) {
                  if (!mergedMap.has(loc.slug)) {
                    mergedMap.set(loc.slug, loc);
                  } else {
                    const remote = mergedMap.get(loc.slug)!;
                    const timeLoc = loc.addedAt ? new Date(loc.addedAt).getTime() : 0;
                    const timeRemote = remote.addedAt ? new Date(remote.addedAt).getTime() : 0;
                    if (timeLoc > timeRemote) {
                      mergedMap.set(loc.slug, loc);
                    }
                  }
                }
              });
              const mergedList = Array.from(mergedMap.values())
                .sort((a, b) => {
                  const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
                  const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
                  return timeB - timeA;
                })
                .slice(0, 100);
              watchlistStore.setAll(mergedList);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cinepvq_storage_update"));
              }
            }
          })
          .catch((err) => console.warn("[UserSync] Sync watchlist failed", err)),

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
    if (!user) return; // Keep purely local if not logged in

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

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/history", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          movie,
          episode,
          position: typeof position === "number" ? Math.floor(position) : 0,
          duration: typeof duration === "number" ? Math.floor(duration) : 0,
          updatedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn("[UserSync] History sync failed, local state retained", err);
    }
  },

  async syncHistoryRemove(movieSlug: string) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/history", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({
          movieSlug,
        }),
      });
    } catch (err) {
      console.warn("[UserSync] History remove sync failed", err);
    }
  },

  async syncHistoryClear() {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/history", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({
          clearAll: true,
        }),
      });
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

    try {
      const authHeaders = await getAuthHeaders();
      if (isAdded) {
        await fetch("/api/watchlist", {
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
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "remove",
            slug: movie.slug,
          }),
        });
      }
    } catch (err) {
      console.warn("[UserSync] Watchlist toggle sync failed", err);
    }
  },

  async syncWatchlistRemove(slug: string) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/watchlist", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "remove",
          slug,
        }),
      });
    } catch (err) {
      console.warn("[UserSync] Watchlist remove sync failed", err);
    }
  },

  async syncWatchlistClear() {
    const user = authStore.getUser();
    if (!user) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/watchlist", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "clear",
        }),
      });
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
      try {
        const authHeaders = await getAuthHeaders();
        await fetch("/api/history", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "upsert",
            movieSlug: target.movieSlug,
            episodeSlug: target.episodeSlug,
            position: target.currentTime,
            duration: target.duration,
            updatedAt: target.updatedAt,
          }),
        });
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

