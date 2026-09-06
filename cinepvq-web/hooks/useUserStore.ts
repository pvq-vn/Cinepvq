"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import {
  favoritesStore,
  historyStore,
  authStore,
  notificationStore,
  settingsStore,
} from "@/services/userStore";
import { userSyncManager } from "@/services/userSyncManager";
import type {
  AppSettings,
  Movie,
  MovieDetail,
  FavoriteMovie,
} from "@/types/movie";

// Version counter for external store
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("cinepvq_storage_update", notify);
  window.addEventListener("storage", notify);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

const emptySubscribe = () => () => {};

export function useUserStore() {
  // Subscribe to version changes in store
  useSyncExternalStore(subscribe, () => version, () => 0);

  // Safe client-mounted check without setState in effect
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const favorites = mounted ? favoritesStore.getAll() : [];
  const history = mounted ? historyStore.getAll() : [];
  const user = mounted ? authStore.getUser() : null;
  const notifications = mounted ? notificationStore.getAll() : [];
  const settings: AppSettings = mounted
    ? settingsStore.get()
    : {
        theme: "system",
        autoPlay: true,
        soundEnabled: true,
        preferredQuality: "auto",
      };

  // Background sync on mount and when user session is active
  useEffect(() => {
    if (mounted && user?.email) {
      userSyncManager.sync();
    }
  }, [mounted, user?.email]);

  const toggleFavorite = useCallback(
    (movie: Movie | MovieDetail | FavoriteMovie) => {
      const res = favoritesStore.toggle(movie);
      notify();
      userSyncManager.syncFavoriteToggle(movie, res);
      return res;
    },
    []
  );

  const isFavorite = useCallback(
    (slug: string) => favoritesStore.isFavorite(slug),
    []
  );

  const addHistory = useCallback(
    (
      movie: { slug: string; name: string; original_name?: string; thumb_url: string },
      episode?: { slug: string; name: string },
      currentTime?: number,
      duration?: number
    ) => {
      historyStore.add(movie, episode, currentTime, duration);
      notify();
      userSyncManager.syncHistoryAdd(movie, episode, currentTime, duration);
    },
    []
  );

  const removeHistory = useCallback((slug: string) => {
    historyStore.remove(slug);
    notify();
    userSyncManager.syncHistoryRemove(slug);
  }, []);

  const clearHistory = useCallback(() => {
    historyStore.clear();
    notify();
    userSyncManager.syncHistoryClear();
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    const u = await authStore.login(email, password);
    notify();
    // Trigger immediate background sync for the new session
    setTimeout(() => userSyncManager.sync(), 100);
    return u;
  }, []);

  const register = useCallback(
    async (email: string, password: string, username?: string) => {
      const u = await authStore.register(email, password, username);
      notify();
      setTimeout(() => userSyncManager.sync(), 100);
      return u;
    },
    []
  );

  const logout = useCallback(async () => {
    await authStore.logout();
    notify();
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    notificationStore.markAsRead(id);
    notify();
    userSyncManager.syncNotificationRead(id, false);
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    notificationStore.markAllAsRead();
    notify();
    userSyncManager.syncNotificationRead(undefined, true);
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const s = settingsStore.update(partial);
    notify();
    userSyncManager.syncSettings(partial);
    return s;
  }, []);

  const updateProfile = useCallback(
    async (data: { username?: string; avatarUrl?: string }) => {
      const u = await authStore.updateProfile(data);
      notify();
      return u;
    },
    []
  );

  return {
    mounted,
    user,
    favorites,
    history,
    notifications,
    settings,
    unreadNotificationsCount: notifications.filter((n) => !n.read).length,
    toggleFavorite,
    isFavorite,
    addHistory,
    removeHistory,
    clearHistory,
    login,
    register,
    logout,
    updateProfile,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    updateSettings,
  };
}

