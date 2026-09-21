import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { response } from "./ivory-fixtures.mjs";
import { cases as routes } from "./ivory-cases.mjs";
import { flows } from "./simple-ivory-flows.mjs";
const cases = process.env.IVORY_MODE === "flows" ? flows : routes;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = process.env.AUDIT_OUT || "output/tattoi-simple-implementation";
await mkdir(out + "/screens", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const results = [];
for (const c of cases) {
  if (
    process.env.IVORY_CASES &&
    !process.env.IVORY_CASES.split(",").includes(c.id)
  )
    continue;
  const context = await browser.newContext({
    viewport: { width: Number(process.env.AUDIT_WIDTH || 390), height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
    timezoneId: "Australia/Brisbane",
  });
  await context.addInitScript(theme => {
    localStorage.setItem("tattoi-theme-override", theme);
    localStorage.setItem("authToken", "test");
    sessionStorage.setItem("splashShown", "true");
    localStorage.setItem("ui_debug_enabled", "false");
  }, process.env.AUDIT_THEME || "light");
  const calls = [];
  await context.route("**/*", async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== "127.0.0.1") return r.abort();
    if (u.pathname === "/__ivory_artwork.png")
      return r.fulfill({
        path: "output/tattoi-ivory-complete/assets/botanical.png",
        contentType: "image/png",
      });
    if (u.pathname.startsWith("/api/trpc/"))
      return r.fulfill({
        json: u.pathname
          .split("/")
          .at(-1)
          .split(",")
          .map(name => {
            calls.push(name);
            return { result: { data: { json: response(name, c.role) } } };
          }),
      });
    if (u.pathname === "/api/version")
      return r.fulfill({ json: { version: "3.2.3" } });
    return r.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.clock.install({
      time: new Date(c.time || "2026-09-09T23:41:00Z"),
    });
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5220") + c.path,
      { waitUntil: "networkidle", timeout: 25000 }
    );
    await page.addStyleTag({
      content:
        ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
    });
    await page.evaluate(() => {
      const status = document.createElement("div");
      status.id = "ivory-preview-status";
      status.setAttribute("aria-hidden", "true");
      status.style.cssText =
        "position:fixed;inset:0 0 auto;height:50px;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:space-between;padding:0 28px;font:600 14px -apple-system,BlinkMacSystemFont,sans-serif;color:var(--foreground)";
      status.innerHTML =
        '<span>9:41</span><span style="width:110px;height:30px;background:#15120f;border-radius:30px;position:absolute;left:calc(50% - 55px);top:9px"></span><span>••• ▰</span>';
      document.body.append(status);
      const home = document.createElement("div");
      home.style.cssText =
        "position:fixed;bottom:8px;left:calc(50% - 60px);width:120px;height:5px;background:var(--foreground);opacity:.7;border-radius:8px;z-index:99999;pointer-events:none";
      document.body.append(home);
    });
    if (c.before) await c.before(page);
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => ({
      title:
        document.querySelector("h1")?.textContent ||
        document.querySelector("[role=dialog]")?.textContent?.slice(0, 60),
      overflow: document.documentElement.scrollWidth > innerWidth,
      text: document.body.innerText,
      links: [...document.querySelectorAll("a[href]")].map(a => {
        const r = a.getBoundingClientRect();
        return {
          text: a.innerText,
          href: a.getAttribute("href"),
          rect: [r.x, r.y, r.width, r.height],
        };
      }),
      scroll: [
        ...document.querySelectorAll(
          ".v3-scroll,.client-home-content,[role=dialog] .mobile-scroll"
        ),
      ].map(x => ({ height: x.clientHeight, full: x.scrollHeight })),
    }));
    if (info.overflow) errors.push("Horizontal document overflow");
    if (/\$NaN|\$undefined/.test(info.text))
      errors.push("Invalid displayed amount");
    if (info.text.includes("Something went wrong"))
      errors.push("Rendered error boundary");
    await page.screenshot({ path: `${out}/screens/${c.id}.png` });
    const parts = [];
    const range = await page.evaluate(() => {
      const xs = [
        ...document.querySelectorAll(
          ".v3-scroll,.client-home-content,[role=dialog] .mobile-scroll"
        ),
      ]
        .filter(x => x.clientHeight > 0)
        .sort(
          (a, b) =>
            b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight)
        );
      const x = xs[0];
      if (!x) return null;
      x.setAttribute("data-ivory-capture-scroll", "true");
      return {
        step: Math.max(200, x.clientHeight - 80),
        max: x.scrollHeight - x.clientHeight,
      };
    });
    if (range && range.max > 80) {
      for (let y = range.step; y < range.max + range.step; y += range.step) {
        await page.evaluate(
          y => {
            document
              .querySelector("[data-ivory-capture-scroll]")
              ?.scrollTo(0, y);
          },
          Math.min(y, range.max)
        );
        await page.waitForTimeout(40);
        const file = `${c.id}-part-${parts.length + 2}.png`;
        await page.screenshot({ path: `${out}/screens/${file}` });
        parts.push(file);
      }
    }
    const long = parts.length > 0;
    if (long)
      await page.screenshot({ path: `${out}/screens/${c.id}-bottom.png` });
    results.push({
      ...c,
      ...info,
      title: c.title || info.title,
      errors,
      calls: [...new Set(calls)],
      bottom: long,
      parts,
    });
    console.log(c.id, errors.length ? "ERROR " + errors.join(";") : "OK");
  } catch (e) {
    results.push({ ...c, errors: [e.message], calls: [...new Set(calls)] });
    console.log(c.id, "FAILED", e.message.split("\n")[0]);
  }
  await context.close();
}
const resultPath =
  out +
  (process.env.IVORY_MODE === "flows"
    ? "/flow-results.json"
    : "/capture-results.json");
let combined = results;
if (process.env.IVORY_CASES) {
  try {
    const previous = JSON.parse(await readFile(resultPath, "utf8"));
    combined = [
      ...previous.filter(x => !results.some(y => y.id === x.id)),
      ...results,
    ];
  } catch {}
}
await writeFile(resultPath, JSON.stringify(combined, null, 2));
await browser.close();
console.log(
  "Captured",
  results.length,
  "routes; errors",
  results.filter(x => x.errors.length).length
);

if (results.some(x => x.errors.length)) process.exitCode = 1;
