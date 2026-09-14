import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { response } from "./ivory-fixtures.mjs";
import { flows } from "./ivory-flows.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = "output/tattoi-ui-audit";
await mkdir(out + "/screens", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const results = [];
const cases = [
  ...flows.map(c => ({ ...c, width: 390 })),
  ...[390, 820].map(width => ({
    id: "calendar-details-" + width,
    role: "artist",
    path: "/calendar",
    width,
    before: async p => {
      await p.locator(".v3-timeline-session").first().click();
    },
  })),
];
let cursor = 0;
async function check(c) {
  const context = await browser.newContext({
    viewport: { width: c.width, height: 874 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    timezoneId: "Australia/Brisbane",
  });
  await context.addInitScript(() => {
    localStorage.setItem("authToken", "test");
    localStorage.setItem("tattoi-theme-override", "light");
    localStorage.setItem("ui_debug_enabled", "false");
    sessionStorage.setItem("splashShown", "true");
  });
  await context.route("**/*", r => {
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
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.clock.install({
      time: new Date(c.time || "2026-09-09T23:41:00Z"),
    });
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5196") + c.path,
      { waitUntil: "networkidle" }
    );
    await page.addStyleTag({
      content:
        ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
    });
    await c.before(page);
    await page.waitForTimeout(450);
    const dialogs = await page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog]")]
        .filter(
          d =>
            d.checkVisibility({ visibilityProperty: true }) &&
            !d.closest("[aria-hidden=true]")
        )
        .map((d, i) => {
          d.setAttribute("data-close-audit", String(i));
          const buttons = [...d.querySelectorAll("button")].filter(
            b =>
              b.closest("[role=dialog]") === d &&
              b.checkVisibility({ visibilityProperty: true })
          );
          const close = buttons.filter(b => {
            const name =
              b.getAttribute("aria-label") ||
              b.getAttribute("title") ||
              b.textContent?.trim() ||
              "";
            return (
              /\bclose\b|\bdismiss\b/i.test(name) ||
              (!/remove|clear|delete/i.test(name) &&
                !!b.querySelector("svg.lucide-x") &&
                !name)
            );
          });
          close.forEach((b, j) =>
            b.setAttribute("data-close-audit-button", String(j))
          );
          return {
            index: i,
            title:
              d.getAttribute("aria-label") ||
              document.getElementById(d.getAttribute("aria-labelledby"))
                ?.textContent,
            closeCount: close.length,
            labels: close.map(
              b => b.getAttribute("aria-label") || b.textContent.trim()
            ),
          };
        })
    );
    for (const d of dialogs)
      if (d.closeCount !== 1)
        errors.push(
          `${d.title || "Dialog"} has ${d.closeCount} close controls`
        );
    if (c.id === "calendar-details-390") {
      if (
        await page
          .getByRole("button", { name: "Close booking details", exact: true })
          .count()
      )
        errors.push("Embedded inspector still duplicates sheet close");
      await page.screenshot({
        path: out + "/screens/calendar-single-close-390.png",
      });
    }
    if (c.id === "calendar-details-820") {
      const b = page.getByRole("button", {
        name: "Close booking details",
        exact: true,
      });
      if ((await b.count()) !== 1)
        errors.push("Standalone inspector lost its close control");
      else {
        await page.screenshot({
          path: out + "/screens/calendar-single-close-820.png",
        });
        await b.click();
        if (await b.count()) errors.push("Standalone inspector did not close");
      }
    }
    const top = dialogs.at(-1);
    if (top?.closeCount === 1) {
      const selector = `[data-close-audit="${top.index}"]`;
      await page.locator(selector + ' [data-close-audit-button="0"]').click();
      await page.waitForTimeout(400);
      if (await page.locator(selector).isVisible())
        errors.push("Close did not dismiss the dialog");
    }
    results.push({ id: c.id, width: c.width, dialogs, errors });
  } catch (e) {
    results.push({ id: c.id, width: c.width, errors: [...errors, e.message] });
  } finally {
    await context.close();
  }
  console.log(c.id, results.at(-1).errors.length ? "FAIL" : "PASS");
}
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < cases.length) await check(cases[cursor++]);
  })
);
await browser.close();
await writeFile(
  out + "/close-controls-results.json",
  JSON.stringify(results, null, 2)
);
const failures = results.filter(r => r.errors.length);
console.log(`${results.length} scenarios; ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
