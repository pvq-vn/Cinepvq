"use client";

import type {
  UserProfile,
  FavoriteMovie,
  WatchHistoryItem,
  AppNotification,
  AppSettings,
  Movie,
  MovieDetail,
} from "@/types/movie";

const KEYS = {
  USER: "cinepvq_user",
  FAVORITES: "cinepvq_favorites",
  HISTORY: "cinepvq_history",
  NOTIFICATIONS: "cinepvq_notifications",
  SETTINGS: "cinepvq_settings",
};

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  autoPlay: true,
  soundEnabled: true,
  preferredQuality: "auto",
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

function safeGetItem<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Dispatch custom event to sync across components
    window.dispatchEvent(new Event("cinepvq_storage_update"));
  } catch (err) {
    console.warn("Error saving to localStorage", err);
  }
}

// ─── Favorites Repository ──────────────────────────────────────────────────

export const favoritesStore = {
  getAll(): FavoriteMovie[] {
    return safeGetItem<FavoriteMovie[]>(KEYS.FAVORITES, []);
  },

  isFavorite(slug: string): boolean {
    const items = this.getAll();
    return items.some((item) => item.slug === slug);
  },

  toggle(movie: Movie | MovieDetail): boolean {
    const items = this.getAll();
    const existingIndex = items.findIndex((item) => item.slug === movie.slug);

    if (existingIndex >= 0) {
      items.splice(existingIndex, 1);
      safeSetItem(KEYS.FAVORITES, items);
      return false; // Removed
    } else {
      const newItem: FavoriteMovie = {
        slug: movie.slug,
        name: movie.name,
        original_name: movie.original_name,
        thumb_url: movie.thumb_url,
        quality: movie.quality,
        current_episode: movie.current_episode,
        addedAt: new Date().toISOString(),
      };
      items.unshift(newItem);
      safeSetItem(KEYS.FAVORITES, items);
      return true; // Added
    }
  },

  remove(slug: string): void {
    const items = this.getAll().filter((item) => item.slug !== slug);
    safeSetItem(KEYS.FAVORITES, items);
  },
};

// ─── Watch History Repository ──────────────────────────────────────────────

export const historyStore = {
  getAll(): WatchHistoryItem[] {
    return safeGetItem<WatchHistoryItem[]>(KEYS.HISTORY, []);
  },

  add(
    movie: { slug: string; name: string; original_name?: string; thumb_url: string },
    episode?: { slug: string; name: string }
  ): void {
    const items = this.getAll();
    const existingIndex = items.findIndex((item) => item.slug === movie.slug);

    const record: WatchHistoryItem = {
      slug: movie.slug,
      name: movie.name,
      original_name: movie.original_name,
      thumb_url: movie.thumb_url,
      episodeSlug: episode?.slug,
      episodeName: episode?.name,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      items.splice(existingIndex, 1);
    }
    items.unshift(record);

    // Keep max 50 items
    if (items.length > 50) items.pop();
    safeSetItem(KEYS.HISTORY, items);
  },

  remove(slug: string): void {
    const items = this.getAll().filter((item) => item.slug !== slug);
    safeSetItem(KEYS.HISTORY, items);
  },

  clear(): void {
    safeSetItem(KEYS.HISTORY, []);
  },
};

// ─── Authentication Repository ─────────────────────────────────────────────

export const authStore = {
  getUser(): UserProfile | null {
    return safeGetItem<UserProfile | null>(KEYS.USER, null);
  },

  login(email: string, username?: string): UserProfile {
    const user: UserProfile = {
      id: "usr-" + Math.random().toString(36).substring(2, 9),
      email,
      username: username || email.split("@")[0],
      createdAt: new Date().toISOString(),
    };
    safeSetItem(KEYS.USER, user);
    return user;
  },

  register(email: string, username: string): UserProfile {
    return this.login(email, username);
  },

  logout(): void {
    safeSetItem(KEYS.USER, null);
  },
};

// ─── Notifications Repository ──────────────────────────────────────────────

export const notificationStore = {
  getAll(): AppNotification[] {
    return safeGetItem<AppNotification[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  },

  getUnreadCount(): number {
    return this.getAll().filter((n) => !n.read).length;
  },

  markAsRead(id: string): void {
    const items = this.getAll().map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
    safeSetItem(KEYS.NOTIFICATIONS, items);
  },

  markAllAsRead(): void {
    const items = this.getAll().map((item) => ({ ...item, read: true }));
    safeSetItem(KEYS.NOTIFICATIONS, items);
  },
};

// ─── App Settings Repository ───────────────────────────────────────────────

export const settingsStore = {
  get(): AppSettings {
    return safeGetItem<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  update(partial: Partial<AppSettings>): AppSettings {
    const current = this.get();
    const updated = { ...current, ...partial };
    safeSetItem(KEYS.SETTINGS, updated);
    return updated;
  },
};
