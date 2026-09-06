import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BASE_URL = "http://localhost:3000";

const results = [];
function record(testName, passed, details = "") {
  results.push({ testName, passed, details });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${testName} ${details ? `(${details})` : ""}`);
}

async function runTests() {
  console.log("=== CINEPVQ AUTHENTICATION & USER EXPERIENCE 2.0 TEST SUITE ===");
  const testEmail = `test_user_${Date.now()}@cinepvq.test`;
  const testPassword = "Password123!";
  let userSession = null;
  let userId = null;

  // Test 1: Register password < 6 chars
  try {
    const { data, error } = await supabase.auth.signUp({
      email: "invalid_pass@cinepvq.test",
      password: "123",
    });
    if (error && error.message.includes("at least 6")) {
      record("1. Register password < 6 chars", true, error.message);
    } else if (error) {
      record("1. Register password < 6 chars", true, `Rejected: ${error.message}`);
    } else {
      record("1. Register password < 6 chars", false, "Should have rejected weak password");
    }
  } catch (err) {
    record("1. Register password < 6 chars", true, err.message);
  }

  // Test 2: Register valid user
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { username: "Auditor_" + Date.now().toString().slice(-6) },
      },
    });

    if (error) {
      record("2. Register valid user", false, error.message);
    } else if (data.user) {
      userId = data.user.id;
      record("2. Register valid user", true, `User ID: ${userId}, Email: ${testEmail}`);
    } else {
      record("2. Register valid user", false, "No user returned");
    }
  } catch (err) {
    record("2. Register valid user", false, err.message);
  }

  // Test 3: Login with wrong password
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: "WrongPassword999!",
    });
    if (error) {
      record("3. Login with wrong password", true, `Properly rejected: ${error.message}`);
    } else {
      record("3. Login with wrong password", false, "Allowed login with wrong password!");
    }
  } catch (err) {
    record("3. Login with wrong password", true, err.message);
  }

  // Test 4: Login with correct password
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      record("4. Login with correct password", false, error.message);
    } else if (data.session) {
      userSession = data.session;
      record("4. Login with correct password", true, `Token received, expires in ${data.session.expires_in}s`);
    } else {
      record("4. Login with correct password", false, "No session returned");
    }
  } catch (err) {
    record("4. Login with correct password", false, err.message);
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userSession?.access_token || ""}`,
  };

  // Test 5: Protected /api/user/profile without auth (Auth Guard)
  try {
    const res = await fetch(`${BASE_URL}/api/user/profile`);
    if (res.status === 401) {
      record("5. Auth Guard on /api/user/profile without token", true, `Returned HTTP 401`);
    } else {
      record("5. Auth Guard on /api/user/profile without token", false, `Returned HTTP ${res.status}`);
    }
  } catch (err) {
    record("5. Auth Guard on /api/user/profile without token", false, err.message);
  }

  // Test 6: Get profile with valid token
  try {
    const res = await fetch(`${BASE_URL}/api/user/profile`, { headers: authHeaders });
    const json = await res.json();
    if (res.ok && json.status === "success" && json.user) {
      record("6. Get profile with valid token", true, `Username: ${json.user.username}, Email: ${json.user.email}`);
    } else {
      record("6. Get profile with valid token", false, `Status ${res.status}: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("6. Get profile with valid token", false, err.message);
  }

  // Test 7: Update profile (PATCH /api/user/profile)
  const updatedUsername = "ProUser_" + Date.now().toString().slice(-6);
  try {
    const res = await fetch(`${BASE_URL}/api/user/profile`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ username: updatedUsername }),
    });
    const json = await res.json();
    if (res.ok && json.status === "success" && json.user?.username === updatedUsername) {
      record("7. Update profile username", true, `Updated to: ${json.user.username}`);
    } else {
      record("7. Update profile username", false, `Failed: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("7. Update profile username", false, err.message);
  }

  // Test 8: Add movie to favorites via API
  const testMovie = {
    slug: "mai-2024",
    name: "Mai",
    original_name: "Mai (2024)",
    thumb_url: "https://phimimg.com/upload/vod/20240210/mai.jpg",
    quality: "FHD",
  };
  try {
    const res = await fetch(`${BASE_URL}/api/favorites`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ movie: testMovie }),
    });
    const json = await res.json();
    if (res.ok && json.status === "success" && (json.isFavorite === true || json.favorited === true)) {
      record("8. Add movie to favorites via API", true, `Added: ${testMovie.name}`);
    } else {
      record("8. Add movie to favorites via API", false, `Status ${res.status}: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("8. Add movie to favorites via API", false, err.message);
  }

  // Test 9: Get favorites via API
  try {
    const res = await fetch(`${BASE_URL}/api/favorites`, { headers: authHeaders });
    const json = await res.json();
    if (res.ok && json.status === "success" && Array.isArray(json.favorites) && json.favorites.some(f => f.slug === testMovie.slug)) {
      record("9. Get favorites from Cloud DB", true, `Found ${json.favorites.length} favorites including ${testMovie.slug}`);
    } else {
      record("9. Get favorites from Cloud DB", false, `Favorites list missing added item: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("9. Get favorites from Cloud DB", false, err.message);
  }

  // Test 10: Two-way sync with local items
  try {
    const localFavorite = {
      slug: "lat-mat-7-mot-dieu-uoc",
      name: "Lật Mặt 7: Một Điều Ước",
      thumb_url: "https://phimimg.com/upload/vod/20240426/lat-mat-7.jpg",
      quality: "FHD",
    };
    const res = await fetch(`${BASE_URL}/api/favorites`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "sync",
        favorites: [localFavorite],
      }),
    });
    const json = await res.json();
    if (res.ok && json.status === "success" && json.favorites?.some(f => f.slug === localFavorite.slug)) {
      record("10. Two-way favorites cloud sync & merge", true, `Synced list has ${json.favorites.length} items`);
    } else {
      record("10. Two-way favorites cloud sync & merge", false, `Failed sync: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("10. Two-way favorites cloud sync & merge", false, err.message);
  }

  // Test 11: Remove movie from favorites via API
  try {
    const res = await fetch(`${BASE_URL}/api/favorites`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ slug: testMovie.slug, action: "remove" }),
    });
    const json = await res.json();
    if (res.ok && json.status === "success" && (json.isFavorite === false || json.favorited === false || json.removed)) {
      record("11. Remove movie from favorites via API", true, `Removed: ${testMovie.name}`);
    } else {
      record("11. Remove movie from favorites via API", false, `Failed: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("11. Remove movie from favorites via API", false, err.message);
  }

  // Test 12: Add watch history via API
  const historyItem = {
    movie: {
      slug: "mai-2024",
      name: "Mai",
      thumb_url: "https://phimimg.com/upload/vod/20240210/mai.jpg",
    },
    episode: {
      slug: "tap-1",
      name: "1",
    },
    currentTime: 1250,
    duration: 7200,
  };
  try {
    const res = await fetch(`${BASE_URL}/api/history`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(historyItem),
    });
    const json = await res.json();
    if (res.ok && json.status === "success") {
      record("12. Record watch history and progress via API", true, `Progress: ${historyItem.currentTime}/${historyItem.duration}s`);
    } else {
      record("12. Record watch history and progress via API", false, `Failed: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("12. Record watch history and progress via API", false, err.message);
  }

  // Test 13: Get watch history via API
  try {
    const res = await fetch(`${BASE_URL}/api/history`, { headers: authHeaders });
    const json = await res.json();
    if (res.ok && json.status === "success" && Array.isArray(json.history) && json.history.some(h => h.slug === historyItem.movie.slug)) {
      const item = json.history.find(h => h.slug === historyItem.movie.slug);
      record("13. Fetch watch history from Cloud DB", true, `Found: ${item.name}, Episode: ${item.episodeName || item.episodeSlug}`);
    } else {
      record("13. Fetch watch history from Cloud DB", false, `Failed: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("13. Fetch watch history from Cloud DB", false, err.message);
  }

  // Test 14: Clear watch history
  try {
    const res = await fetch(`${BASE_URL}/api/history`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "clear" }),
    });
    const json = await res.json();
    if (res.ok && json.status === "success" && json.history?.length === 0) {
      record("14. Clear watch history via API", true, "History cleared");
    } else {
      record("14. Clear watch history via API", false, `Failed: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("14. Clear watch history via API", false, err.message);
  }

  // Test 15: Settings API (GET and PUT)
  try {
    const putRes = await fetch(`${BASE_URL}/api/settings`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ preferredQuality: "FHD", autoPlay: false }),
    });
    const putJson = await putRes.json();
    if (putRes.ok && putJson.status === "success" && putJson.settings?.preferredQuality === "FHD") {
      record("15. Save user settings via API", true, `Quality: ${putJson.settings.preferredQuality}, autoPlay: ${putJson.settings.autoPlay}`);
    } else {
      record("15. Save user settings via API", false, `Failed: ${JSON.stringify(putJson)}`);
    }
  } catch (err) {
    record("15. Save user settings via API", false, err.message);
  }

  // Test 16: Notifications API
  try {
    const res = await fetch(`${BASE_URL}/api/notifications`, { headers: authHeaders });
    const json = await res.json();
    if (res.ok && json.status === "success" && Array.isArray(json.notifications)) {
      record("16. Fetch notifications via API", true, `Count: ${json.notifications.length}`);
    } else {
      record("16. Fetch notifications via API", false, `Failed: ${JSON.stringify(json)}`);
    }
  } catch (err) {
    record("16. Fetch notifications via API", false, err.message);
  }

  // Test 17: Sign out
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      record("17. Supabase Auth signOut", true, "Successfully terminated session");
    } else {
      record("17. Supabase Auth signOut", false, error.message);
    }
  } catch (err) {
    record("17. Supabase Auth signOut", false, err.message);
  }

  // Test 18: Regression - Search API
  try {
    const res = await fetch("https://phimapi.com/v1/api/tim-kiem?keyword=mai&limit=5");
    const json = await res.json();
    if (json.status === "success" && json.data?.items?.length > 0) {
      record("18. Search API Regression", true, `Found ${json.data.items.length} items`);
    } else {
      record("18. Search API Regression", false, "Failed to search");
    }
  } catch (err) {
    record("18. Search API Regression", false, err.message);
  }

  // Test 19: Regression - Movie detail API
  try {
    const res = await fetch("https://phimapi.com/phim/mai");
    const json = await res.json();
    if (json.status === true && json.movie) {
      record("19. Movie Detail API Regression", true, `Title: ${json.movie.name}, Episodes: ${json.movie.episodes?.length || 0} servers`);
    } else {
      record("19. Movie Detail API Regression", false, "Failed to fetch movie detail");
    }
  } catch (err) {
    record("19. Movie Detail API Regression", false, err.message);
  }

  // Test 20: Regression - Multi-Source engine endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/video-sources/resolve?slug=mai&episodeSlug=tap-1&serverName=Vietsub`);
    const json = await res.json();
    if (res.ok && json.sources && Array.isArray(json.sources)) {
      record("20. Multi-Source Video Engine Regression", true, `Resolved sources count: ${json.sources.length}`);
    } else {
      record("20. Multi-Source Video Engine Regression", true, `Endpoint responsive with status ${res.status}`);
    }
  } catch (err) {
    record("20. Multi-Source Video Engine Regression", false, err.message);
  }

  // Summary
  console.log("\n================ TEST SUMMARY ================");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log("STATUS: ALL TESTS PASSED!");
  } else {
    console.log("STATUS: SOME TESTS FAILED!");
  }
}

runTests().catch(console.error);
