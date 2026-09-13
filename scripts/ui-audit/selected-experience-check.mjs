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
  for (const width of [440, 820, 1180]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1180 ? 820 : 1100 },
      hasTouch: true,
      timezoneId: "Australia/Brisbane",
      serviceWorkers: "block",
    });
    await context.addInitScript(() => {
      localStorage.setItem("authToken", "test");
      sessionStorage.setItem("splashShown", "true");
    });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") return route.abort();
      if (url.pathname.startsWith("/api/trpc/"))
        return route.fulfill({
          json: url.pathname
            .split("/")
            .at(-1)
            .split(",")
            .map(name => {
              let value = response(name, "artist");
              if (name === "projects.summary" && value?.sessions?.length)
                value = {
                  ...value,
                  sessions: [
                    {
                      ...value.sessions[0],
                      sessionPlanId: 10,
                      sessionIndex: 1,
                      sessionTotal: 2,
                    },
                    {
                      ...value.sessions[0],
                      id: 202,
                      sessionPlanId: 10,
                      sessionIndex: 2,
                      sessionTotal: 2,
                    },
                    {
                      ...value.sessions[0],
                      id: 203,
                      title: "A separate tattoo",
                      status: "completed",
                      pendingRequest: {
                        id: 45,
                        amountCents: 45000,
                        expiresAt: "2099-01-01T00:00:00Z",
                      },
                      sessionPlanId: 20,
                      sessionIndex: 1,
                      sessionTotal: 1,
                    },
                  ],
                };
              return { result: { data: { json: value } } };
            }),
        });
      if (url.pathname === "/api/version")
        return route.fulfill({ json: { version: "3.1.0" } });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const base = process.env.AUDIT_URL || "http://127.0.0.1:5194";
    await page.goto(base + "/calendar?date=2026-09-10", {
      waitUntil: "domcontentloaded",
    });
    const timeline = page.getByRole("region", {
      name: "Scrollable calendar timeline",
    });
    await timeline.waitFor();
    await page.waitForTimeout(400);
    const nav = await page.locator("#bottom-nav").boundingBox();
    assert(
      nav.y > 600 && nav.width >= width - 5,
      "Navigation must stay along the bottom"
    );
    const before = await timeline.evaluate(el => el.scrollTop);
    await timeline.hover();
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(500);
    const after = await timeline.evaluate(el => el.scrollTop);
    assert(after > before + 200, "Timeline must respond to wheel scrolling");
    const key = await page
      .locator('.v3-week-strip [aria-pressed="true"]')
      .innerText();
    assert(!key.endsWith("10"), "Selected date must follow scroll");
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(400);
    assert(
      (await timeline.evaluate(el => el.scrollTop)) < after,
      "Previous dates must be scrollable"
    );
    for (const end of ["previous", "next"]) {
      await timeline.evaluate((el, end) => {
        el.scrollTop =
          end === "previous" ? 0 : el.scrollHeight - el.clientHeight;
      }, end);
      await page.waitForTimeout(400);
      const position = await timeline.evaluate(el => ({
        top: el.scrollTop,
        max: el.scrollHeight - el.clientHeight,
      }));
      assert(
        position.top > 1000 && position.top < position.max - 1000,
        "Calendar must extend at either edge"
      );
      assert(
        (await page.locator(".v3-timeline-day").count()) < 40,
        "Virtual calendar DOM must remain bounded"
      );
    }
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.waitForTimeout(300);
    if (width === 440) {
      await page
        .getByRole("button", { name: /Expand agenda/ })
        .last()
        .click();
      await page.getByRole("region", { name: "Day agenda" }).waitFor();
      assert(await timeline.isVisible());
    }
    await page
      .getByRole("button", { name: "New booking", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.goto(base + "/projects/12?session=101", {
      waitUntil: "domcontentloaded",
    });
    await page.getByLabel("Tattoo project").waitFor();
    await page.getByLabel("Tattoo project").selectOption("plan:20");
    await page.waitForTimeout(200);
    assert(
      (await page.locator(".v3-header h1").innerText()) === "A separate tattoo"
    );
    assert(
      !(await page.getByLabel("Session", { exact: true }).count()),
      "Standalone project must not show other project sessions"
    );
    await page
      .getByText("Payment request already sent", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Request remaining balance", exact: true })
        .count(),
      0,
      "Do not invite a duplicate request"
    );
    await page.goto(base + "/projects/12?session=999999", {
      waitUntil: "domcontentloaded",
    });
    await page.getByText(/This session is not available/).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Finish session", exact: true })
        .count(),
      0,
      "Invalid links must not target another session"
    );
    await page.goto(base + "/dashboard", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Expand full week", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Show selected day", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}: bottom navigation, wheel scrolling, both infinite boundaries, expanding agenda, wizard entry, separate plans, dashboard week`
    );
    await context.close();
  }
} finally {
  await browser.close();
}
