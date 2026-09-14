import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { response } from "./ivory-fixtures.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const out = process.env.AUDIT_OUT || "/private/tmp/tattoi-feed-audit";
await mkdir(out, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  hasTouch: true,
  isMobile: true,
  serviceWorkers: "block",
});
await context.addInitScript(() => {
  localStorage.setItem("authToken", "test");
  localStorage.setItem("tattoi-theme-override", "light");
  sessionStorage.setItem("splashShown", "true");
});
let likes = 0,
  requests = 0;
await context.route("**/*", async route => {
  const u = new URL(route.request().url());
  if (u.hostname !== "127.0.0.1") return route.abort();
  if (u.pathname === "/__ivory_artwork.png")
    return route.fulfill({
      path: resolve("output/tattoi-ivory-complete/assets/botanical.png"),
      contentType: "image/png",
    });
  if (u.pathname.startsWith("/api/trpc/"))
    return route.fulfill({
      json: u.pathname
        .split("/")
        .at(-1)
        .split(",")
        .map(name => {
          if (name === "portfolio.toggleLike") {
            likes++;
            return { result: { data: { json: { liked: true } } } };
          }
          if (name === "consultations.create") {
            requests++;
            if (requests === 1)
              return {
                error: {
                  json: {
                    message: "Network unavailable",
                    code: -32603,
                    data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
                  },
                },
              };
            return { result: { data: { json: { id: 45 } } } };
          }
          let data = response(
            name === "feed.getArtistPublicProfile"
              ? "feed.getPublicArtistProfile"
              : name,
            "client"
          );
          if (name === "feed.getDiscoverFeed")
            data = {
              ...data,
              cards: Array.from({ length: 4 }, (_, i) => ({
                ...data.cards[0],
                id: 701 + i,
              })),
            };
          return { result: { data: { json: data } } };
        }),
    });
  if (u.pathname === "/api/version")
    return route.fulfill({ json: { version: "3.2.3" } });
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.setDefaultTimeout(10000);
const assert = (value, message) => {
  if (!value) throw new Error(message);
  console.log("PASS " + message);
};
try {
  await page.goto(
    (process.env.AUDIT_URL || "http://127.0.0.1:5196") + "/discover",
    { waitUntil: "networkidle" }
  );
  await page.addStyleTag({
    content:
      ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
  });
  await page
    .getByRole("button", { name: "View artist", exact: true })
    .nth(1)
    .scrollIntoViewIfNeeded();
  const scrollBefore = await page
    .locator(".client-home-content")
    .first()
    .evaluate(el => el.scrollTop);
  await page
    .getByRole("button", { name: "View artist", exact: true })
    .nth(1)
    .click();
  const profile = page.getByRole("dialog", { name: /profile/ });
  await profile.waitFor();
  await profile
    .getByRole("button", { name: "Book Consult", exact: true })
    .click();
  const booking = page.getByRole("dialog", { name: /Book with/ });
  await booking.waitFor();
  await page.keyboard.press("Tab");
  assert(
    await booking.evaluate(el => el.contains(document.activeElement)),
    "booking keyboard focus remains inside portalled dialog"
  );
  await page.keyboard.press("Escape");
  await booking.waitFor({ state: "detached" });
  assert(
    (await profile.count()) === 1,
    "Escape dismisses only the nested booking"
  );
  await page.waitForTimeout(100);
  assert(
    await profile
      .getByRole("button", { name: "Book Consult", exact: true })
      .evaluate(el => el === document.activeElement),
    "nested close restores focus to booking trigger"
  );
  await profile
    .getByRole("button", { name: "Book Consult", exact: true })
    .click();
  await booking.waitFor();
  await booking
    .getByLabel("Describe your idea *", { exact: true })
    .fill("An olive branch tattoo on my forearm");
  await booking.getByRole("button", { name: "Fine Line", exact: true }).click();
  await booking
    .getByRole("button", { name: "Send Request", exact: true })
    .click();
  await booking.getByRole("alert").waitFor();
  assert(
    (await booking
      .getByLabel("Describe your idea *", { exact: true })
      .inputValue()) === "An olive branch tattoo on my forearm",
    "failed booking preserves draft"
  );
  await booking
    .getByRole("button", { name: "Send Request", exact: true })
    .click();
  await booking.getByText("Request sent", { exact: true }).waitFor();
  const okBounds = await booking
    .getByRole("button", { name: "OK", exact: true })
    .boundingBox();
  assert(
    okBounds && okBounds.y >= 54 && okBounds.y + okBounds.height <= 840,
    "success action fits above the iPhone home indicator"
  );
  await page.screenshot({ path: out + "/booking-success.png" });
  await booking.getByRole("button", { name: "OK", exact: true }).click();
  await booking.waitFor({ state: "detached" });
  assert(
    requests === 2,
    "retry sends one request per attempt and closes on acknowledgement"
  );
  await profile
    .getByRole("button", {
      name: /View .*botanical|View .*portfolio|View .*branch/i,
    })
    .first()
    .click();
  await profile
    .getByRole("button", { name: "Like artwork", exact: true })
    .click();
  await profile
    .getByRole("button", { name: "Unlike artwork", exact: true })
    .waitFor();
  assert(likes === 1, "profile artwork like calls persistent mutation");
  await page.keyboard.press("Escape");
  assert(
    (await profile.count()) === 1,
    "Escape leaves artwork view inside profile"
  );
  await profile.getByRole("button", { name: "back", exact: true }).click();
  await profile.waitFor({ state: "detached" });
  await page
    .locator(".artist-focus-pill .artist-focus-pill-back")
    .first()
    .click();
  await page.waitForTimeout(500);
  const after = await page
    .locator(".client-home-content")
    .first()
    .evaluate(el => el.scrollTop);
  assert(
    Math.abs(after - scrollBefore) < 3,
    "Discover scroll position restored after profile and focus exit"
  );
  await page
    .locator(".client-home-content")
    .first()
    .evaluate(el => {
      el.scrollTop = 0;
    });
  await page.waitForTimeout(200);
  assert(
    await page
      .locator(".client-home-header")
      .evaluate(el => !el.classList.contains("header-hidden")),
    "header continues responding after focus unmount"
  );
  assert(errors.length === 0, "no browser exceptions");
  await page.screenshot({ path: out + "/discover.png" });
} finally {
  await browser.close();
}
