import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { response } from "./ivory-fixtures.mjs";
import { cases } from "./ivory-cases.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = "output/tattoi-ui-audit";
await mkdir(out + "/screens", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const critical = [
  "artist-today",
  "artist-clients",
  "artist-supplies",
  "artist-project-overview",
  "client-bookings",
  "artist-money",
  "artist-studio-schedule",
  "artist-inbox",
  "artist-working-hours",
  "artist-artist-profile",
  "merchant-supplier-orders",
];
const runs = cases.map(c => ({
  ...c,
  width: 390,
  height: 844,
  theme: "light",
}));
for (const width of [320, 440, 820])
  for (const id of critical) {
    const c = cases.find(c => c.id === id);
    if (c)
      runs.push({
        ...c,
        width,
        height: width === 820 ? 1180 : 874,
        theme: width === 440 ? "dark" : "light",
      });
  }
const results = [];
let cursor = 0;
async function run(c) {
  const context = await browser.newContext({
    viewport: { width: c.width, height: c.height },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    timezoneId: "Australia/Brisbane",
  });
  await context.addInitScript(theme => {
    localStorage.setItem("tattoi-theme-override", theme);
    localStorage.setItem("authToken", "test");
    sessionStorage.setItem("splashShown", "true");
  }, c.theme);
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
          .map(n => ({ result: { data: { json: response(n, c.role) } } })),
      });
    if (u.pathname === "/api/version")
      return r.fulfill({ json: { version: "3.2.3" } });
    return r.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.clock.install({ time: new Date("2026-09-09T23:41:00Z") });
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5196") + c.path,
      { waitUntil: "networkidle" }
    );
    await page.addStyleTag({
      content:
        ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
    });
    const geometry = await page.evaluate(() => {
      const rect = e => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const visible = e => {
        const r = e.getBoundingClientRect();
        return (
          e.checkVisibility({ visibilityProperty: true }) &&
          r.width > 0 &&
          r.height > 0 &&
          r.top < innerHeight &&
          r.bottom > 0 &&
          getComputedStyle(e).visibility !== "hidden"
        );
      };
      const names = e =>
        e.getAttribute("aria-label") ||
        e.getAttribute("title") ||
        e.innerText?.trim() ||
        e.textContent?.trim() ||
        e.querySelector("img")?.alt ||
        "";
      const header = document.querySelector(".v3-header"),
        tabs = document.querySelector(
          ".v3-subheader>.v3-tabs,.v3-subheader>.v3-home-tabs"
        );
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        header: header && rect(header),
        subheader: tabs &&
          visible(tabs) && {
            ...rect(tabs),
            items: [...tabs.children].map(x => ({
              text: x.innerText,
              ...rect(x),
            })),
          },
        boundary: document.body.innerText.includes("Something went wrong"),
        invalidNumbers: /\$NaN|\$undefined/.test(document.body.innerText),
        unnamedButtons: [...document.querySelectorAll("button")]
          .filter(visible)
          .filter(e => !names(e))
          .map(e => ({ html: e.outerHTML.slice(0, 240), ...rect(e) })),
        smallControls: [
          ...document.querySelectorAll(
            "button,.v3-action,.v3-icon-button,.v3-home-tabs a"
          ),
        ]
          .filter(visible)
          .filter(e => e.getBoundingClientRect().height < 43)
          .map(e => ({ name: names(e), ...rect(e) })),
        links: [...document.querySelectorAll("a[href]")]
          .filter(visible)
          .map(e => ({ text: names(e), href: e.getAttribute("href") })),
      };
    });
    if (geometry.overflow) errors.push("Horizontal document overflow");
    if (geometry.boundary) errors.push("Error boundary rendered");
    if (geometry.invalidNumbers) errors.push("Invalid displayed amount");
    if (geometry.subheader) {
      const t = geometry.subheader;
      if (
        c.width < 768 &&
        (Math.abs(t.x) > 1 || Math.abs(t.width - c.width) > 1)
      )
        errors.push("Page toggle does not span usable width");
      if (Math.abs(t.height - 52) > 1)
        errors.push("Nonstandard toggle height " + t.height);
      if (
        Math.max(...t.items.map(x => x.width)) -
          Math.min(...t.items.map(x => x.width)) >
        1
      )
        errors.push("Unequal segment widths");
      const locator = page.locator(".v3-subheader [role=tab]");
      if ((await locator.count()) > 1) {
        await locator.first().focus();
        await page.keyboard.press("End");
        if ((await locator.last().getAttribute("aria-selected")) !== "true")
          errors.push("End key did not activate last tab");
        await page.keyboard.press("Home");
        if ((await locator.first().getAttribute("aria-selected")) !== "true")
          errors.push("Home key did not activate first tab");
      }
    }
    if (critical.includes(c.id))
      await page.screenshot({
        path: `${out}/screens/${c.id}-${c.width}-${c.theme}.png`,
      });
    results.push({ ...c, ...geometry, errors });
  } catch (e) {
    results.push({ ...c, errors: [...errors, e.message] });
  } finally {
    await context.close();
  }
  console.log(c.id, c.width, results.at(-1)?.errors.length ? "CHECK" : "OK");
}
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < runs.length) {
      const c = runs[cursor++];
      await run(c);
    }
  })
);
await browser.close();
await writeFile(
  out + "/cohesion-results.json",
  JSON.stringify(results, null, 2)
);
const failed = results.filter(x => x.errors.length);
console.log(`${results.length} checks; ${failed.length} failures`);
if (failed.length) process.exitCode = 1;
