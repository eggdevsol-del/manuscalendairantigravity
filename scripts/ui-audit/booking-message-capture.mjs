import { chromium } from "playwright";
import { response } from "./ivory-fixtures.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const out = "output/tattoi-booking-message-cards";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const results = [];
for (const width of [390, 320])
  for (const state of ["pending", "confirmed", "rescheduled", "legacy"]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      serviceWorkers: "block",
      timezoneId: "Australia/Brisbane",
    });
    await context.addInitScript(() => {
      localStorage.setItem("authToken", "test");
      localStorage.setItem("tattoi-theme-override", "light");
      sessionStorage.setItem("splashShown", "true");
    });
    await context.route("**/*", r => {
      const u = new URL(r.request().url());
      if (u.hostname !== "127.0.0.1") return r.abort();
      if (!u.pathname.startsWith("/api/trpc/")) return r.continue();
      return r.fulfill({
        json: u.pathname
          .split("/")
          .at(-1)
          .split(",")
          .map(name => {
            let data = response(name, "client");
            if (name === "messages.list")
              data = [
                {
                  id: 902,
                  conversationId: 12,
                  senderId: "artist-test",
                  messageType: state === "legacy" ? "system" : "session_plan",
                  content: "Booking",
                  createdAt: "2026-09-09T00:00:00Z",
                  metadata: JSON.stringify(
                    state === "legacy"
                      ? {
                          type: "project_proposal",
                          appointmentIds: [101],
                          status: "accepted",
                          serviceName: "Botanical sleeve",
                        }
                      : { type: "session_plan", sessionPlanId: 11 }
                  ),
                },
              ];
            if (name === "sessionPlans.getById")
              data = {
                ...data,
                id: 11,
                clientId: "client-test",
                projectName: "Botanical sleeve",
                status: state === "pending" ? "pending" : "accepted",
                requiresDeposit: state === "pending",
                depositRecorded: state !== "pending",
                items: [
                  {
                    id: 1,
                    appointmentId: state === "pending" ? null : 101,
                    sessionIndex: 1,
                    startsAt: "2026-09-10T00:00:00Z",
                    durationMinutes: 180,
                    estimateCents: 60000,
                    depositCents: 15000,
                  },
                ],
              };
            if (name === "projects.summary")
              data = {
                ...data,
                sessions:
                  state === "pending"
                    ? []
                    : data.sessions.map(s => ({
                        ...s,
                        sessionPlanId: 11,
                        status: "confirmed",
                        projectName: "Botanical sleeve",
                        rescheduled: state === "rescheduled",
                      })),
              };
            return { result: { data: { json: data } } };
          }),
      });
    });
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", e => errors.push(e.message));
    await p.goto("http://127.0.0.1:5220/chat/12", { waitUntil: "networkidle" });
    const card = p.locator(".v3-booking-message");
    await card.waitFor();
    if (await card.locator("[aria-expanded]").count())
      errors.push("Expandable sitting in card");
    if (await p.getByRole("dialog").count()) errors.push("Unexpected dialog");
    const text = await card.innerText();
    if (!text.includes("estimate") && !text.includes("Estimate"))
      errors.push("Missing estimate");
    if (/NaN|undefined/.test(text)) errors.push("Invalid displayed data");
    if (state === "rescheduled" && !text.includes("Rescheduled"))
      errors.push("Missing rescheduled state");
    if (
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    )
      errors.push("Horizontal overflow");
    await card.screenshot({ path: `${out}/${state}-${width}.png` });
    results.push({ state, width, errors });
    await context.close();
  }
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(r => r.errors.length)) process.exitCode = 1;
