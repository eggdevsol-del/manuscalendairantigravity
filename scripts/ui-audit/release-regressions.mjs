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
const out = process.env.AUDIT_OUTPUT || "output/release-regressions";
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

const rows = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i + 1,
    conversationId: 12,
    senderId: i % 2 ? artist.id : client.id,
    content:
      "History message " +
      i +
      " with enough text to occupy a normal chat bubble.",
    messageType: "text",
    createdAt: "2026-09-16T00:00:00Z",
  }));
async function run(name, fn) {
  try {
    const details = await fn();
    results.push({ name, ...details });
    console.log(name, JSON.stringify(details));
  } catch (e) {
    results.push({ name, error: e.message });
    console.log(name, e.message);
  }
}
const gap = page =>
  page
    .locator(".v3-messages")
    .evaluate(e => ({
      top: e.scrollTop,
      gap: e.scrollHeight - e.clientHeight - e.scrollTop,
      height: e.clientHeight,
      scrollHeight: e.scrollHeight,
    }));
try {
  for (const width of [320, 390, 440, 820])
    for (const role of ["artist", "client"]) {
      await run("long-thread-send-" + width + "-" + role, async () => {
        let messages = rows();
        const s = await setup(role, {
          "messages.list": () => messages,
          "messages.send": input => {
            const saved = {
              ...input,
              id: 99,
              senderId: role === "artist" ? artist.id : client.id,
              createdAt: new Date().toISOString(),
            };
            messages = [...messages, saved];
            return saved;
          },
        });
        await s.page.setViewportSize({ width, height: 874 });
        await s.page.goto(
          (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
          { waitUntil: "networkidle" }
        );
        await s.page
          .getByLabel("Message", { exact: true })
          .fill("Latest sent message should be visible");
        await s.page
          .getByRole("button", { name: "Send message", exact: true })
          .click();
        await s.page
          .locator(".v3-message-text")
          .filter({ hasText: "Latest sent message should be visible" })
          .waitFor();
        await s.page.waitForTimeout(400);
        const rect = await s.page
          .locator(".v3-message-text")
          .filter({ hasText: "Latest sent message should be visible" })
          .boundingBox();
        const geometry = await gap(s.page);
        const ancestors = await s.page.locator(".v3-messages").evaluate(e => {
          const a = [];
          while (e && a.length < 9) {
            const st = getComputedStyle(e);
            a.push({
              class: e.className,
              height: e.clientHeight,
              scrollHeight: e.scrollHeight,
              overflow: st.overflowY,
              display: st.display,
            });
            e = e.parentElement;
          }
          return a;
        });
        await s.page.screenshot({
          path: out + "/long-thread-" + width + "-" + role + ".png",
        });
        await s.context.close();
        return {
          passed:
            geometry.height < 874 &&
            geometry.scrollHeight > geometry.height &&
            rect.y >= 0 &&
            rect.y + rect.height <= 874,
          rect,
          geometry,
          ancestors,
        };
      });
    }
  await run("slow-photo-at-bottom", async () => {
    const messages = rows();
    messages.push({
      id: 90,
      conversationId: 12,
      senderId: client.id,
      content: "http://127.0.0.1:5198/slow-photo.svg",
      messageType: "image",
      createdAt: "2026-09-16T00:00:00Z",
    });
    const s = await setup("artist", { "messages.list": () => messages });
    let release;
    const wait = new Promise(r => (release = r));
    let requested = false;
    await s.page.route("**/slow-photo.svg", async r => {
      requested = true;
      await wait;
      await r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="320"><rect width="280" height="320" fill="green"/></svg>',
      });
    });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
      { waitUntil: "domcontentloaded" }
    );
    await s.page.locator(".v3-message").first().waitFor();
    await s.page.waitForTimeout(800);
    const before = await gap(s.page);
    release();
    await s.page.waitForTimeout(800);
    const after = await gap(s.page);
    await s.page.screenshot({ path: out + "/slow-photo.png" });
    await s.context.close();
    return {
      passed:
        requested &&
        after.height < 874 &&
        after.scrollHeight > after.height &&
        after.gap < 5,
      before,
      after,
      requested,
    };
  });
  await run("slow-photo-at-bottom-tablet", async () => {
    const messages = rows();
    messages.push({
      id: 90,
      conversationId: 12,
      senderId: client.id,
      content: "http://127.0.0.1:5198/slow-photo.svg",
      messageType: "image",
      createdAt: "2026-09-16T00:00:00Z",
    });
    const s = await setup("artist", { "messages.list": () => messages });
    await s.page.setViewportSize({ width: 820, height: 874 });
    let release;
    const wait = new Promise(r => (release = r));
    let requested = false;
    await s.page.route("**/slow-photo.svg", async r => {
      requested = true;
      await wait;
      await r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="320"><rect width="280" height="320" fill="green"/></svg>',
      });
    });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
      { waitUntil: "domcontentloaded" }
    );
    await s.page.locator(".v3-message").first().waitFor();
    await s.page.waitForTimeout(800);
    const before = await gap(s.page);
    release();
    await s.page.waitForTimeout(800);
    const after = await gap(s.page);
    await s.page.screenshot({ path: out + "/slow-photo-tablet.png" });
    await s.context.close();
    return {
      passed:
        requested &&
        after.height < 874 &&
        after.scrollHeight > after.height &&
        after.gap < 5,
      before,
      after,
      requested,
    };
  });
  await run("cursor-history-keeps-anchor", async () => {
    const all = Array.from({ length: 205 }, (_, i) => ({
      id: i + 1,
      conversationId: 12,
      senderId: client.id,
      content: "History record " + (i + 1),
      messageType: "text",
      createdAt: "2026-09-16 00:00:00",
    }));
    let calls = 0;
    const s = await setup("artist", {
      "messages.list": input => {
        if (input?.before) {
          calls++;
          return all.filter(m => m.id < input.before.id).slice(-100);
        }
        return all.slice(-100);
      },
    });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
      { waitUntil: "networkidle" }
    );
    const scroll = s.page.locator(".v3-messages");
    await scroll.evaluate(e => (e.scrollTop = 0));
    await s.page.waitForTimeout(150);
    const first = s.page.locator('[data-message-id="106"]');
    const before = await first.boundingBox();
    await s.page
      .getByRole("button", { name: "Load older messages", exact: true })
      .click();
    await s.page
      .locator('[data-message-id="6"]')
      .waitFor({ state: "attached" });
    await s.page.waitForTimeout(100);
    const after = await first.boundingBox();
    assert.ok(
      Math.abs(after.y - before.y) < 3,
      "History prepend moved the visible message"
    );
    await scroll.evaluate(e => (e.scrollTop = 0));
    await s.page
      .getByRole("button", { name: "Load older messages", exact: true })
      .click();
    await s.page
      .locator('[data-message-id="1"]')
      .waitFor({ state: "attached" });
    assert.equal(await s.page.locator("[data-message-id]").count(), 205);
    assert.equal(
      await s.page
        .getByRole("button", { name: "Load older messages", exact: true })
        .count(),
      0
    );
    await s.context.close();
    return {
      passed: true,
      pages: calls,
      messages: 205,
      anchorDelta: after.y - before.y,
    };
  });
  await run("private-telemetry-and-build-id", async () => {
    const s = await setup("public");
    let payload;
    await s.page.route("**/api/trpc/errorLog.log", async r => {
      payload = r.request().postDataJSON();
      await r.fulfill({
        json: { result: { data: { json: { success: true } } } },
      });
    });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/login",
      { waitUntil: "networkidle" }
    );
    await s.page.evaluate(() => {
      history.replaceState(
        null,
        "",
        "/pay/FAKE-PRIVATE-TOKEN?secret=FAKE-PRIVATE-QUERY"
      );
      window.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("FAKE-PRIVATE-ERROR"),
          message: "FAKE-PRIVATE-ERROR",
        })
      );
    });
    await s.page.waitForTimeout(200);
    assert.ok(payload, "Error telemetry was not emitted");
    assert.ok(!JSON.stringify(payload).includes("FAKE-PRIVATE"));
    assert.match(payload.json.appVersion, /^\d+\.\d+\.\d+\+[a-f0-9]{12}$/);
    await s.context.close();
    return { passed: true, version: payload.json.appVersion };
  });
  await run("reader-anchor-during-incoming-poll", async () => {
    let messages = rows();
    const s = await setup("artist", { "messages.list": () => messages });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
      { waitUntil: "networkidle" }
    );
    await s.page.locator(".v3-messages").evaluate(e => (e.scrollTop -= 700));
    await s.page.waitForTimeout(200);
    const before = await gap(s.page);
    messages = [
      ...messages,
      {
        id: 99,
        conversationId: 12,
        senderId: client.id,
        content: "New incoming message",
        messageType: "text",
        createdAt: new Date().toISOString(),
      },
    ];
    await s.page.waitForTimeout(3400);
    const after = await gap(s.page);
    await s.context.close();
    return {
      passed:
        before.top > 0 &&
        after.height < 874 &&
        Math.abs(after.top - before.top) < 2,
      before,
      after,
    };
  });
  await run("composer-after-viewport-shrink", async () => {
    const s = await setup("artist", { "messages.list": rows() });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
      { waitUntil: "networkidle" }
    );
    await s.page.setViewportSize({ width: 390, height: 450 });
    await s.page
      .getByLabel("Message", { exact: true })
      .fill("Message with reduced viewport");
    await s.page.waitForTimeout(200);
    const rect = await s.page
      .getByRole("button", { name: "Send message", exact: true })
      .boundingBox();
    const geometry = await gap(s.page);
    await s.page.screenshot({ path: out + "/short-viewport.png" });
    await s.context.close();
    return {
      passed:
        geometry.height < 450 && rect.y >= 0 && rect.y + rect.height <= 450,
      rect,
      geometry,
      note: "Layout resize only; not a physical keyboard test",
    };
  });
  await run("long-composer-keeps-messages-visible", async () => {
    const s = await setup("artist", { "messages.list": rows() });
    await s.page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5198") + "/chat/12",
      { waitUntil: "networkidle" }
    );
    await s.page
      .getByLabel("Message", { exact: true })
      .fill(Array.from({ length: 30 }, (_, i) => "Draft line " + i).join("\n"));
    const textarea = await s.page
      .getByLabel("Message", { exact: true })
      .evaluate(e => ({
        height: e.clientHeight,
        scrollHeight: e.scrollHeight,
        overflow: getComputedStyle(e).overflowY,
      }));
    const geometry = await gap(s.page);
    await s.context.close();
    return {
      passed:
        geometry.height > 100 && geometry.height < 874 && textarea.height < 400,
      textarea,
      geometry,
    };
  });
} finally {
  await browser.close();
  await writeFile(out + "/results.json", JSON.stringify(results, null, 2));
  if (results.some(r => r.passed !== true)) process.exitCode = 1;
}
