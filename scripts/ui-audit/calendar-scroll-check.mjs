import { createRequire } from "node:module";
import { mkdir, writeFile, access } from "node:fs/promises";
import { response } from "./ivory-fixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_PATH || "playwright"
);
const out = "output/tattoi-ui-audit";
const baseURL = process.env.AUDIT_URL || "http://127.0.0.1:5196";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const results = [];
let webkitInstalled = false;
try {
  await access(webkit.executablePath());
  webkitInstalled = true;
} catch {}

for (const width of [390, 820]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1180 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    serviceWorkers: "block",
    timezoneId: "Australia/Brisbane",
  });
  await context.addInitScript(() => {
    localStorage.setItem("tattoi-theme-override", "light");
    localStorage.setItem("authToken", "test");
    localStorage.setItem("ui_debug_enabled", "false");
    sessionStorage.setItem("splashShown", "true");
    window.__calendarAudit = {
      writes: [],
      scrolls: [],
      inputs: [],
      harness: false,
    };
    const audit = window.__calendarAudit;
    const isCalendar = el => el?.classList?.contains("v3-timeline-scroll");
    const prop = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollTop"
    );
    Object.defineProperty(Element.prototype, "scrollTop", {
      ...prop,
      set(value) {
        if (isCalendar(this) && !audit.harness)
          audit.writes.push({
            kind: "scrollTop",
            value,
            time: performance.now(),
          });
        return prop.set.call(this, value);
      },
    });
    const original = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (...args) {
      if (isCalendar(this) && !audit.harness)
        audit.writes.push({
          kind: "scrollTo",
          value: args,
          time: performance.now(),
        });
      return original.apply(this, args);
    };
    document.addEventListener(
      "scroll",
      event => {
        if (isCalendar(event.target))
          audit.scrolls.push({
            top: event.target.scrollTop,
            time: performance.now(),
          });
      },
      true
    );
    for (const type of [
      "touchstart",
      "touchend",
      "touchcancel",
      "wheel",
      "scrollend",
    ])
      document.addEventListener(
        type,
        event => {
          if (
            isCalendar(event.target) ||
            event.target?.closest?.(".v3-timeline-scroll")
          )
            audit.inputs.push({ type, time: performance.now() });
        },
        { capture: true, passive: true }
      );
  });
  let extraSessions = false;
  let delayedResponses = 0;
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/trpc/")) {
      const names = url.pathname.split("/").at(-1).split(",");
      const calendarResponse = names.some(name =>
        /appointments\.get(?:Artist|Studio)Calendar/.test(name)
      );
      if (extraSessions && calendarResponse) {
        await new Promise(resolve => setTimeout(resolve, 120));
        delayedResponses++;
      }
      return route.fulfill({
        json: names.map(name => {
          let data = response(name, "artist");
          if (
            extraSessions &&
            /appointments\.get(?:Artist|Studio)Calendar/.test(name)
          ) {
            const template = response(
              "appointments.getArtistCalendar",
              "artist"
            )[0];
            data = [
              ...data,
              ...Array.from({ length: 4 }, (_, index) => ({
                ...template,
                id: 800 + index,
                clientName: `Deferred client ${index + 1}`,
                title: "Deferred October session",
                startTime: `2026-10-01T0${index}:00:00Z`,
                endTime: `2026-10-01T0${index + 1}:00:00Z`,
              })),
            ];
          }
          return { result: { data: { json: data } } };
        }),
      });
    }
    if (url.pathname === "/api/version")
      return route.fulfill({ json: { version: "3.2.3" } });
    if (url.pathname === "/__ivory_artwork.png")
      return route.fulfill({
        path: "output/tattoi-ivory-complete/assets/botanical.png",
        contentType: "image/png",
      });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const checks = [];
  const check = (name, passed, details) => {
    checks.push({ name, passed, details });
    console.log(
      `${width} ${passed ? "PASS" : "FAIL"} ${name}`,
      details ? JSON.stringify(details) : ""
    );
  };
  const reset = () =>
    page.evaluate(() => {
      window.__calendarAudit.writes = [];
      window.__calendarAudit.scrolls = [];
      window.__calendarAudit.inputs = [];
    });
  const sample = () =>
    page.evaluate(() => {
      const el = document.querySelector(".v3-timeline-scroll");
      const rect = el.getBoundingClientRect();
      const row = [...el.querySelectorAll(".v3-timeline-day")].find(row => {
        const r = row.getBoundingClientRect();
        return r.top <= rect.top + 1 && r.bottom > rect.top + 1;
      });
      return {
        top: el.scrollTop,
        height: el.clientHeight,
        firstDay: row?.getAttribute("aria-label"),
        firstIndex: Number(row?.dataset.index),
        withinDay: row ? rect.top - row.getBoundingClientRect().top : null,
        month: document.querySelector(".v3-timeline-heading strong")
          ?.textContent,
        writes: window.__calendarAudit.writes,
        scrolls: window.__calendarAudit.scrolls,
        inputs: window.__calendarAudit.inputs,
        sessions: document.querySelectorAll(".v3-timeline-session").length,
        body: document.body.innerText,
      };
    });
  const geometry = () =>
    page.evaluate(() => {
      const rows = [...document.querySelectorAll(".v3-timeline-day")];
      const issues = [];
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        const children = [...row.children].map(child => ({
          tag: child.tagName,
          ...Object.fromEntries(
            ["top", "bottom", "height"].map(key => [
              key,
              child.getBoundingClientRect()[key],
            ])
          ),
        }));
        if (children.some(child => child.bottom > r.bottom + 1))
          issues.push({
            day: row.getAttribute("aria-label"),
            kind: "content exceeds row",
            children,
            bottom: r.bottom,
          });
        for (let i = 1; i < children.length; i++)
          if (children[i].top < children[i - 1].bottom - 1)
            issues.push({
              day: row.getAttribute("aria-label"),
              kind: "overlapping children",
              children,
            });
      }
      return {
        rows: rows.length,
        issues,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
  try {
    await page.clock.setFixedTime(new Date("2026-09-09T23:41:00Z"));
    await page.goto(`${baseURL}/calendar?date=2026-09-29`, {
      waitUntil: "networkidle",
    });
    await page.addStyleTag({
      content:
        ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
    });
    await page.waitForTimeout(350);
    const timeline = page.locator(".v3-timeline-scroll");
    await reset();
    const beforeWheel = await sample();
    const box = await timeline.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (const delta of [150, 190, 210, 175, 110, 70, 35]) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(45);
    }
    await page.waitForTimeout(350);
    const afterWheel = await sample();
    check(
      "wheel crosses days and month without app position writes",
      afterWheel.top > beforeWheel.top + 600 &&
        afterWheel.month === "October 2026" &&
        afterWheel.writes.length === 0,
      {
        distance: afterWheel.top - beforeWheel.top,
        writes: afterWheel.writes,
        scrollEvents: afterWheel.scrolls.length,
        month: afterWheel.month,
      }
    );

    await reset();
    const cdp = await context.newCDPSession(page);
    const beforeTouch = await sample();
    await cdp.send("Input.synthesizeScrollGesture", {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height * 0.7),
      yDistance: -600,
      speed: 850,
      gestureSourceType: "touch",
      preventFling: false,
    });
    await page.waitForTimeout(650);
    const afterTouch = await sample();
    check(
      "browser touch gesture scrolls without app position writes",
      afterTouch.top > beforeTouch.top + 100 && afterTouch.writes.length === 0,
      {
        distance: afterTouch.top - beforeTouch.top,
        writes: afterTouch.writes,
        scrollEvents: afterTouch.scrolls.length,
        inputs: afterTouch.inputs,
      }
    );

    // Hold a touch while a month query resolves: no row reshaping until release.
    await page.goto(`${baseURL}/calendar?date=2026-09-29`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(300);
    await reset();
    extraSessions = true;
    await timeline.dispatchEvent("touchstart", {
      touches: [{ identifier: 1 }],
    });
    const queryBox = await timeline.boundingBox();
    await page.mouse.move(
      queryBox.x + queryBox.width / 2,
      queryBox.y + queryBox.height / 2
    );
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(70);
    }
    await page.waitForTimeout(400);
    const held = await sample();
    check(
      "new month rows deferred while touch is held",
      delayedResponses > 0 &&
        !held.body.includes("Deferred October session") &&
        held.writes.length === 0,
      {
        delayedResponses,
        writes: held.writes,
        month: held.month,
        sessions: held.sessions,
      }
    );
    await timeline.dispatchEvent("touchend", { touches: [] });
    await page.waitForTimeout(450);
    const released = await sample();
    check(
      "deferred sessions appear after touch settles with date preserved",
      released.body.includes("Deferred October session") &&
        released.firstDay === held.firstDay,
      {
        beforeDay: held.firstDay,
        afterDay: released.firstDay,
        writes: released.writes,
        sessions: released.sessions,
      }
    );
    check(
      "deferred rows do not overlap",
      (await geometry()).issues.length === 0,
      await geometry()
    );
    extraSessions = false;

    // Place the harness near the finite virtual-window edge, then let the app rebase.
    await timeline.dispatchEvent("touchstart", {
      touches: [{ identifier: 2 }],
    });
    await page.evaluate(() => {
      window.__calendarAudit.harness = true;
      document.querySelector(".v3-timeline-scroll").scrollTop = 10 * 138 + 23;
      window.__calendarAudit.harness = false;
    });
    await page.waitForTimeout(350);
    const edgeHeld = await sample();
    await reset();
    await timeline.dispatchEvent("touchend", { touches: [] });
    await page.waitForTimeout(450);
    const rebased = await sample();
    check(
      "virtual window rebases after release without visible date jump",
      edgeHeld.firstIndex < 20 &&
        rebased.firstIndex > 900 &&
        rebased.firstDay === edgeHeld.firstDay &&
        Math.abs(rebased.withinDay - edgeHeld.withinDay) < 1,
      {
        before: {
          day: edgeHeld.firstDay,
          index: edgeHeld.firstIndex,
          offset: edgeHeld.withinDay,
        },
        after: {
          day: rebased.firstDay,
          index: rebased.firstIndex,
          offset: rebased.withinDay,
        },
        writes: rebased.writes,
      }
    );

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.waitForTimeout(550);
    check(
      "Today returns to current day",
      (await sample()).firstDay === "Thursday 10 September 2026",
      { day: (await sample()).firstDay }
    );
    const compact = await geometry();
    check(
      "compact booked rows fit their virtual geometry",
      compact.issues.length === 0 && !compact.horizontalOverflow,
      compact
    );
    await page
      .locator(".v3-timeline-heading")
      .getByRole("button", { name: "Expand agenda", exact: true })
      .click();
    await page.waitForTimeout(250);
    const expanded = await geometry();
    check(
      "expanded booked rows fit their virtual geometry",
      expanded.issues.length === 0 &&
        !expanded.horizontalOverflow &&
        (await page
          .locator(".v3-continuous-calendar")
          .getAttribute("data-expanded")) === "true",
      expanded
    );
    await page
      .locator(".v3-timeline-heading")
      .getByRole("button", { name: "Compact agenda", exact: true })
      .click();
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await page.waitForTimeout(1000);
    check(
      "next week navigation reaches Monday",
      (await sample()).firstDay === "Monday 14 September 2026",
      { day: (await sample()).firstDay }
    );
    await page
      .getByRole("button", { name: "Previous week", exact: true })
      .click();
    await page.waitForTimeout(1000);
    check(
      "previous week navigation reaches Monday",
      (await sample()).firstDay === "Monday 7 September 2026",
      { day: (await sample()).firstDay }
    );
    await page
      .getByRole("button", { name: "Thursday, 10 September 2026", exact: true })
      .click();
    await page.waitForTimeout(800);
    check(
      "week date selection reaches requested day",
      (await sample()).firstDay === "Thursday 10 September 2026",
      { day: (await sample()).firstDay }
    );
    await page.screenshot({ path: `${out}/calendar-${width}-timeline.png` });
    await page.locator(".v3-timeline-session").first().click();
    await page
      .getByRole("button", { name: "Close booking details", exact: true })
      .waitFor();
    check("session opens booking details", true, {
      presentation: width < 768 ? "sheet" : "inspector",
    });
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/calendar-${width}-booking.png` });
    await page.setViewportSize({ width, height: width === 390 ? 700 : 1000 });
    await page.waitForTimeout(250);
    check(
      "resize retains selected booking",
      await page
        .getByRole("button", { name: "Close booking details", exact: true })
        .isVisible(),
      await geometry()
    );
    await page
      .getByRole("button", { name: "Close booking details", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Book on 10 September 2026", exact: true })
      .click();
    await page.getByRole("dialog", { name: "New booking" }).waitFor();
    check("day add button opens dated booking flow", true);
    check(
      "no browser errors or error boundary",
      errors.length === 0 &&
        !(await page.locator("body").innerText()).includes(
          "Something went wrong"
        ),
      errors
    );
  } catch (error) {
    check("scenario completed", false, error.message);
  }
  results.push({ width, checks, errors });
  await context.close();
}
await browser.close();
const report = {
  checkedAt: new Date().toISOString(),
  browser: "Chromium with mobile/touch emulation",
  webkitInstalled,
  limits: [
    "No WebKit browser is installed for this local audit.",
    "Chromium gesture checks establish scroll-position ownership and row stability, not physical iPhone/WKWebView deceleration quality.",
    "All API responses are local fixtures; external network requests are blocked.",
  ],
  results,
};
await writeFile(
  `${out}/calendar-scroll-results.json`,
  JSON.stringify(report, null, 2)
);
if (results.some(result => result.checks.some(check => !check.passed)))
  process.exitCode = 1;
