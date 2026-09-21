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
    const close = async () => page.getByRole("dialog").last().getByRole("button", {name:"Close",exact:true}).click();
    await page.getByRole("dialog",{name:/Sitting 1 ·/}).waitFor();
    await close();
    const list = page.getByRole("list", { name: "Project sittings" });
    for (const n of [2, 3, 1]) {
      await list.getByRole("button", {name:new RegExp(`Sitting ${n} ·`)}).click();
      const sheet=page.getByRole("dialog",{name:new RegExp(`Sitting ${n} ·`)});
      await sheet.getByText(`$${((12345+n)/100).toFixed(2)}`,{exact:true}).waitFor();
      assert(await sheet.evaluate(el=>el.dataset.side==='bottom'&&!el.closest('.v3-sitting-card')));
      await close();
    }
    console.log(role+": project sitting sheets retain exact server amounts and close to the project");
    await context.close();
  }
  for (const [role, path, title] of [
    ["client", "/bookings", /Sitting 2 ·/],
    ["artist", "/clients?client=client-test", "Backend session 2"],
  ]) {
    const { page, context, calls } = await setup(role, overrides);
    await page.goto(baseURL + path);
    if (path === "/bookings") await page.getByRole("button",{name:"View sittings",exact:true}).first().click();
    await page.getByRole("button", { name: title }).click();
    const card = page.getByRole("dialog", {name:title});
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
      path + ": sheet server-backed details and exact sitting action pass"
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
    const card = page.getByRole("dialog", {name:/Backend session 2/});
    await card.getByRole("link", { name: "Open booking workspace" }).waitFor();
    assert.equal(
      await card
        .getByRole("link", { name: "Open booking workspace" })
        .getAttribute("href"),
      "/projects/12?session=102"
    );
    assert.equal(await page.locator(".v3-studio-inspector").count(), 0);
    console.log("studio: selected booking details in a sheet pass");
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
      const sheet=page.getByRole("dialog");
      await sheet.getByRole("link",{name:"Open booking",exact:true}).waitFor();
      assert(await sheet.evaluate(el=>!el.closest('.v3-timeline-day')&&el.dataset.side==='bottom'));
      await page.screenshot({path:out+`/timeline-${width}.png`});
      await sheet.getByRole("button",{name:"Close",exact:true}).click();
    }
    await page.setViewportSize({ width: 390, height: 874 });
    console.log(
      "calendar timeline: portalled sheets at phone/tablet widths without virtual-day clipping pass"
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: /Expand agenda|Compact agenda|Collapse agenda/,
        })
        .count(),
      0
    );
    console.log("calendar: redundant agenda controls absent");
    await context.close();
  }
  {
    // A proposal without booked sittings owns its own project card.
    const plan = {
      id: 22,
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
    await page.getByRole("button",{name:/Backend proposal.*View booking proposal/}).click();
    const review=page.getByRole("dialog",{name:"Review your booking",exact:true});
    await review.getByText("$2.52",{exact:true}).waitFor();
    await review.getByRole("button",{name:/Sitting 2/}).click();
    await page.getByRole("dialog",{name:"Sitting 2",exact:true}).getByText("$24.67",{exact:true}).waitFor();
    console.log(
      "proposal list and checkout: shared disclosure and backend deposit pass"
    );
    await context.close();
  }
} finally {
  await browser.close();
}
