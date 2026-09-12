import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { response } from "./launch-fixtures.mjs";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 440, height: 956 },
  hasTouch: true,
  serviceWorkers: "block",
  timezoneId: "Australia/Brisbane",
});
await context.addInitScript(() => {
  localStorage.setItem("authToken", "test");
  sessionStorage.setItem("splashShown", "true");
});
let noteAttempts = 0,
  savedNote = "",
  planInput = null;
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
          if (name === "clientProfile.addClientNote") {
            noteAttempts++;
            if (noteAttempts === 1)
              return {
                error: {
                  json: {
                    message: "Simulated save failure",
                    code: -32603,
                    data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
                  },
                },
              };
            savedNote = "Leave room to extend the sleeve";
          }
          if (name === "sessionPlans.create")
            planInput = JSON.parse(route.request().postData());
          const data =
            name === "clientProfile.getClientNotes" && savedNote
              ? [{ id: 1, note: savedNote }]
              : response(name, "artist");
          return { result: { data: { json: data } } };
        }),
    });
  if (url.pathname === "/api/version")
    return route.fulfill({ json: { version: "3.0.1" } });
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const base = process.env.AUDIT_URL || "http://127.0.0.1:5190";
await page.clock.install({ time: new Date("2026-09-09T23:41:00Z") });
await page.goto(base + "/chat/12");
await page.getByText("Client records & private notes", { exact: true }).click();
await page
  .getByLabel("New note")
  .filter({ visible: true })
  .fill("Leave room to extend the sleeve");
await page
  .getByRole("button", { name: "Save note", exact: true })
  .filter({ visible: true })
  .click();
await page
  .getByText("Couldn’t save. Your draft is still here. Try again.", {
    exact: true,
  })
  .waitFor();
if (
  (await page.getByLabel("New note").filter({ visible: true }).inputValue()) !==
  "Leave room to extend the sleeve"
)
  throw Error("Failed save lost draft");
await page.setViewportSize({ width: 1180, height: 820 });
if (
  (await page.getByLabel("New note").filter({ visible: true }).inputValue()) !==
  "Leave room to extend the sleeve"
)
  throw Error("Layout change lost draft");
await page
  .getByRole("button", { name: "Save note", exact: true })
  .filter({ visible: true })
  .click();
await page.waitForFunction(
  () =>
    [...document.querySelectorAll("textarea")]
      .filter(el => el.offsetHeight > 0)
      .some(el => el.value === "") &&
    document.body.innerText.includes("Leave room to extend the sleeve")
);
await page.goto(base + "/calendar");
await page.getByRole("button", { name: "New booking", exact: true }).click();
await page
  .getByRole("button", { name: /Mia Chen/ })
  .last()
  .click();
await page
  .getByRole("button", { name: /Botanical sleeve/ })
  .last()
  .click();
await page
  .getByRole("button", { name: "Find available dates", exact: true })
  .click();
await page.getByRole("button", { name: "Send proposal", exact: true }).click();
await page.waitForURL("**/chat/12");
if (!planInput || !JSON.stringify(planInput).includes("2026-09-29"))
  throw Error("Session plan did not include all suggested dates");
if (errors.length) throw Error(errors.join(";"));
console.log(
  "PASS: failed note retains draft, iPad transition retains draft, retry saves, three-sitting proposal submitted"
);
await context.close();
await browser.close();
