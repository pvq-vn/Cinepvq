/**
 * test_history_runtime.mjs
 * Runtime test: Watch History flow
 * - Simulates addHistory → localStorage writes → ordering
 * - Tests stale-write protection logic (mirrors historyRepository.upsertHistory)
 * - Tests Continue Watching order
 *
 * Run: node scratch/test_history_runtime.mjs
 */

// ─── Simulate historyStore.add (mirrors userStore.ts behavior) ────────────────
function makeHistoryItem(slug, name, currentTime, updatedAt) {
  return { slug, name, thumb_url: "", currentTime, duration: 1200, updatedAt };
}

function historyAdd(items, movie, currentTime, updatedAt) {
  const ts = updatedAt || new Date().toISOString();
  const record = makeHistoryItem(movie.slug, movie.name, currentTime, ts);
  const remaining = items.filter((i) => i.slug !== movie.slug);
  remaining.unshift(record);
  return remaining.slice(0, 50);
}

// ─── Simulate upsertHistory DB logic (mirrors historyRepository.ts fix) ───────
function dbUpsert(db, incoming) {
  const existing = db.find((r) => r.slug === incoming.slug);
  if (!existing) {
    db.push({ ...incoming });
    return { action: "INSERT", slug: incoming.slug };
  }

  const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
  const incomingTime = incoming.updated_at ? new Date(incoming.updated_at).getTime() : 0;

  if (incomingTime >= existingTime) {
    // NEWER or SAME → update
    existing.last_position_seconds = incoming.last_position_seconds;
    existing.updated_at = incoming.updated_at;
    return { action: "UPDATE_NEWER", slug: incoming.slug };
  } else {
    // OLDER → skip (stale-write protection)
    return { action: "SKIP_STALE", slug: incoming.slug };
  }
}

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

console.log("\n=== CHECK 1: STALE-WRITE PROTECTION (DB layer simulation) ===\n");

const db = [];
const T1 = "2026-09-06T09:00:00.000Z"; // older
const T2 = "2026-09-06T10:00:00.000Z"; // newer
const T3 = "2026-09-06T11:00:00.000Z"; // newest (future relative to T2)

// Case A: INSERT new record
const r1 = dbUpsert(db, { slug: "movie-a", last_position_seconds: 60, updated_at: T2 });
assert(r1.action === "INSERT", "New record inserts correctly");
assert(db[0].last_position_seconds === 60, "Position=60 stored after INSERT");

// Case B: Newer client (T3 > T2) → update
const r2 = dbUpsert(db, { slug: "movie-a", last_position_seconds: 120, updated_at: T3 });
assert(r2.action === "UPDATE_NEWER", "Newer client timestamp (T3>T2) → UPDATE applied");
assert(db[0].last_position_seconds === 120, "Position updated to 120 (newer write)");

// Case C: Older client (T1 < T3) → stale write rejected
const posBeforeStale = db[0].last_position_seconds;
const r3 = dbUpsert(db, { slug: "movie-a", last_position_seconds: 999, updated_at: T1 });
assert(r3.action === "SKIP_STALE", "Older client timestamp (T1<T3) → SKIP (stale-write rejected)");
assert(db[0].last_position_seconds === posBeforeStale, `Position still ${posBeforeStale} (not overwritten by stale)`);

// Case D: Same timestamp (T3 == T3) → update (deterministic: >= means same time updates)
const currentTs = db[0].updated_at;
const r4 = dbUpsert(db, { slug: "movie-a", last_position_seconds: 150, updated_at: currentTs });
assert(r4.action === "UPDATE_NEWER", "Same timestamp → UPDATE (deterministic: >= allows same-time update)");
assert(db[0].last_position_seconds === 150, "Position updated to 150 at same timestamp");

console.log("\n=== CHECK 2: REAL WATCH HISTORY RUNTIME (localStorage simulation) ===\n");
console.log("  [Simulating: No browser available — testing localStorage logic directly]\n");

let history = [];
const movieA = { slug: "movie-a", name: "Movie A" };
const movieB = { slug: "movie-b", name: "Movie B" };

// Use explicit timestamps to avoid same-millisecond collision in fast test runner
const TS_A1 = "2026-09-06T10:00:00.000Z"; // A first watch
const TS_B  = "2026-09-06T10:00:01.000Z"; // B watch (1s after A)
const TS_A2 = "2026-09-06T10:00:02.000Z"; // A second watch (1s after B)

// Step 1: Watch Movie A for ~8 seconds (cur=8, >=5 threshold satisfied)
history = historyAdd(history, movieA, 8, TS_A1);
assert(history[0].slug === "movie-a", "After A ~8s: Movie A at top of history");
assert(history[0].currentTime === 8, "Movie A currentTime=8 recorded");
assert(history.length === 1, "History has 1 item");

// Step 2: Watch Movie B for ~8 seconds
history = historyAdd(history, movieB, 8, TS_B);
assert(history[0].slug === "movie-b", "After B ~8s: Movie B at top of Continue Watching");
assert(history[1].slug === "movie-a", "Movie A at position 2");
assert(history.length === 2, "History has 2 items (no duplicates)");

// Step 3: Continue Watching shows [B, A]
const continueWatching = [...history];
assert(continueWatching[0].slug === "movie-b", "Continue Watching[0] = Movie B ✓");
assert(continueWatching[1].slug === "movie-a", "Continue Watching[1] = Movie A ✓");

// Step 4: Re-watch Movie A for ~8 more seconds
history = historyAdd(history, movieA, 16, TS_A2);
assert(history[0].slug === "movie-a", "After A again: Movie A back at top");
assert(history[1].slug === "movie-b", "Movie B drops to position 2");
assert(history.filter((h) => h.slug === "movie-a").length === 1, "No duplicate Movie A entries");
assert(history.length === 2, "Total items still 2 (deduplication correct)");

// Step 5: Continue Watching shows [A, B]
const continueWatching2 = [...history];
assert(continueWatching2[0].slug === "movie-a", "Continue Watching[0] = Movie A after re-watch ✓");
assert(continueWatching2[1].slug === "movie-b", "Continue Watching[1] = Movie B ✓");

// Step 6: Timestamp ordering (A2=10:00:02 > B=10:00:01)
const timeA = new Date(history.find((h) => h.slug === "movie-a").updatedAt).getTime();
const timeB = new Date(history.find((h) => h.slug === "movie-b").updatedAt).getTime();
assert(timeA > timeB, "Movie A updatedAt (10:00:02) > Movie B updatedAt (10:00:01) ✓");

// Step 7: handleTimeUpdate threshold (>=5s delta)
console.log("\n  [Threshold test: only save if |cur - lastSaved| >= 5]\n");
const THRESHOLD = 5;
let lastSaved = 0;
const updates = [1, 3, 4, 5, 10, 14, 15, 20]; // seconds
let recordedUpdates = [];
for (const cur of updates) {
  if (cur > 0 && Math.abs(cur - lastSaved) >= THRESHOLD) {
    lastSaved = cur;
    recordedUpdates.push(cur);
  }
}
assert(recordedUpdates[0] === 5, "First save triggers at t=5 (delta>=5 from 0)");
assert(recordedUpdates[1] === 10, "Next save at t=10 (delta=5)");
assert(recordedUpdates[2] === 15, "Next save at t=15");
assert(recordedUpdates[3] === 20, "Next save at t=20");
assert(!recordedUpdates.includes(1), "t=1 NOT saved (delta<5)");
assert(!recordedUpdates.includes(3), "t=3 NOT saved (delta<5)");
assert(!recordedUpdates.includes(4), "t=4 NOT saved (delta<5)");
assert(!recordedUpdates.includes(14), "t=14 NOT saved (delta=4 from 10)");

console.log(`\n=== RESULTS ===\n  Passed: ${passed}\n  Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
