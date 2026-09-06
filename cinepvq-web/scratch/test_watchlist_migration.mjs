// scratch/test_watchlist_migration.mjs
// Test Watchlist Guest -> User migration & conflict resolution

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store,
  };
})();

global.window = {
  localStorage: localStorageMock,
  dispatchEvent: () => {},
};
global.localStorage = localStorageMock;

async function runTests() {
  console.log("--- Starting Watchlist Migration Tests ---");

  // Load userStore
  const userStore = await import("../services/userStore.ts");
  const { watchlistStore, authStore, migrateGuestDataToUser } = userStore;

  // 1. Guest session: guest adds movie A, B, C
  localStorageMock.clear();
  await authStore.logout(); // Ensure guest mode

  const movieA = { slug: "film-a", name: "Film A", thumb_url: "/a.jpg", addedAt: "2026-09-01T10:00:00.000Z" };
  const movieB = { slug: "film-b", name: "Film B", thumb_url: "/b.jpg", addedAt: "2026-09-02T10:00:00.000Z" };
  const movieC = { slug: "film-c", name: "Film C", thumb_url: "/c.jpg", addedAt: "2026-09-03T10:00:00.000Z" };

  watchlistStore.add(movieA);
  watchlistStore.add(movieB);
  watchlistStore.add(movieC);

  let guestList = watchlistStore.getAll();
  console.log("Guest list count:", guestList.length);
  if (guestList.length !== 3) throw new Error("Guest list should have 3 items");

  // 2. Simulate existing user data in user namespace: user has movie A (added later at Sept 5), and movie D (added at Sept 1)
  const movieA_user = { slug: "film-a", name: "Film A (Updated)", thumb_url: "/a_new.jpg", addedAt: "2026-09-05T10:00:00.000Z" };
  const movieD_user = { slug: "film-d", name: "Film D", thumb_url: "/d.jpg", addedAt: "2026-09-01T08:00:00.000Z" };
  
  const userKey = "cinepvq_watchlist_user123";
  localStorageMock.setItem(userKey, JSON.stringify([movieA_user, movieD_user]));

  // 3. Migrate guest data to user123
  console.log("Migrating guest data to user123...");
  migrateGuestDataToUser("user123");
  authStore.updateUser({ id: "user123", email: "test@example.com", username: "Tester" });

  // 4. Verify merged watchlist in user store
  const mergedList = watchlistStore.getAll();
  console.log("Merged list count:", mergedList.length);
  console.log("Merged list slugs:", mergedList.map(m => m.slug));

  // Assertions
  if (mergedList.length !== 4) {
    throw new Error(`Expected 4 items after merge, got ${mergedList.length}`);
  }

  const slugs = mergedList.map(m => m.slug);
  if (!slugs.includes("film-a") || !slugs.includes("film-b") || !slugs.includes("film-c") || !slugs.includes("film-d")) {
    throw new Error("Missing items in merged list");
  }

  // Deduplication check
  const filmACount = slugs.filter(s => s === "film-a").length;
  if (filmACount !== 1) {
    throw new Error(`film-a is duplicated! count: ${filmACount}`);
  }

  // Timestamp conflict resolution check: film-a had Sept 1 (guest) and Sept 5 (user). Newest must win!
  const mergedA = mergedList.find(m => m.slug === "film-a");
  if (mergedA.addedAt !== "2026-09-05T10:00:00.000Z") {
    throw new Error(`Expected film-a addedAt to be 2026-09-05T10:00:00.000Z, got ${mergedA.addedAt}`);
  }
  if (mergedA.thumb_url !== "/a_new.jpg") {
    throw new Error(`Expected film-a to keep newer metadata, got ${mergedA.thumb_url}`);
  }

  // Check sort order: newest first
  for (let i = 0; i < mergedList.length - 1; i++) {
    const timeA = new Date(mergedList[i].addedAt).getTime();
    const timeNext = new Date(mergedList[i + 1].addedAt).getTime();
    if (timeA < timeNext) {
      throw new Error(`List not sorted newest first at index ${i}`);
    }
  }

  // Verify guest storage was cleared to prevent re-merging or pollution
  const guestRaw = localStorageMock.getItem("cinepvq_watchlist_guest");
  if (guestRaw && JSON.parse(guestRaw).length > 0) {
    throw new Error("Guest watchlist was not cleared after migration");
  }

  console.log("All Watchlist Migration Tests PASSED!");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
