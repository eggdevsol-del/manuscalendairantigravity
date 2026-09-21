import { chromium } from "playwright";
import { response } from "./ivory-fixtures.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const out = "output/tattoi-business-refinements";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const results = [];
for (const width of [390, 320])
  for (const scene of ["calendar", "tools", "service", "dates", "earnings"]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
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
        });
      if (u.pathname === "/api/version")
        return r.fulfill({ json: { version: "3.2.3" } });
      if (!u.pathname.startsWith("/api/trpc/")) return r.continue();
      return r.fulfill({
        json: u.pathname
          .split("/")
          .at(-1)
          .split(",")
          .map(name => {
            let data = response(name, "artist");
            if (name === "payouts.earningsBreakdown")
              data = {
                ...data,
                timeZone: "Australia/Brisbane",
                daily: Array.from({ length: 30 }, (_, i) => ({
                  date: `2026-09-${String(i + 1).padStart(2, "0")}`,
                  netCents: i % 4 === 0 ? 7500 : 0,
                })),
              };
            if (name === "booking.checkAvailability")
              data = {
                dates: [
                  "2026-10-05T23:00:00Z",
                  "2026-10-07T23:00:00Z",
                  "2026-10-08T23:00:00Z",
                ],
                totalCost: 1800,
              };
            return { result: { data: { json: data } } };
          }),
      });
    });
    const p = await context.newPage();
    p.setDefaultTimeout(8000);
    console.log("START", scene, width);
    const errors = [];
    p.on("pageerror", e => errors.push(e.message));
    try {
      await p.clock.install({ time: new Date("2026-09-21T00:00:00Z") });
      await p.goto(
        "http://127.0.0.1:5220/" +
          (scene === "calendar"
            ? "calendar"
            : scene === "earnings"
              ? "business"
              : "chat/12"),
        { waitUntil: "networkidle" }
      );
      await p.addStyleTag({
        content:
          ":root{--app-safe-top:44px!important;--app-safe-bottom:34px!important}",
      });
      if (["tools", "service", "dates"].includes(scene))
        await p
          .getByRole("button", { name: "Conversation tools", exact: true })
          .click();
      if (scene === "tools") {
        if (
          await p
            .getByRole("link", { name: "View tattoo project", exact: true })
            .count()
        )
          errors.push("Old project link remains");
        await p
          .locator(".v3-context-sheet .v3-conversation-project > button")
          .first()
          .click();
        await p
          .locator(
            ".v3-context-sheet .v3-inline-project .ivory-project-progress"
          )
          .first()
          .waitFor();
        if (!p.url().endsWith("/chat/12"))
          errors.push("Project left the conversation");
        await p
          .locator(".v3-context-sheet .v3-inline-project")
          .getByRole("button", { name: "Details", exact: true })
          .first()
          .click();
        if ((await p.getByRole("dialog").count()) !== 1)
          errors.push("Sitting opened a nested sheet");
      }
      if (["service", "dates"].includes(scene)) {
        await p
          .getByRole("button", { name: "New booking", exact: true })
          .click();
        await p.getByText("$1,800.00 project total", { exact: true }).waitFor();
        if (scene === "dates") {
          await p.getByRole("button", { name: /Botanical sleeve/ }).click();
          await p
            .getByRole("button", { name: "Consecutive dates", exact: true })
            .click();
          await p
            .getByLabel("Start looking from", { exact: true })
            .fill("2026-10-01");
          await p
            .getByLabel("Project completed by (optional)", { exact: true })
            .fill("2026-10-15");
          await p
            .getByRole("button", { name: "Find available dates", exact: true })
            .click();
          await p.locator(".v3-schedule-gap").waitFor();
        }
      }
      if (scene === "calendar") {
        const geometry = await p.evaluate(() => ({
          heading: document
            .querySelector(".v3-inline-title")
            ?.getBoundingClientRect().top,
          wordmark: document
            .querySelector(".v3-wordmark")
            ?.getBoundingClientRect().top,
          controls: document
            .querySelector(".v3-calendar-date-controls")
            ?.getBoundingClientRect().bottom,
          nav: document.querySelector("#bottom-nav")?.getBoundingClientRect()
            .top,
        }));
        if (
          Math.abs(geometry.heading - geometry.wordmark) > 20 ||
          Math.abs(geometry.controls - geometry.nav) > 2
        )
          errors.push("Calendar geometry mismatch");
        await p.getByRole("button", { name: "Next week", exact: true }).click();
        await p.getByRole("button", { name: "Today", exact: true }).click();
      }
      if (scene === "earnings")
        await p.locator(".v3-earnings-chart svg rect").first().waitFor();
      await p.clock.runFor(700);
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        )
      )
        errors.push("Horizontal overflow");
      await p.screenshot({ path: `${out}/${scene}-${width}.png` });
    } catch (e) {
      errors.push(e.message);
    }
    results.push({ scene, width, errors });
    console.log(scene, width, errors);
    await context.close();
    console.log("CLOSED", scene, width);
  }
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
if (results.some(r => r.errors.length)) process.exitCode = 1;
