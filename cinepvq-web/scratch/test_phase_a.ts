// cinepvq-web/scratch/test_phase_a.ts
/**
 * Comprehensive Test Suite for Phase A: KKPhim Catalog Integration
 */

import {
  getLatestMovies,
  getMoviesByCategory,
  getMoviesByGenre,
  getMoviesByCountry,
  getMoviesByYear,
  searchMovies,
  getMovieDetail,
} from "../services/api";
import {
  CINEPVQ_TO_KKPHIM_CATEGORY_MAP,
  CINEPVQ_TO_KKPHIM_GENRE_MAP,
  KKPHIM_TO_CINEPVQ_CATEGORY_MAP,
  KKPHIM_TO_CINEPVQ_GENRE_MAP,
  normalizeImageUrl,
} from "../services/kkphimCatalogAdapter";
import { extractCategoriesFromMovie } from "../types/movie";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("     PHASE A - KKPHIM CATALOG INTEGRATION TEST SUITE   ");
  console.log("=======================================================\n");

  // ── TEST 1: Taxonomy Mappings ──────────────────────────────────────────────
  console.log("--- 1. Testing Taxonomy Mappings ---");
  assert(
    CINEPVQ_TO_KKPHIM_CATEGORY_MAP["dang-chieu"] === "phim-chieu-rap",
    "dang-chieu maps to phim-chieu-rap"
  );
  assert(
    CINEPVQ_TO_KKPHIM_GENRE_MAP["phim-hai"] === "hai-huoc",
    "phim-hai maps to hai-huoc"
  );
  assert(
    CINEPVQ_TO_KKPHIM_GENRE_MAP["khoa-hoc-vien-tuong"] === "vien-tuong",
    "khoa-hoc-vien-tuong maps to vien-tuong"
  );
  assert(
    KKPHIM_TO_CINEPVQ_CATEGORY_MAP["phim-chieu-rap"] === "dang-chieu",
    "Reverse: phim-chieu-rap maps back to dang-chieu"
  );
  assert(
    KKPHIM_TO_CINEPVQ_GENRE_MAP["hai-huoc"] === "phim-hai",
    "Reverse: hai-huoc maps back to phim-hai"
  );
  assert(
    KKPHIM_TO_CINEPVQ_GENRE_MAP["vien-tuong"] === "khoa-hoc-vien-tuong",
    "Reverse: vien-tuong maps back to khoa-hoc-vien-tuong"
  );

  // ── TEST 2: Image Normalization Helper ────────────────────────────────────
  console.log("\n--- 2. Testing Image Normalization Helper ---");
  assert(
    normalizeImageUrl("https://phimimg.com/uploads/xyz.webp") ===
      "https://phimimg.com/uploads/xyz.webp",
    "Absolute https:// URL preserved"
  );
  assert(
    normalizeImageUrl("uploads/xyz.webp", "https://phimimg.com") ===
      "https://phimimg.com/uploads/xyz.webp",
    "Relative path prefixed with CDN domain"
  );
  assert(
    normalizeImageUrl("/uploads/xyz.webp", "https://phimimg.com/") ===
      "https://phimimg.com/uploads/xyz.webp",
    "Leading slash and trailing slash handled cleanly"
  );
  assert(normalizeImageUrl("") === "", "Empty string returns empty string");
  assert(normalizeImageUrl(null) === "", "Null returns empty string");

  // ── TEST 3: Latest Movies Endpoint & Pagination ───────────────────────────
  console.log("\n--- 3. Testing getLatestMovies(page) ---");
  const latest1 = await getLatestMovies(1);
  assert(latest1.status === 200, "getLatestMovies(1) returns HTTP 200");
  assert(latest1.data.status === "success", "Response status is 'success'");
  assert(
    latest1.data.paginate.current_page === 1,
    "Paginate current_page is 1"
  );
  assert(
    latest1.data.paginate.total_items > 20000,
    `Total items count is healthy: ${latest1.data.paginate.total_items}`
  );
  assert(
    latest1.data.items.length === 24,
    `Page 1 returns 24 items (got ${latest1.data.items.length})`
  );

  const firstLatest = latest1.data.items[0];
  assert(Boolean(firstLatest.name), `Item 0 name is present: ${firstLatest.name}`);
  assert(Boolean(firstLatest.slug), `Item 0 slug is present: ${firstLatest.slug}`);
  assert(
    firstLatest.thumb_url.startsWith("http"),
    `Item 0 thumb_url is absolute: ${firstLatest.thumb_url}`
  );
  assert(
    firstLatest.poster_url.startsWith("http"),
    `Item 0 poster_url is absolute: ${firstLatest.poster_url}`
  );

  const latest2 = await getLatestMovies(2);
  assert(latest2.status === 200, "getLatestMovies(2) returns HTTP 200");
  assert(
    latest2.data.paginate.current_page === 2,
    "Page 2 current_page is 2"
  );
  assert(
    latest1.data.items[0].slug !== latest2.data.items[0].slug,
    "Page 1 and Page 2 contain different movies"
  );

  // ── TEST 4: Category Endpoints & Mappings ─────────────────────────────────
  console.log("\n--- 4. Testing getMoviesByCategory ---");
  for (const cat of ["phim-bo", "phim-le", "hoat-hinh", "tv-shows", "dang-chieu"]) {
    const res = await getMoviesByCategory(cat, 1);
    assert(res.status === 200, `Category '${cat}' returns HTTP 200`);
    assert(res.data.status === "success", `Category '${cat}' status is 'success'`);
    assert(res.data.items.length > 0, `Category '${cat}' returns items (${res.data.items.length})`);
    assert(
      res.data.paginate.total_items > 0,
      `Category '${cat}' total_items: ${res.data.paginate.total_items}`
    );
  }

  // ── TEST 5: Genre Endpoints & Mappings ────────────────────────────────────
  console.log("\n--- 5. Testing getMoviesByGenre ---");
  for (const genre of ["hanh-dong", "phim-hai", "khoa-hoc-vien-tuong", "kinh-di"]) {
    const res = await getMoviesByGenre(genre, 1);
    assert(res.status === 200, `Genre '${genre}' returns HTTP 200`);
    assert(res.data.status === "success", `Genre '${genre}' status is 'success'`);
    assert(res.data.items.length > 0, `Genre '${genre}' returns items (${res.data.items.length})`);
  }

  // ── TEST 6: Country Endpoints ─────────────────────────────────────────────
  console.log("\n--- 6. Testing getMoviesByCountry ---");
  for (const country of ["trung-quoc", "han-quoc", "au-my"]) {
    const res = await getMoviesByCountry(country, 1);
    assert(res.status === 200, `Country '${country}' returns HTTP 200`);
    assert(res.data.status === "success", `Country '${country}' status is 'success'`);
    assert(res.data.items.length > 0, `Country '${country}' returns items (${res.data.items.length})`);
  }

  // ── TEST 7: Year Endpoint ─────────────────────────────────────────────────
  console.log("\n--- 7. Testing getMoviesByYear ---");
  const yearRes = await getMoviesByYear(2024, 1);
  assert(yearRes.status === 200, "Year 2024 returns HTTP 200");
  assert(yearRes.data.status === "success", "Year 2024 status is 'success'");
  assert(yearRes.data.items.length > 0, `Year 2024 returns items (${yearRes.data.items.length})`);

  // ── TEST 8: Search Endpoint & Pagination ──────────────────────────────────
  console.log("\n--- 8. Testing searchMovies ---");
  const s1 = await searchMovies("batman", 1);
  assert(s1.status === 200, "Search 'batman' page 1 returns HTTP 200");
  assert(s1.data.status === "success", "Search status is 'success'");
  assert(s1.data.items.length > 0, `Search returns ${s1.data.items.length} items`);
  assert(s1.data.paginate.current_page === 1, "Search page 1 paginate is 1");

  const s2 = await searchMovies("batman", 2);
  assert(s2.status === 200, "Search 'batman' page 2 returns HTTP 200");
  assert(s2.data.paginate.current_page === 2, "Search page 2 paginate is 2");
  assert(
    s1.data.items[0].slug !== s2.data.items[0].slug,
    "Search page 1 and page 2 return different results"
  );

  // ── TEST 9: Movie Detail Endpoint (Series + Single) ───────────────────────
  console.log("\n--- 9. Testing getMovieDetail ---");
  
  // Test Series with IMDb ID & Multiple Episodes
  const seriesDetail = await getMovieDetail("cuoc-goi-khan-cap-9-1-1-phan-9");
  assert(seriesDetail.status === 200, "Series detail returns HTTP 200");
  assert(seriesDetail.data.status === "success", "Series detail status is 'success'");
  const sMovie = seriesDetail.data.movie;
  assert(Boolean(sMovie.name), `Series name: ${sMovie.name}`);
  assert(sMovie.imdb_id === "tt7235466", `IMDb ID parsed correctly: ${sMovie.imdb_id}`);
  assert(sMovie.episodes.length > 0, `Has episode servers: ${sMovie.episodes.length}`);
  assert(sMovie.episodes[0].items.length > 0, `Has episode items: ${sMovie.episodes[0].items.length}`);
  assert(
    sMovie.episodes[0].items[0].embed.startsWith("http"),
    `Episode embed link is valid: ${sMovie.episodes[0].items[0].embed.slice(0, 40)}...`
  );

  // Test extractCategoriesFromMovie compatibility
  const parsedMeta = extractCategoriesFromMovie(sMovie);
  assert(parsedMeta.genres.length > 0, `extractCategories genres: ${parsedMeta.genres.join(", ")}`);
  assert(parsedMeta.year === "2025", `extractCategories year: ${parsedMeta.year}`);
  assert(parsedMeta.countries.length > 0, `extractCategories countries: ${parsedMeta.countries.join(", ")}`);
  assert(parsedMeta.formats.includes("Phim bộ"), `extractCategories format: ${parsedMeta.formats.join(", ")}`);

  // Test Multi-server movie
  const multiServer = await getMovieDetail("du-phuong-hanh");
  assert(multiServer.status === 200, "Multi-server detail returns HTTP 200");
  assert(
    multiServer.data.movie.episodes.length >= 2,
    `Multi-server has ${multiServer.data.movie.episodes.length} servers (${multiServer.data.movie.episodes.map(e => e.server_name).join(", ")})`
  );

  // ── TEST 10: Slug Compatibility Benchmark ─────────────────────────────────
  console.log("\n--- 10. Slug Compatibility Benchmark (NguonC vs KKPhim) ---");
  // Sample popular slugs from NguonC / Cinepvq database
  const sampleSlugs = [
    "du-phuong-hanh",
    "mai",
    "gap-lai-chi-bau",
    "dao-pho-va-piano",
    "lat-mat-7-mot-dieu-uoc",
    "nha-ba-nu",
    "bo-gia",
    "cau-be-but-chi-shin",
    "doraemon",
    "one-piece",
  ];

  let matchedSlugs = 0;
  for (const slug of sampleSlugs) {
    try {
      const res = await getMovieDetail(slug);
      if (res.data?.movie?.name) {
        matchedSlugs++;
        console.log(`  [MATCH] ${slug} -> "${res.data.movie.name}"`);
      }
    } catch {
      console.log(`  [MISS]  ${slug} not found on KKPhim with exact slug`);
    }
  }
  const matchRate = (matchedSlugs / sampleSlugs.length) * 100;
  console.log(`\n  Exact Slug Match Rate on sample: ${matchedSlugs}/${sampleSlugs.length} (${matchRate}%)`);
  assert(matchedSlugs >= 5, `At least 50% exact slug match on popular titles (got ${matchRate}%)`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n=======================================================");
  console.log(`  TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} failed)`);
  console.log("=======================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
