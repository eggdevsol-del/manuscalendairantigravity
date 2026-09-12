import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-workspace-check";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const results = [];
import { artist, client, response, calls } from "./launch-fixtures.mjs";
const cases = [
  ["iphone", 440, 956, 62, 34],
  ["ipad", 1180, 820, 24, 20],
  ["ipad-portrait", 820, 1180, 24, 20],
].flatMap(([device, w, h, top, bottom]) =>
  [
    ["artist", "/dashboard"],
    ["artist", "/calendar"],
    ["artist", "/chat/12"],
    ["artist", "/clients"],
    ["artist", "/supplies"],
    ["artist", "/artist-profile"],
    ["client", "/bookings"],
    ["client", "/projects/12"],
    ["client", "/chat/12"],
    ["merchant", "/dashboard"],
    ["merchant", "/merchant/orders"],
    ["merchant", "/merchant/products"],
    ["merchant", "/chat/12"],
  ].map(([role, path]) => [device, w, h, top, bottom, role, path])
);
for (const theme of ["light", "dark"])
  for (const [device, width, height, top, bottom, role, path] of cases) {
    if (
      process.env.LAUNCH_CASES &&
      !process.env.LAUNCH_CASES.split(",").includes(`${device}:${role}:${path}`)
    )
      continue;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      timezoneId: "Australia/Brisbane",
      serviceWorkers: "block",
    });
    await context.addInitScript(theme => {
      localStorage.setItem("tattoi-theme-override", theme);
      localStorage.setItem("authToken", "test");
      localStorage.setItem("ui_debug_enabled", "false");
      sessionStorage.setItem("splashShown", "true");
    }, theme);
    await context.route("**/*", async route => {
      const u = new URL(route.request().url());
      if (u.hostname !== "127.0.0.1") return route.abort();
      if (u.pathname.startsWith("/api/trpc/")) {
        const names = u.pathname.split("/").at(-1).split(",");
        return route.fulfill({
          json: names.map(name => ({
            result: { data: { json: response(name, role) } },
          })),
        });
      }
      if (u.pathname === "/api/version")
        return route.fulfill({ json: { version: "2.15.0" } });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.install({ time: new Date("2026-09-09T23:41:00Z") });
    await page.goto((process.env.AUDIT_URL || "http://127.0.0.1:5174") + path, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(
      ({ top, bottom }) => {
        document.documentElement.style.setProperty(
          "--app-safe-top",
          `${top}px`
        );
        document.documentElement.style.setProperty(
          "--app-safe-bottom",
          `${bottom}px`
        );
      },
      { top, bottom }
    );
    await page.locator(".v3-screen").waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(
      ({ top, bottom }) => {
        document.documentElement.style.setProperty(
          "--app-safe-top",
          `${top}px`
        );
        document.documentElement.style.setProperty(
          "--app-safe-bottom",
          `${bottom}px`
        );
      },
      { top, bottom }
    );
    if (path === "/calendar" && width >= 900) {
      const selected = page
        .getByRole("button")
        .filter({ hasText: "Mia Chen" })
        .first();
      if (await selected.count()) await selected.click();
      await page.waitForTimeout(400);
    }
    if (path === "/calendar") {
      const timeline = page.locator(".v3-timeline-scroll");
      await timeline.waitFor();
      const dateBefore = await page.locator(".v3-subtitle").innerText();
      await page
        .getByRole("button", { name: "Compact agenda", exact: true })
        .click();
      await page.waitForTimeout(250);
      if ((await page.locator(".v3-subtitle").innerText()) !== dateBefore)
        errors.push("Compacting agenda changed selected date");
      await page
        .getByRole("button", { name: "Expand agenda", exact: true })
        .click();
      await page.waitForTimeout(100);
      const before = await page
        .locator(".v3-timeline-heading strong")
        .innerText();
      await timeline.evaluate(el => (el.scrollTop += 6000));
      await page.waitForTimeout(500);
      const after = await page
        .locator(".v3-timeline-heading strong")
        .innerText();
      if (before === after)
        errors.push("Calendar month failed to follow scrolling");
      if (device === "iphone") {
        await timeline.evaluate(el => {
          el.scrollTop = 0;
        });
        await page.waitForTimeout(300);
        if ((await timeline.evaluate(el => el.scrollTop)) < 1000)
          errors.push("Calendar failed to recenter at previous range boundary");
        if ((await page.locator(".v3-timeline-day").count()) > 40)
          errors.push("Calendar rendered an unbounded number of days");
      }
      await page.getByRole("button", { name: "Today", exact: true }).click();
      await page.waitForTimeout(300);
      if (
        !(await page.locator(".v3-subtitle").innerText()).includes("September")
      )
        errors.push("Today failed to return to current date");
      await page
        .getByRole("button", { name: "New booking", exact: true })
        .click();
      await page
        .getByRole("button", { name: /Mia Chen/ })
        .last()
        .click();
      await page
        .getByRole("button", { name: /Botanical sleeve/ })
        .last()
        .click();
      await page
        .getByRole("button", { name: "Find available dates", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Send proposal", exact: true })
        .waitFor();
      await page.screenshot({ path: `${out}/${device}-${theme}-wizard.png` });
      await page
        .getByRole("button", { name: "Edit details", exact: true })
        .click();
      if ((await page.getByLabel("Date", { exact: true }).count()) !== 3)
        errors.push("Multi-sitting plan lost sessions");
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      headers: [...document.querySelectorAll("h1")]
        .filter(e => e.getBoundingClientRect().height > 0)
        .map(e => ({
          text: e.textContent,
          top: e.getBoundingClientRect().top,
          right: e.getBoundingClientRect().right,
        })),
      text: document.body.innerText.slice(0, 1200),
    }));
    const file = `${device}-${theme}-${role}-${path.replaceAll("/", "_")}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    results.push({ device, theme, role, path, errors, ...geometry, file });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
await browser.close();
await writeFile(
  `${out}/results.json`,
  JSON.stringify({ results, calls: [...calls] }, null, 2)
);

if (results.some(r => r.errors.length || r.overflow)) process.exitCode = 1;
