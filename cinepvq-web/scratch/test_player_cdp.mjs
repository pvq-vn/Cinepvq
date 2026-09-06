// Test player Vietsub <-> Thuyet Minh audio switching via CDP
const CDP_HTTP = "http://127.0.0.1:9224";

async function run() {
  console.log("=== TEST: Player Audio/Server Switch CDP Test ===");
  
  // 1. Get targets
  let targetsRes = await fetch(`${CDP_HTTP}/json`);
  let targets = await targetsRes.json();
  let pageTarget = targets.find(t => t.type === "page");
  
  if (!pageTarget) {
    const createRes = await fetch(`${CDP_HTTP}/json/new?about:blank`, { method: "PUT" });
    pageTarget = await createRes.json();
  }
  
  console.log("Target page:", pageTarget.url, pageTarget.webSocketDebuggerUrl);
  
  const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
  
  let msgId = 1;
  const pending = new Map();
  const mediaRequests = [];
  const apiRequests = [];
  
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    } else if (msg.method === "Network.requestWillBeSent") {
      const url = msg.params.request.url;
      if (url.includes("/api/video-sources/resolve") || url.includes("/api/k20/stream")) {
        apiRequests.push(url);
        console.log("  [API Request]", url);
      }
      if (url.includes(".m3u8") || url.includes("proxy-playlist") || url.includes(".ts") || url.includes("playlist")) {
        mediaRequests.push({ url, time: Date.now() });
        console.log("  [Media Request]", url.length > 120 ? url.substring(0, 120) + "..." : url);
      }
    }
  };
  
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  
  await send("Network.enable");
  await send("Page.enable");
  await send("Runtime.enable");
  
  console.log("\n[Step 1] Navigating to /phim/du-phuong-hanh...");
  await send("Page.navigate", { url: "http://localhost:3000/phim/du-phuong-hanh" });
  
  // Wait 10 seconds for initial load & player source resolution
  console.log("Waiting for player to initialize and resolve Vietsub stream...");
  await new Promise(r => setTimeout(r, 10000));
  
  // Check media requests so far
  console.log("\nInitial media requests count:", mediaRequests.length);
  const initialMedia = [...mediaRequests];
  
  // Inspect video element & current state
  const state1 = await send("Runtime.evaluate", {
    expression: `(() => {
      const v = document.querySelector("video");
      const iframe = document.querySelector("iframe");
      const buttons = Array.from(document.querySelectorAll("button")).map(b => b.textContent.trim());
      const serverButtons = buttons.filter(t => t.includes("Vietsub") || t.includes("Thuyết minh") || t.includes("Lồng tiếng"));
      return {
        videoSrc: v ? v.src : null,
        videoCurrentTime: v ? v.currentTime : null,
        videoPaused: v ? v.paused : null,
        iframeSrc: iframe ? iframe.src : null,
        serverButtons
      };
    })()`,
    returnByValue: true
  });
  console.log("State 1 (Vietsub initial):", state1.result.value);
  
  // 2. Click "Thuyết minh" server button
  console.log("\n[Step 2] Clicking Thuyết minh button...");
  mediaRequests.length = 0; // reset to track new media
  
  const clickResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const tmBtn = buttons.find(b => b.textContent.includes("Thuyết minh"));
      if (tmBtn) {
        tmBtn.click();
        return { clicked: true, text: tmBtn.textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log("Click result:", clickResult.result.value);
  
  // Wait 8 seconds for source resolution & reload
  console.log("Waiting for Thuyết minh source to resolve and player to reload...");
  await new Promise(r => setTimeout(r, 8000));
  
  const state2 = await send("Runtime.evaluate", {
    expression: `(() => {
      const v = document.querySelector("video");
      const iframe = document.querySelector("iframe");
      return {
        videoSrc: v ? v.src : null,
        iframeSrc: iframe ? iframe.src : null
      };
    })()`,
    returnByValue: true
  });
  console.log("State 2 (Thuyết minh):", state2.result.value);
  console.log("New media requests count during Thuyết minh:", mediaRequests.length);
  
  // 3. Click back to "Vietsub"
  console.log("\n[Step 3] Clicking Vietsub button back...");
  mediaRequests.length = 0;
  
  const clickBackResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const vsBtn = buttons.find(b => b.textContent.includes("Vietsub"));
      if (vsBtn) {
        vsBtn.click();
        return { clicked: true, text: vsBtn.textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log("Click back result:", clickBackResult.result.value);
  
  await new Promise(r => setTimeout(r, 8000));
  
  const state3 = await send("Runtime.evaluate", {
    expression: `(() => {
      const v = document.querySelector("video");
      const iframe = document.querySelector("iframe");
      return {
        videoSrc: v ? v.src : null,
        iframeSrc: iframe ? iframe.src : null
      };
    })()`,
    returnByValue: true
  });
  console.log("State 3 (Vietsub back):", state3.result.value);
  console.log("New media requests count during Vietsub back:", mediaRequests.length);
  
  // Check results
  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log("State 1 Video/Frame:", state1.result.value.videoSrc || state1.result.value.iframeSrc);
  console.log("State 2 Video/Frame:", state2.result.value.videoSrc || state2.result.value.iframeSrc);
  console.log("State 3 Video/Frame:", state3.result.value.videoSrc || state3.result.value.iframeSrc);
  
  const src1 = state1.result.value.videoSrc || state1.result.value.iframeSrc;
  const src2 = state2.result.value.videoSrc || state2.result.value.iframeSrc;
  const src3 = state3.result.value.videoSrc || state3.result.value.iframeSrc;
  
  if (src1 && src2 && src1 !== src2) {
    console.log("✓ PASS: Vietsub source and Thuyết minh source are DIFFERENT!");
  } else {
    console.log("✗ FAIL: Vietsub and Thuyết minh sources are identical or null!", { src1, src2 });
  }
  
  if (src2 && src3 && src2 !== src3) {
    console.log("✓ PASS: Switched back to Vietsub successfully and source changed back!");
  } else {
    console.log("✗ FAIL: Vietsub back did not change from Thuyết minh!", { src2, src3 });
  }
  
  ws.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
