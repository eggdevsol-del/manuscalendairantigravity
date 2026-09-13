import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { response } from "./launch-fixtures.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
try {
  for (const width of [440, 820, 1180])
    for (const role of ["artist", "client", "merchant"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1180 ? 820 : 1100 },
        hasTouch: true,
        serviceWorkers: "block",
      });
      await context.addInitScript(() => {
        localStorage.setItem("authToken", "test");
        sessionStorage.setItem("splashShown", "true");
      });
      await context.route("**/*", async route => {
        const u = new URL(route.request().url());
        if (u.hostname !== "127.0.0.1") return route.abort();
        if (u.pathname.startsWith("/api/trpc/"))
          return route.fulfill({
            json: u.pathname
              .split("/")
              .at(-1)
              .split(",")
              .map(name => ({
                result: { data: { json: response(name, role) } },
              })),
          });
        return route.continue();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      const title =
        role === "artist"
          ? "Run your day"
          : role === "client"
            ? "Follow your booking"
            : "Review your store day";
      const base = process.env.AUDIT_URL || "http://127.0.0.1:5194";
      await page.goto(
        base +
          (role === "merchant" ? "/account-settings" : "/settings") +
          "?section=how-tos",
        { waitUntil: "domcontentloaded" }
      );
      await page.evaluate(
        top =>
          document.documentElement.style.setProperty(
            "--app-safe-top",
            `${top}px`
          ),
        width === 440 ? 62 : 24
      );
      await page.getByText(title, { exact: true }).click();
      const bubble = page.getByRole("dialog", { name: title });
      await bubble.waitFor();
      await page.waitForTimeout(500);
      const first = await bubble.boundingBox();
      assert(first.x >= 0 && first.x + first.width <= width + 1);
      assert(first.y >= (width === 440 ? 62 : 24));
      const nav = await page.locator("#bottom-nav").boundingBox();
      assert(first.y + first.height <= nav.y);
      await page.screenshot({
        path: `/private/tmp/tattoi-tour-${role}-${width}.png`,
      });
      await bubble.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForTimeout(500);
      const second = await bubble.boundingBox();
      assert(
        Math.abs(first.y - second.y) > 1 || Math.abs(first.x - second.x) > 1,
        "Bubble must move between targets"
      );
      await bubble.getByRole("button", { name: "Back", exact: true }).click();
      await page.waitForTimeout(250);
      await bubble.getByRole("button", { name: "Skip", exact: true }).click();
      await bubble.waitFor({ state: "hidden" });
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("manus_completed_tours") || "[]")
              .length
        ),
        0,
        "Skipping is not completing"
      );
      await page.goto(
        base +
          (role === "merchant" ? "/account-settings" : "/settings") +
          "?section=how-tos",
        { waitUntil: "domcontentloaded" }
      );
      await page.getByText(title, { exact: true }).click();
      await page.waitForTimeout(300);
      await bubble.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForTimeout(300);
      await bubble.getByRole("button", { name: "Done", exact: true }).click();
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("manus_completed_tours") || "[]")
              .length
        ),
        1
      );
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width} ${role}: anchored movement, Back, Skip, replay and completion`
      );
      await context.close();
    }
} finally {
  await browser.close();
}
