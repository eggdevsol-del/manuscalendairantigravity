// Isolated UI checks: all application data is mocked and external requests are blocked.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { response as base } from "./ivory-fixtures.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = "output/tattoi-ui-audit";
await mkdir(`${out}/screens`, { recursive: true });
const artist = {
  id: "artist-test",
  name: "Ella Morgan",
  displayName: "Ella Morgan",
  keywords: "Fine Line",
  lat: "-27.47",
  lng: "153.026",
};
const response = name => {
  if (name === "conversations.list")
    return [{ id: 12, otherUser: artist, unreadCount: 0 }];
  if (name === "auth.listArtists") return [artist];
  if (name === "favourites.list") return [];
  if (name === "portfolio.list")
    return [
      {
        id: 1,
        imageUrl: "/__ivory_artwork.png",
        description: "Botanical study",
        mediaType: "image",
      },
      {
        id: 2,
        imageUrl: "/__ivory_artwork.png",
        description: "Fern study",
        mediaType: "image",
      },
    ];
  return base(name, "client");
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const results = [];
try {
  for (const width of [390, 820]) {
    const context = await browser.newContext({
      viewport: { width, height: 874 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: width < 600,
      serviceWorkers: "block",
      timezoneId: "Australia/Brisbane",
    });
    await context.addInitScript(() => {
      localStorage.setItem("tattoi-theme-override", "light");
      localStorage.setItem("authToken", "test");
      sessionStorage.setItem("splashShown", "true");
      localStorage.setItem("ui_debug_enabled", "false");
    });
    await context.route("**/*", async route => {
      const u = new URL(route.request().url());
      if (u.hostname !== "127.0.0.1") return route.abort();
      if (u.pathname === "/__ivory_artwork.png")
        return route.fulfill({
          path: "output/tattoi-ivory-complete/assets/botanical.png",
          contentType: "image/png",
        });
      if (u.pathname.startsWith("/api/trpc/"))
        return route.fulfill({
          json: u.pathname
            .split("/")
            .at(-1)
            .split(",")
            .map(name => ({ result: { data: { json: response(name) } } })),
        });
      if (u.pathname === "/api/version")
        return route.fulfill({ json: { version: "3.2.3" } });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(8000);
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5196") + "/discover",
      { waitUntil: "networkidle" }
    );
    await page.addStyleTag({
      content:
        ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
    });
    await page
      .getByRole("button", { name: "Your artists and bookings", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "View Ella Morgan's portfolio",
        exact: true,
      })
      .first()
      .click();
    const thumbnail = page.getByRole("button", {
      name: "View Botanical study",
      exact: true,
    });
    await thumbnail.click();
    const dialog = page.getByRole("dialog", {
      name: "Ella Morgan’s portfolio",
    });
    await dialog.waitFor();
    assert.equal(
      await dialog.locator("button:has(svg.lucide-x)").count(),
      1,
      "one X dismissal"
    );
    assert.equal(
      await dialog.getByRole("button").count(),
      3,
      "close plus previous/next controls"
    );
    const close = dialog.getByRole("button", { name: "Close artwork" });
    const box = await close.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, "44px close target");
    assert.ok(
      box.y >= 54 && box.x + box.width <= width,
      "close respects safe area"
    );
    await dialog.getByRole("button", { name: "Next artwork" }).click();
    await dialog.getByRole("img", { name: "Fern study" }).waitFor();
    await dialog.getByRole("button", { name: "Previous artwork" }).click();
    await dialog.getByRole("img", { name: "Botanical study" }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("[role=dialog], [role=dialog] img")].every(
        el => getComputedStyle(el).opacity === "1"
      )
    );
    await page.screenshot({
      path: `${out}/screens/portfolio-single-close-${width}.png`,
    });
    await close.click();
    await dialog.waitFor({ state: "hidden" });
    assert.ok(
      await thumbnail.evaluate(el => el === document.activeElement),
      "focus restored to thumbnail"
    );
    await thumbnail.click();
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.ok(
      await thumbnail.evaluate(el => el === document.activeElement),
      "Escape restores focus"
    );
    await page.getByRole("button", { name: /See Artist Map/ }).click();
    const mapClose = page.getByRole("button", { name: "Close artist map" });
    const search = page.getByRole("textbox", { name: "Search artists on map" });
    await mapClose.waitFor();
    const mapCloseBox = await mapClose.boundingBox();
    assert.ok(
      mapCloseBox.y >= 54 &&
        mapCloseBox.width >= 44 &&
        mapCloseBox.height >= 44,
      "map Close respects safe area and touch target"
    );
    const mapColours = await page.evaluate(() => {
      const ring = [
        ...document.querySelectorAll(".leaflet-marker-icon *"),
      ].find(el => getComputedStyle(el).borderTopWidth === "3px");
      const label = [...document.querySelectorAll("span")].find(
        el => el.textContent === "My Artists"
      );
      return {
        ring: ring && getComputedStyle(ring).borderTopColor,
        legend:
          label?.previousElementSibling &&
          getComputedStyle(label.previousElementSibling).backgroundColor,
      };
    });
    assert.ok(
      mapColours.ring && mapColours.ring === mapColours.legend,
      "map artist ring matches its legend token"
    );
    const searchBox = await search.boundingBox();
    assert.ok(
      searchBox.y > mapCloseBox.y + mapCloseBox.height,
      "map search does not overlap Close"
    );
    await search.fill("Ella");
    const clear = page.getByRole("button", { name: "Clear artist search" });
    await clear.click();
    assert.equal(await search.inputValue(), "", "clear only resets search");
    assert.ok(
      await mapClose.isVisible(),
      "map stays open after clearing search"
    );
    await search.fill("Ella");
    await page.screenshot({
      path: `${out}/screens/map-close-and-clear-${width}.png`,
    });
    await mapClose.click();
    await mapClose.waitFor({ state: "hidden" });
    assert.ok(
      await page.getByRole("button", { name: /See Artist Map/ }).isVisible(),
      "returns to Home artists"
    );
    assert.deepEqual(errors, [], "no unhandled browser errors");
    results.push({ width, checks: 15, errors, passed: true });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    `${out}/close-portfolio-results.json`,
    JSON.stringify(results, null, 2) + "\n"
  );
}
console.log(JSON.stringify(results, null, 2));
