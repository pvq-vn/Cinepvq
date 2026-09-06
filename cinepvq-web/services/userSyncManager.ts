"use client";

// ==============================================================================
// services/userSyncManager.ts
// Supabase PostgreSQL Synchronization and LocalStorage Fallback Manager
// Hardened with Server-Side Authenticated Identity
// ==============================================================================

import {
  authStore,
  favoritesStore,
  historyStore,
  settingsStore,
  notificationStore,
} from "@/services/userStore";
import type {
  AppSettings,
  Movie,
  MovieDetail,
  FavoriteMovie,
} from "@/types/movie";

let isSyncing = false;
let syncScheduled = false;

export const userSyncManager = {
  /**
   * Main synchronization routine:
   * 1. Resolves user identity with Supabase Auth session via /api/user/sync.
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
      // Step 1: Ensure user identity in Supabase PostgreSQL
      try {
        const res = await fetch("/api/user/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

      await Promise.allSettled([
        // Sync favorites (push local if exists, else pull)
        (localFavs.length > 0
          ? fetch("/api/favorites", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sync", favorites: localFavs }),
            })
          : fetch("/api/favorites")
        )
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && Array.isArray(data.favorites)) {
              favoritesStore.setAll(data.favorites);
            }
          })
          .catch((err) => console.warn("[UserSync] Sync favorites failed", err)),

        // Sync history (push local if exists, else pull)
        (localHist.length > 0
          ? fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sync", history: localHist }),
            })
          : fetch("/api/history")
        )
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && Array.isArray(data.history)) {
              historyStore.setAll(data.history);
            }
          })
          .catch((err) => console.warn("[UserSync] Sync history failed", err)),

        // Pull remote settings
        fetch("/api/settings")
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success" && data.settings) {
              settingsStore.set(data.settings);
            }
          })
          .catch((err) => console.warn("[UserSync] Fetch settings failed", err)),

        // Pull remote notifications
        fetch("/api/notifications")
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
      if (isAdded) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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

  async syncHistoryAdd(
    movie: { slug: string; name: string; original_name?: string; thumb_url: string },
    episode?: { slug: string; name: string },
    position?: number,
    duration?: number
  ) {
    const user = authStore.getUser();
    if (!user) return;

    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie,
          episode,
          position: typeof position === "number" ? Math.floor(position) : 0,
          duration: typeof duration === "number" ? Math.floor(duration) : 0,
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
      await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
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
      await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
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
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          markAll,
        }),
      });
    } catch (err) {
      console.warn("[UserSync] Notification read sync failed", err);
    }
  },
};
