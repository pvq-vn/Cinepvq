"use client";

import { useSyncExternalStore, useCallback } from "react";
import {
  favoritesStore,
  historyStore,
  authStore,
  notificationStore,
  settingsStore,
} from "@/services/userStore";
import type {
  AppSettings,
  Movie,
  MovieDetail,
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

  const toggleFavorite = useCallback((movie: Movie | MovieDetail) => {
    const res = favoritesStore.toggle(movie);
    notify();
    return res;
  }, []);

  const isFavorite = useCallback(
    (slug: string) => favoritesStore.isFavorite(slug),
    []
  );

  const addHistory = useCallback(
    (
      movie: { slug: string; name: string; original_name?: string; thumb_url: string },
      episode?: { slug: string; name: string }
    ) => {
      historyStore.add(movie, episode);
      notify();
    },
    []
  );

  const removeHistory = useCallback((slug: string) => {
    historyStore.remove(slug);
    notify();
  }, []);

  const clearHistory = useCallback(() => {
    historyStore.clear();
    notify();
  }, []);

  const login = useCallback((email: string, username?: string) => {
    const u = authStore.login(email, username);
    notify();
    return u;
  }, []);

  const logout = useCallback(() => {
    authStore.logout();
    notify();
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    notificationStore.markAsRead(id);
    notify();
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    notificationStore.markAllAsRead();
    notify();
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const s = settingsStore.update(partial);
    notify();
    return s;
  }, []);

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
    logout,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    updateSettings,
  };
}
