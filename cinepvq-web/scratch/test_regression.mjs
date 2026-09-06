// scratch/test_regression.mjs
async function run() {
  console.log("=== REGRESSION TESTS ===");

  // 1. Search page API & response
  console.log("\n1. Testing Search API & Filters...");
  const searchRes = await fetch("http://localhost:3000/api/proxy/nguonc/films/search?keyword=avatar&page=1");
  const searchData = await searchRes.json();
  console.log("Search 'avatar' status:", searchRes.status, "Items count:", searchData.data?.items?.length || 0);
  if (searchRes.status !== 200) throw new Error("Search API failed");

  // 2. Movie Detail page API
  console.log("\n2. Testing Movie Detail API...");
  const detailRes = await fetch("http://localhost:3000/api/proxy/nguonc/film/du-phuong-hanh");
  const detailData = await detailRes.json();
  console.log("Detail 'du-phuong-hanh' status:", detailRes.status, "Title:", detailData.movie?.name || detailData.data?.item?.name);
  if (detailRes.status !== 200) throw new Error("Detail API failed");

  // 3. Video Sources Resolve API with serverName
  console.log("\n3. Testing Video Sources Resolve API...");
  const vsResolve = await fetch("http://localhost:3000/api/video-sources/resolve?slug=du-phuong-hanh&title=Dữ+phượng+hành&season=1&episode=1&type=series&serverName=Thuyết+minh+#1&episodeSlug=tap-1");
  const vsData = await vsResolve.json();
  console.log("Resolve status:", vsResolve.status, "Sources count:", vsData.sources?.length || 0);
  const activeSource = vsData.sources?.[0];
  console.log("Primary resolved source:", activeSource?.displayName, activeSource?.url);
  if (!vsData.sources || vsData.sources.length === 0) throw new Error("Resolve API returned 0 sources");

  // 4. Testing K20 Stream API...
  console.log("\n4. Testing K20 Stream API...");
  const k20Res = await fetch("http://localhost:3000/api/k20/stream?slug=du-phuong-hanh&episode=1&type=series&serverName=Thuy%E1%BA%BFt+minh+%231");
  const k20Data = await k20Res.json();
  console.log("K20 Stream API status:", k20Res.status, "Status:", k20Data.status, "Stream URL:", k20Data.stream?.url, "Title:", k20Data.stream?.title);
  if (!k20Data.stream?.url) throw new Error("K20 stream resolution failed");

  // 5. Check Home Page SSR
  console.log("\n5. Testing Home Page SSR...");
  const homeRes = await fetch("http://localhost:3000/");
  console.log("Home SSR status:", homeRes.status);
  const homeHtml = await homeRes.text();
  console.log("Home HTML length:", homeHtml.length, "Includes 'Cinepvq' or 'Cinépvq':", homeHtml.includes("Cinepvq") || homeHtml.includes("Cinépvq"));
  if (homeRes.status !== 200) throw new Error("Home SSR failed");

  // 6. Check Auth & User routes
  console.log("\n6. Testing Auth & User routes...");
  const loginRes = await fetch("http://localhost:3000/dang-nhap");
  console.log("/dang-nhap status:", loginRes.status);
  if (loginRes.status !== 200) throw new Error("/dang-nhap failed");

  const favRes = await fetch("http://localhost:3000/yeu-thich");
  console.log("/yeu-thich status:", favRes.status);
  if (favRes.status !== 200) throw new Error("/yeu-thich failed");

  const histRes = await fetch("http://localhost:3000/lich-su");
  console.log("/lich-su status:", histRes.status);
  if (histRes.status !== 200) throw new Error("/lich-su failed");

  console.log("\n=== ALL REGRESSION CHECKS PASSED! ===");
}

run().catch(e => {
  console.error("Regression check failed:", e);
  process.exit(1);
});
