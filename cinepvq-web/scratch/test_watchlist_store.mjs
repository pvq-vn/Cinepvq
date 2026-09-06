// scratch/test_watchlist_store.mjs
// Isolated Node.js test for Watchlist store operations, isolation, and migration

import assert from "node:assert/strict";

// Mock minimal browser environment with localStorage
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();

function safeGetItem(key, fallback) {
  const raw = mockStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSetItem(key, value) {
  mockStorage.setItem(key, JSON.stringify(value));
}

let activeUserId = "guest";
function getActiveUserId() {
  return activeUserId;
}

function getUserStorageKey(baseKey, explicitUserId) {
  const uid = explicitUserId || getActiveUserId();
  return `${baseKey}_${uid}`;
}

const KEYS = {
  WATCHLIST: "cinepvq_watchlist",
};

const watchlistStore = {
  getAll() {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const raw = safeGetItem(key, []);
    return raw
      .filter((item) => Boolean(item && item.slug))
      .sort((a, b) => {
        const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 100);
  },

  isWatchlist(slug) {
    const items = this.getAll();
    return items.some((item) => item.slug === slug);
  },

  add(movie) {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const items = this.getAll().filter((item) => item.slug !== movie.slug);

    const newItem = {
      slug: movie.slug,
      name: movie.name,
      original_name: movie.original_name,
      thumb_url: movie.thumb_url,
      poster_url: movie.poster_url,
      year: movie.year,
      quality: movie.quality,
      current_episode: movie.current_episode,
      type: movie.type,
      addedAt: movie.addedAt || new Date().toISOString(),
    };

    items.unshift(newItem);
    const capped = items.slice(0, 100);
    safeSetItem(key, capped);
    return true;
  },

  remove(slug) {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const items = this.getAll().filter((item) => item.slug !== slug);
    safeSetItem(key, items);
  },

  toggle(movie) {
    if (this.isWatchlist(movie.slug)) {
      this.remove(movie.slug);
      return false;
    } else {
      this.add(movie);
      return true;
    }
  },

  clear() {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    safeSetItem(key, []);
  },

  setAll(items) {
    const key = getUserStorageKey(KEYS.WATCHLIST);
    const dedupMap = new Map();
    items.forEach((item) => {
      if (item && item.slug) {
        if (!dedupMap.has(item.slug)) {
          dedupMap.set(item.slug, item);
        } else {
          const existing = dedupMap.get(item.slug);
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

function migrateGuestWatchlist(userId) {
  const guestWatchlistKey = getUserStorageKey(KEYS.WATCHLIST, "guest");
  const userWatchlistKey = getUserStorageKey(KEYS.WATCHLIST, userId);
  const guestWatchlist = safeGetItem(guestWatchlistKey, []);
  const userWatchlist = safeGetItem(userWatchlistKey, []);

  if (guestWatchlist.length > 0) {
    const mergedMap = new Map();
    userWatchlist.forEach((w) => mergedMap.set(w.slug, w));
    guestWatchlist.forEach((w) => {
      if (!mergedMap.has(w.slug)) {
        mergedMap.set(w.slug, w);
      } else {
        const existing = mergedMap.get(w.slug);
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
    mockStorage.removeItem(guestWatchlistKey);
  }
}

console.log("=== WATCHLIST STORE UNIT TESTS ===");

// 1. Add movie
activeUserId = "guest";
watchlistStore.clear();
assert.equal(watchlistStore.getAll().length, 0);

const movie1 = { slug: "du-phuong-hanh", name: "Dữ Phượng Hành", thumb_url: "https://example.com/1.jpg", addedAt: "2026-09-06T10:00:00.000Z" };
const movie2 = { slug: "tay-du-ky", name: "Tây Du Ký", thumb_url: "https://example.com/2.jpg", addedAt: "2026-09-06T10:05:00.000Z" };

watchlistStore.add(movie1);
assert.equal(watchlistStore.getAll().length, 1);
assert.equal(watchlistStore.isWatchlist("du-phuong-hanh"), true);
assert.equal(watchlistStore.isWatchlist("tay-du-ky"), false);
console.log("  ✅ PASS: Add movie works");

// 2. Add movie 2 (newest first)
watchlistStore.add(movie2);
const listAfter2 = watchlistStore.getAll();
assert.equal(listAfter2.length, 2);
assert.equal(listAfter2[0].slug, "tay-du-ky");
assert.equal(listAfter2[1].slug, "du-phuong-hanh");
console.log("  ✅ PASS: Newest movie appears first");

// 3. Add duplicate (deduplicates & bumps to top with new addedAt)
const movie1Updated = { ...movie1, addedAt: "2026-09-06T10:10:00.000Z" };
watchlistStore.add(movie1Updated);
const listAfterDup = watchlistStore.getAll();
assert.equal(listAfterDup.length, 2);
assert.equal(listAfterDup[0].slug, "du-phuong-hanh");
assert.equal(listAfterDup[1].slug, "tay-du-ky");
console.log("  ✅ PASS: Duplicate re-added bumps to top without duplicate row");

// 4. Toggle
const toggledOff = watchlistStore.toggle(movie1);
assert.equal(toggledOff, false);
assert.equal(watchlistStore.isWatchlist("du-phuong-hanh"), false);
assert.equal(watchlistStore.getAll().length, 1);

const toggledOn = watchlistStore.toggle(movie1);
assert.equal(toggledOn, true);
assert.equal(watchlistStore.isWatchlist("du-phuong-hanh"), true);
assert.equal(watchlistStore.getAll().length, 2);
console.log("  ✅ PASS: Toggle on/off works correctly");

// 5. Remove
watchlistStore.remove("tay-du-ky");
assert.equal(watchlistStore.getAll().length, 1);
assert.equal(watchlistStore.isWatchlist("tay-du-ky"), false);
console.log("  ✅ PASS: Remove works correctly");

// 6. Max 100 limit
watchlistStore.clear();
for (let i = 1; i <= 105; i++) {
  watchlistStore.add({
    slug: `movie-${i}`,
    name: `Movie ${i}`,
    thumb_url: `https://example.com/${i}.jpg`,
    addedAt: new Date(Date.now() + i * 1000).toISOString(),
  });
}
const list105 = watchlistStore.getAll();
assert.equal(list105.length, 100);
assert.equal(list105[0].slug, "movie-105"); // Newest
assert.equal(list105[99].slug, "movie-6"); // Oldest kept (1-5 dropped)
console.log("  ✅ PASS: Max 100 limit enforces oldest dropped");

// 7. Clear
watchlistStore.clear();
assert.equal(watchlistStore.getAll().length, 0);
console.log("  ✅ PASS: Clear works");

// 8. User isolation
activeUserId = "user-1";
watchlistStore.add({ slug: "movie-user-1", name: "User 1 Movie", thumb_url: "url" });
assert.equal(watchlistStore.getAll().length, 1);

activeUserId = "user-2";
assert.equal(watchlistStore.getAll().length, 0);
watchlistStore.add({ slug: "movie-user-2", name: "User 2 Movie", thumb_url: "url" });
assert.equal(watchlistStore.getAll().length, 1);
assert.equal(watchlistStore.isWatchlist("movie-user-1"), false);

activeUserId = "guest";
assert.equal(watchlistStore.getAll().length, 0);
console.log("  ✅ PASS: Strict user and guest storage isolation");

// 9. Guest to User Migration
activeUserId = "guest";
watchlistStore.add({ slug: "guest-fav-1", name: "Guest Movie 1", thumb_url: "url", addedAt: "2026-09-06T10:00:00.000Z" });
watchlistStore.add({ slug: "conflict-movie", name: "Guest Conflict", thumb_url: "url", addedAt: "2026-09-06T10:15:00.000Z" });

activeUserId = "target-user";
watchlistStore.add({ slug: "user-existing-1", name: "User Existing", thumb_url: "url", addedAt: "2026-09-06T09:00:00.000Z" });
watchlistStore.add({ slug: "conflict-movie", name: "User Conflict (older)", thumb_url: "url", addedAt: "2026-09-06T10:00:00.000Z" });

migrateGuestWatchlist("target-user");

const migrated = watchlistStore.getAll();
assert.equal(migrated.length, 3); // guest-fav-1, conflict-movie, user-existing-1
assert.equal(migrated[0].slug, "conflict-movie");
assert.equal(migrated[0].addedAt, "2026-09-06T10:15:00.000Z"); // Newer guest date preserved!

// Guest key should be cleaned up
activeUserId = "guest";
assert.equal(watchlistStore.getAll().length, 0);
console.log("  ✅ PASS: Guest to user migration preserves newer timestamp & cleans guest key");

console.log("\nALL 9 CHECKS PASSED SUCCESSFULLY!");
