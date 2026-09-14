import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { response } from "./launch-fixtures.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const out = "/private/tmp/tattoi-client-corrections";
await mkdir(out, { recursive: true });
try {
  for (const width of [440, 820, 1180]) {
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
            .map(name => {
              let value = response(name, "client");
              if (name === "projects.summary")
                value = {
                  ...value,
                  sessions: [
                    {
                      ...value.sessions[0],
                      title: "Session 1",
                      projectName: "Jesus/Angels full arm",
                      sessionPlanId: 11,
                      sessionIndex: 1,
                      sessionTotal: 2,
                    },
                    {
                      ...value.sessions[0],
                      id: 102,
                      title: "Session 2",
                      projectName: "Jesus/Angels full arm",
                      sessionPlanId: 11,
                      sessionIndex: 2,
                      sessionTotal: 2,
                    },
                    {
                      ...value.sessions[0],
                      id: 103,
                      title: "Session 1",
                      projectName: "Botanical forearm",
                      sessionPlanId: 12,
                      sessionIndex: 1,
                      sessionTotal: 1,
                    },
                  ],
                  plans: [
                    {
                      ...value.plans[0],
                      requiresDeposit: false,
                      depositRecorded: true,
                    },
                  ],
                };
              if (name === "sessionPlans.getByClient")
                value = value.map(p => ({
                  ...p,
                  requiresDeposit: false,
                  depositRecorded: true,
                }));
              if (name === "feed.getDiscoverFeed")
                value = {
                  cards: [
                    {
                      id: 1,
                      artistId: "artist-test",
                      artistName: "Ella Morgan",
                      artistAvatar: null,
                      artistCity: "Brisbane",
                      artistSlug: "ella",
                      keywords: ["Botanical"],
                      tags: ["Botanical"],
                      imageUrl: "/__test_image.svg",
                      description: "Botanical sleeve",
                      likeCount: 2,
                      isLiked: false,
                      mediaType: "image",
                    },
                  ],
                  nextCursor: null,
                };
              return { result: { data: { json: value } } };
            }),
        });
      if (u.pathname === "/__test_image.svg")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#363636"/><text x="80" y="400" fill="white" font-size="36">Tattoo reference fixture</text></svg>',
        });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const base = process.env.AUDIT_URL || "http://127.0.0.1:5194";
    await page.goto(base + "/projects/12?session=101", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("heading", { name: "Jesus/Angels full arm", exact: true })
      .waitFor();
    assert(
      (await page.getByLabel("Tattoo project").innerText()).includes(
        "Jesus/Angels full arm"
      )
    );
    assert(
      !(await page.getByLabel("Tattoo project").innerText()).includes(
        "Session 1"
      )
    );
    assert.equal(
      await page.getByRole("button", { name: /Review .* deposit/ }).count(),
      0
    );
    await page.getByRole("button", { name: /Sitting 2 ·/ }).click();
    await page
      .getByRole("heading", { name: "Jesus/Angels full arm", exact: true })
      .waitFor();
    await page.screenshot({ path: `${out}/booking-${width}.png` });
    await page.goto(base + "/bookings", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("heading", { name: "Bookings", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Review .*deposit/ }).count(),
      0
    );
    await page.goto(base + "/discover", { waitUntil: "domcontentloaded" });
    await page.locator(".discover-feed-cards").waitFor();
    await page.locator(".feed-card").first().waitFor();
    await page.screenshot({ path: `${out}/discover-${width}.png` });
    assert(await page.locator("#bottom-nav").isVisible());
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}: project names, session selection, paid cards hidden, original discovery feed, no overflow/errors`
    );
    await context.close();
  }
} finally {
  await browser.close();
}
