import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { response } from "./launch-fixtures.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const out = "/private/tmp/tattoi-bookings-audit";
await mkdir(out, { recursive: true });
const base = process.env.AUDIT_URL || "http://127.0.0.1:5194";
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
    const errors = [],
      mutations = [];
    await context.route("**/*", async route => {
      const u = new URL(route.request().url());
      if (u.hostname !== "127.0.0.1") return route.abort();
      if (!u.pathname.startsWith("/api/trpc/")) return route.continue();
      const input = JSON.parse(u.searchParams.get("input") || "{}");
      const names = u.pathname.split("/").at(-1).split(",");
      if (route.request().method() === "POST") mutations.push(...names);
      return route.fulfill({
        json: names.map((name, i) => {
          let v = response(name, "client");
          if (name === "appointments.getClientBookings") {
            const a = v.appointments[0];
            v = {
              appointments:
                input[i]?.json?.tab === "past"
                  ? []
                  : [1, 2, 3].map(n => ({
                      ...a,
                      id: 100 + n,
                      sessionPlanId: 11,
                      projectName: "Jesus/Angels full arm",
                      sessionIndex: n,
                      sessionTotal: 3,
                      status: n === 1 ? "completed" : "confirmed",
                      startsAt: `2026-10-${10 + n}T00:00:00Z`,
                      endsAt: `2026-10-${10 + n}T03:00:00Z`,
                      amountPaidCents: 15000,
                      pendingFormCount: n === 2 ? 1 : 0,
                      paymentRequest:
                        n === 2
                          ? {
                              id: 5,
                              amountCents: 10000,
                              token: "partial-request",
                              status: "pending",
                            }
                          : null,
                    })),
              pendingRequests:
                input[i]?.json?.tab === "past"
                  ? []
                  : [
                      {
                        id: 9,
                        artistName: "Ella Morgan",
                        description: "A new dragon tattoo request",
                        status: "new",
                        conversationId: 12,
                      },
                    ],
              pendingConsults: [],
            };
          }
          if (name === "sessionPlans.getByClient") v = [];
          if (name === "projects.summary") {
            const s = v.sessions[0];
            v = {
              ...v,
              sessions: [1, 2]
                .map(n => ({
                  ...s,
                  id: 100 + n,
                  sessionPlanId: 11,
                  projectName: "Jesus/Angels full arm",
                  sessionIndex: n,
                  status: "confirmed",
                }))
                .concat({
                  ...s,
                  id: 103,
                  sessionPlanId: 12,
                  projectName: "Botanical forearm",
                }),
              plans: [
                {
                  id: 99,
                  status: "pending",
                  requiresDeposit: true,
                  projectName: "Unrelated proposal",
                  depositCents: 20000,
                },
              ],
              briefs: [
                {
                  id: 1,
                  description: "Religious design reference",
                  images: [],
                  projectKeys: ["plan:11"],
                },
                {
                  id: 2,
                  description: "Botanical private reference",
                  images: [],
                  projectKeys: ["plan:12"],
                },
              ],
              history: [
                {
                  id: 1,
                  type: "deposit",
                  amountCents: 15000,
                  method: "stripe",
                  projectKeys: ["plan:11"],
                },
                {
                  id: 2,
                  type: "balance",
                  amountCents: 99900,
                  method: "stripe",
                  projectKeys: ["plan:12"],
                },
              ],
            };
          }
          if (name === "funnel.getPaymentRequestInfo")
            v = {
              requestId: 5,
              amountCents: 10000,
              artistName: "Ella Morgan",
              serviceName: "Jesus/Angels full arm",
              fees: { platformFeeCents: 500, clientTotalCents: 10500 },
            };
          return { result: { data: { json: v } } };
        }),
      });
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base + "/bookings");
    await page
      .getByRole("heading", { name: "Jesus/Angels full arm", exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Project sittings").locator("li").count(),
      3
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Jesus/Angels full arm", exact: true })
        .count(),
      1
    );
    await page.getByText("A new dragon tattoo request").waitFor();
    const pay = page.getByRole("link", {
      name: "Review $100.00 request",
      exact: true,
    });
    assert.equal(await pay.getAttribute("href"), "/pay/partial-request");
    await page.screenshot({
      path: `${out}/bookings-${width}.png`,
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    );
    await pay.click();
    await page.getByRole("heading", { name: "Review your payment" }).waitFor();
    assert((await page.locator("dl").innerText()).includes("$100"));
    assert(!(await page.locator("dl").innerText()).includes("$450"));
    await page.goto(base + "/bookings");
    await page.getByRole("tab", { name: "Past", exact: true }).click();
    await page.getByRole("heading", { name: "No past projects yet" }).waitFor();
    await page.goto(base + "/projects/12?session=101");
    await page
      .getByText("Religious design reference", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Botanical private reference", { exact: true })
        .count(),
      0
    );
    assert.equal(
      await page.getByText("Unrelated proposal", { exact: true }).count(),
      0
    );
    assert.equal(
      await page.getByLabel("Project sittings").locator("li").count(),
      2
    );
    await page.getByRole("tab", { name: "Payments", exact: true }).click();
    await page
      .getByRole("heading", { name: "Project payment history · AUD" })
      .waitFor();
    assert.equal(await page.getByText("$999.00", { exact: true }).count(), 0);
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page
      .getByRole("button", { name: "Request a date change", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
    assert(
      (
        await page
          .getByRole("textbox", { name: "Message", exact: true })
          .inputValue()
      ).includes("Jesus/Angels full arm, sitting 1")
    );
    assert(!mutations.includes("messages.send"));
    await page.goto(base + "/projects/12?session=101&action=forms");
    await page
      .getByRole("heading", { name: "Consent forms", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}: grouped sittings, requests, exact payment link, Past empty state, project scope, reviewed change draft, form deep link, no overflow/runtime errors`
    );
    await context.close();
  }
} finally {
  await browser.close();
}
