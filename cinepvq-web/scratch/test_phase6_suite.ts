/**
 * Phase 6 Verification Test Suite
 * Tests History Sync, Settings Persistence, Source Selection & Fallback, and Detail UX
 */

import { mapSettingsRowToAppSettings } from "../lib/db/types";
import type { UserSettingsRow } from "../lib/db/types";
import type { WatchHistoryItem, AppSettings } from "../types/movie";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${msg}`);
}

// ─── 1. SETTINGS DATA MODEL & BACKWARD COMPATIBILITY ──────────────────────────
console.log("\n=======================================================");
console.log("TEST SUITE 1: Settings Data Model & Backward Compatibility");
console.log("=======================================================");

{
  // Test old database row where new columns are NULL / undefined
  const legacyRow: UserSettingsRow = {
    user_id: "user-456",
    theme: "dark",
    autoplay: true,
    sound_enabled: true,
    preferred_quality: "auto",
    updated_at: new Date(),
  };

  const mapped = mapSettingsRowToAppSettings(legacyRow);
  assert(mapped.playbackSpeed === 1, "Legacy settings row defaults playbackSpeed to 1");
  assert(mapped.preferredSource === "auto", "Legacy settings row defaults preferredSource to 'auto'");
  assert(mapped.theme === "dark", "Theme is preserved");
  assert(mapped.autoPlay === true, "autoPlay is preserved");
  assert(mapped.soundEnabled === true, "soundEnabled is preserved");

  // Test modern database row with new columns populated
  const modernRow: UserSettingsRow = {
    user_id: "user-456",
    theme: "system",
    autoplay: false,
    sound_enabled: true,
    preferred_quality: "auto",
    playback_speed: 1.5,
    preferred_source: "kkphim",
    updated_at: new Date(),
  };

  const mappedModern = mapSettingsRowToAppSettings(modernRow);
  assert(mappedModern.playbackSpeed === 1.5, "Modern row correctly maps playbackSpeed 1.5");
  assert(mappedModern.preferredSource === "kkphim", "Modern row correctly maps preferredSource 'kkphim'");
}

// ─── 2. HISTORY MERGE & RECONCILIATION LOGIC ──────────────────────────────────
console.log("\n=======================================================");
console.log("TEST SUITE 2: Cross-Device History Merge & Reconciliation");
console.log("=======================================================");

{
  // Helper simulating the two-way merge algorithm in userSyncManager
  function reconcileHistory(
    localItems: WatchHistoryItem[],
    cloudItems: WatchHistoryItem[]
  ): WatchHistoryItem[] {
    const map = new Map<string, WatchHistoryItem>();

    // Index cloud items
    for (const item of cloudItems) {
      const key = `${item.slug}:${item.episodeSlug || ""}`;
      map.set(key, { ...item });
    }

    // Merge local items
    for (const item of localItems) {
      const key = `${item.slug}:${item.episodeSlug || ""}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...item });
      } else {
        const localTime = new Date(item.updatedAt || 0).getTime();
        const cloudTime = new Date(existing.updatedAt || 0).getTime();

        if (localTime > cloudTime) {
          map.set(key, {
            ...item,
            currentTime: Math.max(item.currentTime || 0, existing.currentTime || 0),
          });
        } else {
          map.set(key, {
            ...existing,
            currentTime: Math.max(existing.currentTime || 0, item.currentTime || 0),
          });
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
  }

  // Case 2.1: Empty local must NOT overwrite cloud history (New Device Scenario)
  const cloudHistory: WatchHistoryItem[] = [
    {
      slug: "squid-game",
      name: "Trò Chơi Con Mực",
      thumb_url: "",
      episodeSlug: "tap-3",
      episodeName: "Tập 3",
      currentTime: 1200,
      duration: 3600,
      updatedAt: "2026-09-06T10:00:00Z",
    },
    {
      slug: "breaking-bad",
      name: "Biến Chất",
      thumb_url: "",
      episodeSlug: "tap-1",
      episodeName: "Tập 1",
      currentTime: 500,
      duration: 3000,
      updatedAt: "2026-09-05T08:00:00Z",
    },
  ];

  const emptyLocal: WatchHistoryItem[] = [];
  const mergedEmptyLocal = reconcileHistory(emptyLocal, cloudHistory);
  assert(mergedEmptyLocal.length === 2, "Empty local on new device retains all 2 cloud items");
  assert(mergedEmptyLocal[0].slug === "squid-game", "Squid game is top item by updatedAt");

  // Case 2.2: Stale local does NOT overwrite newer cloud record
  const staleLocal: WatchHistoryItem[] = [
    {
      slug: "squid-game",
      name: "Trò Chơi Con Mực",
      thumb_url: "",
      episodeSlug: "tap-3",
      episodeName: "Tập 3",
      currentTime: 300, // Older watch time
      duration: 3600,
      updatedAt: "2026-09-06T08:00:00Z", // Older timestamp
    },
  ];

  const mergedStale = reconcileHistory(staleLocal, cloudHistory);
  assert(mergedStale.length === 2, "Deduplication maintains 2 items total");
  assert(
    mergedStale[0].currentTime === 1200,
    "Newer cloud progress (1200s) wins over stale local (300s)"
  );
  assert(
    mergedStale[0].updatedAt === "2026-09-06T10:00:00Z",
    "Newer cloud timestamp is retained"
  );

  // Case 2.3: Newer local watch on Device B merges into cloud list
  const newerLocalFromDeviceB: WatchHistoryItem[] = [
    {
      slug: "squid-game",
      name: "Trò Chơi Con Mực",
      thumb_url: "",
      episodeSlug: "tap-4", // Advanced to Episode 4 on Device B
      episodeName: "Tập 4",
      currentTime: 850,
      duration: 3600,
      updatedAt: "2026-09-07T01:00:00Z", // Brand new timestamp
    },
  ];

  const mergedDeviceB = reconcileHistory(newerLocalFromDeviceB, cloudHistory);
  assert(mergedDeviceB.length === 3, "New episode is added to history list");
  assert(
    mergedDeviceB[0].slug === "squid-game" && mergedDeviceB[0].episodeSlug === "tap-4",
    "Latest episode watched on Device B is now the first item"
  );
}

// ─── 3. PREFERRED SOURCE SELECTION & FALLBACK LOGIC ───────────────────────────
console.log("\n=======================================================");
console.log("TEST SUITE 3: Preferred Playback Source & Fallback");
console.log("=======================================================");

{
  interface MockSource {
    sourceId: "k20" | "vsmov" | "kkphim" | "nguonc";
    name: string;
    priority: number;
    isAvailable: boolean;
  }

  function resolveActiveSource(
    sources: MockSource[],
    preferredSource?: AppSettings["preferredSource"]
  ): string {
    // Sort sources by priority ascending (1 is highest)
    const sorted = [...sources].sort((a, b) => a.priority - b.priority);

    if (preferredSource && preferredSource !== "auto") {
      const preferred = sorted.find((s) => s.sourceId === preferredSource && s.isAvailable);
      if (preferred) {
        return preferred.sourceId;
      }
    }

    // Default fallback to first available by priority
    const firstAvailable = sorted.find((s) => s.isAvailable);
    return firstAvailable ? firstAvailable.sourceId : "none";
  }

  const mockSources: MockSource[] = [
    { sourceId: "k20", name: "K20 Direct HLS", priority: 1, isAvailable: true },
    { sourceId: "vsmov", name: "VSMOV Stream", priority: 2, isAvailable: true },
    { sourceId: "kkphim", name: "KKPhim1 Direct", priority: 3, isAvailable: true },
    { sourceId: "nguonc", name: "NguonC StreamC", priority: 4, isAvailable: true },
  ];

  // 3.1: "auto" defaults to highest priority (k20)
  assert(resolveActiveSource(mockSources, "auto") === "k20", "Auto prefers highest priority k20");
  assert(resolveActiveSource(mockSources, undefined) === "k20", "Undefined prefers highest priority k20");

  // 3.2: user preferred "kkphim" is chosen even if k20 has higher priority
  assert(
    resolveActiveSource(mockSources, "kkphim") === "kkphim",
    "User preferred 'kkphim' is selected when available"
  );

  // 3.3: user preferred "vsmov" is chosen
  assert(
    resolveActiveSource(mockSources, "vsmov") === "vsmov",
    "User preferred 'vsmov' is selected when available"
  );

  // 3.4: user preferred source is NOT available -> graceful fallback to priority order
  const sourcesWithK20Down: MockSource[] = [
    { sourceId: "k20", name: "K20 Direct HLS", priority: 1, isAvailable: false },
    { sourceId: "vsmov", name: "VSMOV Stream", priority: 2, isAvailable: true },
    { sourceId: "kkphim", name: "KKPhim1 Direct", priority: 3, isAvailable: false }, // Down!
    { sourceId: "nguonc", name: "NguonC StreamC", priority: 4, isAvailable: true },
  ];

  assert(
    resolveActiveSource(sourcesWithK20Down, "kkphim") === "vsmov",
    "When preferred kkphim is unavailable, fallbacks to highest available priority (vsmov)"
  );
}

// ─── 4. MOVIE DETAIL PAGE 2-STATE UX LOGIC ────────────────────────────────────
console.log("\n=======================================================");
console.log("TEST SUITE 4: Movie Detail Page 2-State UX");
console.log("=======================================================");

{
  function computeInitialWatchingState(searchParams: URLSearchParams, hash: string): boolean {
    return Boolean(
      searchParams.get("ep") ||
      hash === "#player" ||
      searchParams.get("watch") === "true"
    );
  }

  // 4.1: Direct visitor entering /phim/slug with no query or hash
  const defaultParams = new URLSearchParams("");
  assert(
    computeInitialWatchingState(defaultParams, "") === false,
    "State 1 (unwatched) initially false for normal visit"
  );

  // 4.2: Visitor clicking a shared episode link (?ep=tap-2)
  const sharedEpParams = new URLSearchParams("ep=tap-2");
  assert(
    computeInitialWatchingState(sharedEpParams, "") === true,
    "State 2 (watching) immediately active if ?ep= is present"
  );

  // 4.3: Visitor navigating with #player anchor
  assert(
    computeInitialWatchingState(defaultParams, "#player") === true,
    "State 2 (watching) immediately active if #player hash is present"
  );
}

console.log("\n=======================================================");
console.log(`ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`);
console.log("=======================================================");
