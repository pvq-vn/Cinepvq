import { spawn } from "child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;

async function runBrowserTests() {
  console.log("=== STARTING AUTOMATED REAL CHROME CDP TEST ===");
  const userDataDir = `${process.env.TEMP}\\chrome-auth-test-${Date.now()}`;

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    "http://localhost:3000/dang-nhap",
  ]);

  // Wait for CDP
  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const json = await res.json();
        wsUrl = json.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error("Failed to connect to Chrome CDP");
    chromeProc.kill();
    process.exit(1);
  }

  console.log("Chrome launched with CDP on port", PORT);

  const pagesRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = await pagesRes.json();
  const page = pages.find((p) => p.type === "page") || pages[0];

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener("open", res, { once: true }));

  let msgId = 1;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (evt) => {
        const parsed = JSON.parse(evt.data.toString());
        if (parsed.id === id) {
          ws.removeEventListener("message", handler);
          if (parsed.error) reject(parsed.error);
          else resolve(parsed.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");

  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  };

  const navigate = async (url) => {
    await send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 2000));
  };

  const results = [];
  const test = (desc, passed, detail = "") => {
    results.push({ desc, passed, detail });
    console.log(`[${passed ? "PASS" : "FAIL"}] ${desc} ${detail ? `(${detail})` : ""}`);
  };

  try {
    // ── Test 1: Login Page Render & Show/Hide Password ──
    await navigate("http://localhost:3000/dang-nhap");
    const loginHeader = await evaluate("document.querySelector('h1')?.innerText");
    test("1. Login page header", loginHeader?.includes("Đăng nhập"), `Text: ${loginHeader}`);

    const passInputTypeBefore = await evaluate("document.querySelectorAll('input[type=\"password\"]').length");
    test("2. Password input present", passInputTypeBefore > 0, `Count: ${passInputTypeBefore}`);

    // Click show/hide password toggle
    await evaluate("document.querySelector('button[aria-label*=\"mật khẩu\"]')?.click()");
    await new Promise((r) => setTimeout(r, 300));
    const passInputTypeAfter = await evaluate("document.querySelectorAll('input[type=\"text\"]').length");
    test("3. Show password toggled input to text", passInputTypeAfter >= 2, `Text inputs count: ${passInputTypeAfter}`);

    // ── Test 2: Register Page Render & Validation ──
    await navigate("http://localhost:3000/dang-ky");
    const regHeader = await evaluate("document.querySelector('h1')?.innerText");
    test("4. Register page header", regHeader?.includes("Tạo tài khoản"), `Text: ${regHeader}`);

    // ── Test 3: Auth Guard on /tai-khoan when Guest ──
    await navigate("http://localhost:3000/tai-khoan");
    const guardHeader = await evaluate("document.querySelector('h1')?.innerText");
    const loginBtn = await evaluate("document.querySelector('a[href*=\"/dang-nhap\"]')?.innerText");
    test("5. Auth Guard on /tai-khoan", guardHeader?.includes("Yêu cầu đăng nhập") && loginBtn?.includes("Đăng nhập"), `Header: ${guardHeader}`);

    // ── Test 4: Favorites Page (/yeu-thich) Render ──
    await navigate("http://localhost:3000/yeu-thich");
    const favHeader = await evaluate("document.querySelector('h1')?.innerText");
    test("6. Favorites page (/yeu-thich) renders", favHeader?.includes("Phim Yêu Thích"), `Header: ${favHeader}`);

    // ── Test 5: Watch History Page (/lich-su) Render ──
    await navigate("http://localhost:3000/lich-su");
    const histHeader = await evaluate("document.querySelector('h1')?.innerText");
    test("7. Watch History page (/lich-su) renders", histHeader?.includes("Lịch Sử Xem Phim"), `Header: ${histHeader}`);

    // ── Test 6: Settings Page (/cai-dat) Render & Sync Status ──
    await navigate("http://localhost:3000/cai-dat");
    const setHeader = await evaluate("document.querySelector('h1')?.innerText");
    const themeButtons = await evaluate("document.querySelectorAll('button').length");
    test("8. Settings page (/cai-dat) renders", setHeader?.includes("Cài Đặt Hệ Thống") && themeButtons > 3, `Buttons: ${themeButtons}`);

    // ── Test 7: Homepage & Navigation ──
    await navigate("http://localhost:3000/");
    const brandText = await evaluate("document.querySelector('header')?.innerText");
    test("9. Homepage header & navigation intact", brandText?.includes("Cinépvq") && brandText?.includes("Đăng nhập"), "Brand & Auth button found in Navbar");

    // ── Test 8: Login Flow in Browser & Profile Display ──
    await navigate("http://localhost:3000/dang-nhap");
    // Focus email input & type
    await evaluate("document.querySelector('input[placeholder*=\"vidu\"]').focus()");
    await send("Input.insertText", { text: "browser_user_prod@cinepvq.test" });
    await new Promise((r) => setTimeout(r, 200));

    // Focus password input & type
    await evaluate("document.querySelector('input[placeholder*=\"•••\"]').focus()");
    await send("Input.insertText", { text: "Password123!" });
    await new Promise((r) => setTimeout(r, 300));

    // Click submit
    await evaluate("document.querySelector('form button[type=\"submit\"]')?.click()");
    await new Promise((r) => setTimeout(r, 3000));

    const currentUrl = await evaluate("window.location.href");
    const profileText = await evaluate("document.body.innerText");
    test("10. Browser login & redirect to /tai-khoan", currentUrl.includes("/tai-khoan"), `Current URL: ${currentUrl}`);
    test("11. Profile displays username/email", profileText?.includes("browser_user_prod@cinepvq.test") || profileText?.includes("CineAuditor"), "User data visible on profile");

    // ── Test 9: Edit Profile in Browser ──
    const editBtnExists = await evaluate("!!document.querySelector('button[title*=\"Chỉnh sửa\"], button:has(svg)')");
    test("12. Edit profile button available", editBtnExists, "Edit button present");

    // ── Test 10: Unauthenticated Movie Watching (Guest can still watch movies) ──
    await navigate("http://localhost:3000/phim/mai");
    await new Promise((r) => setTimeout(r, 3500));
    const movieTitle = await evaluate("document.querySelector('h1')?.innerText || document.querySelector('.font-extrabold')?.innerText");
    test("13. Movie detail accessible to watch", Boolean(movieTitle && movieTitle.length > 0), `Movie: ${movieTitle}`);

  } catch (err) {
    console.error("Browser test error:", err);
  } finally {
    ws.close();
    chromeProc.kill();
    console.log("\n================ BROWSER TEST SUMMARY ================");
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Browser Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  }
}

runBrowserTests().catch(console.error);
