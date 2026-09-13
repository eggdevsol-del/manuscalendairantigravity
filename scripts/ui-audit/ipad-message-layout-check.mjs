import { createRequire } from "node:module";
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
const out = process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-ipad-message-fix";
await mkdir(out, { recursive: true });
const long =
  "I would love to discuss a full sleeve with botanical details and several references, and I have some questions about the dates and the design. ".repeat(
    14
  );
for (const width of [820, 1180])
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 820 ? 1180 : 820 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    await context.addInitScript(theme => {
      localStorage.setItem("authToken", "test");
      localStorage.setItem("tattoi-theme-override", theme);
      sessionStorage.setItem("splashShown", "true");
    }, theme);
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
              if (
                name === "conversations.list" ||
                name.includes("getConversations")
              )
                value = Array.from({ length: 35 }, (_, i) => ({
                  ...response("conversations.list", "artist")[0],
                  id: 12 + i,
                  otherUser: {
                    id: "client-" + i,
                    name: i === 0 ? "Mia Chen" : "Client " + i,
                    role: "client",
                  },
                  lastMessage: { content: long, messageType: "text" },
                }));
              if (name === "messages.list")
                value = Array.from({ length: 100 }, (_, i) => ({
                  id: i + 1,
                  senderId: i % 2 ? "artist-test" : "client-test",
                  content: `Message ${i + 1}. ${long.slice(0, 180)}`,
                  messageType: "text",
                  createdAt: "2026-09-10T00:00:00Z",
                }));
              if (name === "dashboardTasks.getBusinessTasks")
                value = {
                  tasks: [
                    {
                      taskType: "unanswered_enquiry",
                      taskTier: "tier1",
                      title: "Mia · enquiry awaiting reply",
                      context:
                        "Review the reference images and suggest a next step",
                      priorityScore: 80,
                      priorityLevel: "high",
                      relatedEntityId: "12",
                      conversationId: 12,
                      deepLink: "/chat/12",
                    },
                  ],
                  summary: {},
                  counts: {},
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
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5190") + "/chat/12",
      { waitUntil: "domcontentloaded" }
    );
    await page.locator(".v3-message").first().waitFor();
    await page.waitForTimeout(500);
    const preview = await page
      .locator(".v3-inbox-list .v3-row-copy>span")
      .first()
      .evaluate(el => ({
        height: el.clientHeight,
        line: parseFloat(getComputedStyle(el).lineHeight),
        clamp: getComputedStyle(el).webkitLineClamp,
        full: el.scrollHeight,
      }));
    if (
      preview.height > preview.line * 2 + 2 ||
      preview.clamp !== "2" ||
      preview.full <= preview.height
    )
      throw Error("Long preview not clamped: " + JSON.stringify(preview));
    await page.locator(".v3-messages").evaluate(el => (el.scrollTop = 0));
    await page.waitForTimeout(100);
    const before = await page.locator(".v3-inbox-list").boundingBox();
    await page.locator(".v3-messages").hover();
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(350);
    const after = await page.locator(".v3-inbox-list").boundingBox();
    const state = await page.evaluate(() => ({
      outer: document.querySelector(".v3-scroll").scrollTop,
      list: document.querySelector(".v3-inbox-list").scrollTop,
      thread: document.querySelector(".v3-messages").scrollTop,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    if (
      Math.abs(before.y - after.y) > 1 ||
      state.outer !== 0 ||
      state.list !== 0 ||
      state.thread < 100 ||
      state.overflow
    )
      throw Error("Thread scroll moved list/page: " + JSON.stringify(state));
    await page.locator(".v3-inbox-list").hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(350);
    const independent = await page.evaluate(() => ({
      list: document.querySelector(".v3-inbox-list").scrollTop,
      thread: document.querySelector(".v3-messages").scrollTop,
    }));
    if (
      independent.list < 100 ||
      Math.abs(independent.thread - state.thread) > 1
    )
      throw Error("List scroll moved thread: " + JSON.stringify(independent));
    await page.screenshot({ path: `${out}/messages-${width}-${theme}.png` });
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5190") + "/dashboard",
      { waitUntil: "domcontentloaded" }
    );
    await page.locator(".v3-task-card").waitFor();
    if (
      !(await page
        .locator(".v3-task-card")
        .evaluate(el =>
          getComputedStyle(el).backgroundImage.includes("linear-gradient")
        ))
    )
      throw Error("Task gradient missing");
    await page.screenshot({ path: `${out}/tasks-${width}-${theme}.png` });
    if (errors.length) throw Error(errors.join(";"));
    console.log(
      `PASS ${width} ${theme}: two-line previews, independent scrolling, task gradient`
    );
    await context.close();
  }
await browser.close();
