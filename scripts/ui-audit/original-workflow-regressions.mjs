// Read-only audit of application source. Browser requests are isolated fixtures.
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = process.cwd(),
  require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { response: base } = await import(
  pathToFileURL(root + "/scripts/ui-audit/ivory-fixtures.mjs")
);
const { artist, client } = await import(
  pathToFileURL(root + "/scripts/ui-audit/launch-fixtures.mjs")
);
const out = process.env.AUDIT_OUTPUT || "output/tattoi-original-ivory";
const url = process.env.AUDIT_URL || "http://127.0.0.1:5198";
await mkdir(out + "/screens", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const results = [];
async function setup(role, override = {}, init) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 874 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    timezoneId: "Australia/Brisbane",
  });
  await context.addInitScript(() => {
    if (!localStorage.getItem("tattoi-theme-override"))
      localStorage.setItem("tattoi-theme-override", "light");
    localStorage.setItem("authToken", "test");
    sessionStorage.setItem("splashShown", "true");
    localStorage.setItem("ui_debug_enabled", "false");
  });
  if (init) await context.addInitScript(init);
  const calls = [];
  await context.route("**/*", async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== "127.0.0.1") return r.abort();
    if (u.pathname.startsWith("/api/public/artist/"))
      return r.fulfill({
        json: {
          id: artist.id,
          slug: "ella-morgan",
          displayName: artist.name,
          theme: "light",
          bannerUrl: null,
          styleOptions: ["Fine Line"],
          placementOptions: ["Forearm"],
          budgetRanges: [{ label: "$500–$1000", min: 500, max: 1000 }],
          services: [],
          enabledSteps: [
            "intent",
            "contact",
            "style",
            "bodyPlacement",
            "budget",
            "availability",
          ],
        },
      });
    if (u.pathname === "/__ivory_artwork.png")
      return r.fulfill({
        path: root + "/output/tattoi-ivory-complete/assets/botanical.png",
        contentType: "image/png",
      });
    if (u.pathname.startsWith("/api/trpc/"))
      return r.fulfill({
        json: u.pathname
          .split("/")
          .at(-1)
          .split(",")
          .map((name, i) => {
            let input;
            try {
              const raw =
                r.request().postDataJSON() ||
                JSON.parse(u.searchParams.get("input") || "{}");
              input = raw[i]?.json ?? raw.json ?? raw;
            } catch {}
            calls.push({ name, method: r.request().method(), input });
            return {
              result: {
                data: {
                  json:
                    name in override
                      ? typeof override[name] === "function"
                        ? override[name](input)
                        : override[name]
                      : base(name, role),
                },
              },
            };
          }),
      });
    if (u.pathname === "/api/version")
      return r.fulfill({ json: { version: "3.2.3" } });
    return r.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  return { page, context, calls, errors };
}

const originalFixtures = {
  "funnel.getArtistBySlug": {
    id: artist.id,
    userId: artist.id,
    displayName: artist.name,
    city: "Brisbane",
    bio: "Fine-line botanicals",
    services: [],
    portfolioImages: [],
    hasSeminars: false,
  },
  "conversations.list": base("conversations.list", "artist").map(row => ({
    ...row,
    createdAt: "2026-09-09T00:00:00Z",
  })),
  "appointments.getArtistCalendar": base(
    "appointments.getArtistCalendar",
    "artist"
  ).map(row => ({ ...row, clientArrived: 1 })),
  "feed.getArtistPublicProfile": {
    ...artist,
    displayName: artist.name,
    slug: "ella-morgan",
    keywords: ["Fine Line"],
    portfolio: [],
    postCount: 0,
    totalLikes: 0,
  },
};
const findings = [];
try {
  for (const [role, path, name] of [
    ["artist", "/dashboard", "home"],
    ["artist", "/conversations", "messages"],
    ["artist", "/calendar", "calendar"],
    ["artist", "/artist-profile", "profile"],
    ["artist", "/settings", "settings"],
    ["client", "/bookings", "bookings"],
    ["client", "/discover", "discover"],
    ["client", "/profile", "client-profile"],
    ["merchant", "/dashboard", "supplier-home"],
    ["merchant", "/merchant/products", "products"],
    ["public", "/login", "login"],
    ["public", "/ella-morgan", "public-hub"],
    ["public", "/book/ella-morgan", "public-booking"],
    ["public", "/start/ella-morgan", "consultation"],
  ]) {
    const { page, context, errors, calls } = await setup(
      role,
      originalFixtures,
      () =>
        localStorage.setItem(
          "manus_completed_tours",
          JSON.stringify(["dashboard-overview", "profile-onboarding"])
        )
    );
    await page.goto(url + path);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: out + "/" + name + ".png", fullPage: true });
    assert.equal(
      await page.getByText("Something went wrong", { exact: true }).count(),
      0,
      name + " error boundary"
    );
    assert.deepEqual(errors, [], name + " runtime errors");
    findings.push({
      role,
      path,
      errors,
      text: (await page.locator("body").innerText()).slice(0, 3500),
      calls: [...new Set(calls.map(c => c.name))],
    });
    assert.equal(
      await page.getByText("Not Available", { exact: true }).count(),
      0,
      name + " fixture-backed page loads"
    );
    console.log(name, errors);
    await context.close();
  }
  for (const width of [390, 820]) {
    for (const role of ["artist", "client"]) {
      let messages = Array.from({ length: 35 }, (_, i) => ({
        id: i + 1,
        conversationId: 12,
        senderId: client.id,
        content: "Earlier conversation " + i,
        messageType: "text",
        createdAt: new Date(Date.now() - 100000 + i * 1000).toISOString(),
      }));
      const { page, context, errors, calls } = await setup(role, {
        ...originalFixtures,
        "messages.list": () => messages,
        "messages.send": input => {
          const saved = {
            ...input,
            id: 100,
            senderId: role === "artist" ? artist.id : client.id,
            createdAt: new Date().toISOString(),
          };
          messages.push(saved);
          return saved;
        },
      });
      await page.setViewportSize({ width, height: 874 });
      await page.goto(url + "/chat/12");
      await page
        .getByPlaceholder("Type a message...")
        .fill("Message remains visible after sending");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page.locator('[data-message-id="100"]').waitFor();
      await page.waitForTimeout(500);
      assert.equal(
        await page.locator("[data-message-stream]").count(),
        1,
        "Exactly one responsive chat mounted"
      );
      const message = await page
        .locator('[data-message-id="100"]')
        .boundingBox();
      const composer = await page
        .getByPlaceholder("Type a message...")
        .boundingBox();
      assert.ok(
        message && message.y >= 0 && message.y + message.height <= composer.y,
        "Sent message visible above composer"
      );
      assert.ok(
        calls.some(c => c.name === "messages.send"),
        "Send reaches backend mutation"
      );
      assert.deepEqual(errors, []);
      assert.equal(
        await page.getByText("Something went wrong", { exact: true }).count(),
        0
      );
      await page.screenshot({
        path: out + "/chat-" + role + "-" + width + ".png",
      });
      findings.push({ name: "chat-send-" + role + "-" + width, passed: true });
      console.log("chat-send", role, width, "passed");
      if (role === "artist") {
        await page.getByRole("button", { name: "BOOK", exact: true }).click();
        await page.getByRole("dialog").waitFor();
        await page.waitForTimeout(700);
        assert.equal(
          await page.getByRole("dialog").count(),
          1,
          "One booking sheet only"
        );
        await page.screenshot({ path: out + "/booking-" + width + ".png" });
        findings.push({ name: "booking-sheet-" + width, passed: true });
      }
      await context.close();
    }
  }
  {
    const { page, context, errors, calls } = await setup(
      "artist",
      originalFixtures,
      () =>
        localStorage.setItem(
          "manus_completed_tours",
          JSON.stringify(["dashboard-overview", "profile-onboarding"])
        )
    );
    await page.goto(url + "/dashboard");
    await page.getByRole("button", { name: /EARNED.*NEXT PAYOUT/i }).click();
    await page.getByText("Money", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Clients", exact: true }).click();
    await page.waitForTimeout(400);
    assert.ok(
      calls.some(c => c.name === "dashboard.getClientSessions"),
      "Clients uses original backend query"
    );
    await page.getByRole("button", { name: "Supplies", exact: true }).click();
    await page.waitForTimeout(400);
    assert.equal(
      await page.getByText("Something went wrong", { exact: true }).count(),
      0
    );
    assert.deepEqual(errors, []);
    findings.push({
      name: "original-home-money-clients-supplies",
      passed: true,
    });
    await context.close();
  }
  {
    const { page, context, errors } = await setup(
      "artist",
      originalFixtures,
      () =>
        localStorage.setItem(
          "manus_completed_tours",
          JSON.stringify(["dashboard-overview", "profile-onboarding"])
        )
    );
    await page.goto(url + "/calendar");
    await page.getByRole("button", { name: "Next month", exact: true }).click();
    await page
      .getByRole("button", { name: "Previous month", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Add booking on/ })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(700);
    assert.equal(await page.getByRole("dialog").count(), 1);
    assert.equal(
      await page.getByText("Something went wrong", { exact: true }).count(),
      0
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: out + "/calendar-quick-book.png" });
    findings.push({ name: "calendar-navigation-and-quick-book", passed: true });
    await context.close();
  }
  for (const width of [320, 820]) {
    const { page, context, errors } = await setup(
      "artist",
      originalFixtures,
      () => {
        localStorage.setItem("tattoi-theme-override", "dark");
        localStorage.setItem(
          "manus_completed_tours",
          JSON.stringify(["dashboard-overview", "profile-onboarding"])
        );
      }
    );
    await page.setViewportSize({ width, height: 874 });
    await page.goto(url + "/dashboard");
    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
    await page.waitForTimeout(400);
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      "No horizontal page overflow"
    );
    await page.screenshot({ path: out + "/home-dark-" + width + ".png" });
    findings.push({ name: "dark-home-" + width, passed: true });
    await context.close();
  }
  await writeFile(out + "/inventory.json", JSON.stringify(findings, null, 2));
} finally {
  await browser.close();
}
