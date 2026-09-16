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
const out =
  (process.env.AUDIT_OUTPUT || "output/release-regressions") + "/sittings";
const baseURL = process.env.AUDIT_URL || "http://127.0.0.1:5198";
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

try {
  const sessions = [1, 2, 3].map(n => ({
    id: 100 + n,
    sessionPlanId: 11,
    sessionIndex: n,
    sessionTotal: 3,
    projectName: "Backend project",
    title: "Backend session " + n,
    startsAt: `2026-12-${10 + n}T00:00:00Z`,
    endsAt: `2026-12-${10 + n}T03:00:00Z`,
    timeZone: "Australia/Brisbane",
    status: "confirmed",
    estimateCents: 12345 + n,
    paidCents: 2300,
    remainingCents: 10045 + n,
  }));
  const summary = {
    conversationId: 12,
    artist,
    client,
    location: "Backend studio",
    sessions,
    plans: [],
    forms: [],
    briefs: [],
    history: [],
  };
  const overrides = {
    "projects.summary": summary,
    "forms.getPendingForms": [],
    "sessionPlans.getByClient": [],
    "appointments.getClientBookings": {
      appointments: sessions.map(s => ({
        ...s,
        conversationId: 12,
        artist,
        depositPaidCents: 2300,
        amountPaidCents: s.paidCents,
        balanceDueCents: s.remainingCents,
        pendingFormCount: 0,
      })),
      pendingRequests: [],
      pendingConsults: [],
    },
    "projects.clientWorkspace": {
      client,
      conversationId: 12,
      sessions: sessions.map(s => ({
        ...s,
        startTime: s.startsAt,
        endTime: s.endsAt,
        conversationId: 12,
      })),
      forms: [],
      notes: [],
    },
  };
  for (const role of ["artist", "client"]) {
    const { page, context } = await setup(role, overrides);
    await page.goto(baseURL + "/projects/12?session=101");
    const list = page.getByRole("list", { name: "Project sittings" });
    await list.waitFor();
    for (const n of [2, 3, 1]) {
      await list
        .getByRole("button", { name: new RegExp(`Sitting ${n} ·`) })
        .click();
      const card = list.locator(":scope > li").nth(n - 1);
      await card.locator(".v3-sitting-details").waitFor();
      assert.equal(await page.locator(".v3-sitting-details").count(), 1);
      assert.ok(
        await card
          .getByText(`$${((12345 + n) / 100).toFixed(2)}`, { exact: true })
          .count()
      );
      assert.ok(
        await card.evaluate(el => {
          const panel = el
            .querySelector(".v3-sitting-details")
            .getBoundingClientRect();
          return (
            panel.top >=
              el.querySelector("button").getBoundingClientRect().bottom &&
            (!el.nextElementSibling ||
              panel.bottom <= el.nextElementSibling.getBoundingClientRect().top)
          );
        })
      );
    }
    await list.getByRole("button", { name: /Sitting 1 ·/ }).click();
    assert.equal(await page.locator(".v3-sitting-details").count(), 0);
    await list.getByRole("button", { name: /Sitting 1 ·/ }).click();
    await page.screenshot({
      path: out + `/project-${role}.png`,
      fullPage: true,
    });
    console.log(
      role +
        ": project selection, own-card placement, server amounts, collapse pass"
    );
    await context.close();
  }
  for (const [role, path, title] of [
    ["client", "/bookings", /Sitting 2 ·/],
    ["artist", "/clients?client=client-test", "Backend session 2"],
  ]) {
    const { page, context, calls } = await setup(role, overrides);
    await page.goto(baseURL + path);
    await page.getByRole("button", { name: title }).click();
    const card = page
      .locator(".v3-sitting-card")
      .filter({ has: page.getByRole("button", { name: title }) });
    await card.getByText("$123.47", { exact: true }).waitFor();
    assert.ok(
      calls.some(
        c => c.name === "projects.summary" && c.input.conversationId === 12
      )
    );
    assert.equal(
      await card
        .getByRole("link", { name: "Open sitting & actions" })
        .getAttribute("href"),
      "/projects/12?session=102"
    );
    await page.screenshot({ path: out + `/list-${role}.png`, fullPage: true });
    console.log(
      path + ": inline server-backed details and exact sitting action pass"
    );
    await context.close();
  }

  const calendarRows = sessions.map(s => ({
    ...s,
    artistId: artist.id,
    clientId: client.id,
    client,
    artist,
    clientName: client.name,
    startTime: s.startsAt,
    endTime: s.endsAt,
    conversationId: 12,
    totalPaidAmountCents: s.paidCents,
    remainingBalanceCents: s.remainingCents,
  }));
  {
    const { page, context } = await setup("artist", {
      ...overrides,
      "appointments.getStudioCalendar": calendarRows,
    });
    await page.goto(baseURL + "/studio");
    await page.getByRole("button", { name: /Backend session 2/ }).click();
    const card = page
      .locator(".v3-sitting-card")
      .filter({ has: page.getByRole("button", { name: /Backend session 2/ }) });
    await card.getByRole("link", { name: "Open booking workspace" }).waitFor();
    assert.equal(
      await card
        .getByRole("link", { name: "Open booking workspace" })
        .getAttribute("href"),
      "/projects/12?session=102"
    );
    assert.equal(await page.locator(".v3-studio-inspector").count(), 0);
    console.log("studio: selected booking details inside its card pass");
    await context.close();
  }
  {
    const { page, context } = await setup("artist", {
      ...overrides,
      "appointments.getArtistCalendar": calendarRows,
      "appointments.getStudioCalendar": calendarRows,
    });
    await page.goto(baseURL + "/calendar?date=2026-12-12");
    for (const width of [390, 820]) {
      await page.setViewportSize({ width, height: 874 });
      const timeline = page.getByRole("region", {
        name: "Scrollable calendar timeline",
      });
      const trigger = timeline.getByRole("button", {
        name: /Backend session 2/,
      });
      await trigger.click();
      const expandedCard = timeline
        .locator(".v3-sitting-card")
        .filter({
          has: page.getByRole("button", { name: /Backend session 2/ }),
        });
      await expandedCard
        .getByRole("link", { name: "Open booking", exact: true })
        .waitFor();
      await page.waitForTimeout(150);
      const layout = await expandedCard.evaluate(el => {
        const panel = el
          .querySelector(".v3-sitting-details")
          .getBoundingClientRect();
        const day = el.closest(".v3-timeline-day").getBoundingClientRect();
        return {
          below:
            panel.top >=
            el.querySelector("button").getBoundingClientRect().bottom,
          contained: panel.bottom <= day.bottom,
        };
      });
      assert.ok(layout.below && layout.contained, JSON.stringify(layout));
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page.screenshot({ path: out + `/timeline-${width}.png` });
      await trigger.click();
    }
    await page.setViewportSize({ width: 390, height: 874 });
    console.log(
      "calendar timeline: inline disclosure at phone/tablet widths without virtual-day clipping pass"
    );
    await page.locator(".v3-agenda-toggle").click();
    const agenda = page.getByRole("region", { name: "Day agenda" });
    await agenda.getByRole("button", { name: /Backend session 2/ }).click();
    await agenda
      .getByRole("link", { name: "Open booking", exact: true })
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    console.log(
      "calendar agenda: inline inspector without duplicate sheet pass"
    );
    await context.close();
  }
  {
    const plan = {
      id: 11,
      conversationId: 12,
      artist,
      clientId: client.id,
      projectName: "Backend proposal",
      status: "pending",
      requiresDeposit: true,
      depositTotalCents: 7400,
      platformFeeCents: 252,
      totalEstimateCents: 35000,
      items: sessions.map(s => ({
        id: s.id,
        sessionIndex: s.sessionIndex,
        startsAt: s.startsAt,
        durationMinutes: 137,
        estimateCents: 12347,
        depositCents: 2467,
      })),
    };
    const { page, context } = await setup("client", {
      ...overrides,
      "sessionPlans.getByClient": [plan],
      "sessionPlans.getById": plan,
    });
    await page.goto(baseURL + "/bookings");
    const proposal = page
      .locator(".v3-panel")
      .filter({ has: page.getByRole("heading", { name: "Backend proposal" }) });
    const button = proposal.getByRole("button", { name: /Sitting 2/ });
    await button.click();
    await proposal.getByText("$24.67", { exact: true }).waitFor();
    await proposal
      .getByRole("button", { name: /Review .*deposit & fee/ })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByRole("button", { name: /Sitting 2/ }).click();
    await dialog.getByText("$24.67", { exact: true }).waitFor();
    console.log(
      "proposal list and checkout: shared disclosure and backend deposit pass"
    );
    await context.close();
  }
} finally {
  await browser.close();
}
