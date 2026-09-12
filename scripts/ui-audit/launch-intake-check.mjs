import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-workspace-check";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const results = [];
import { artist, client, response, calls } from "./launch-fixtures.mjs";
const context = await browser.newContext({
  viewport: { width: 440, height: 956 },
  hasTouch: true,
  isMobile: true,
  serviceWorkers: "block",
});
let role = "public",
  submittedInput = null;
await context.addInitScript(() => {
  localStorage.setItem("tattoi-theme-override", "dark");
  sessionStorage.setItem("splashShown", "true");
});
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  if (url.pathname.startsWith("/api/trpc/")) {
    const names = url.pathname.split("/").at(-1).split(",");
    const data = names.map(name => {
      let value = response(name, role);
      if (name === "auth.me") value = null;
      if (name === "feed.getPublicArtistProfile")
        value = {
          id: artist.id,
          displayName: artist.name,
          slug: "ella-morgan",
          keywords: [],
          portfolio: [],
          bookingEnabled: true,
        };
      if (name === "funnel.submitPublicBooking") {
        submittedInput = JSON.parse(route.request().postData());
        value = { leadToken: "test-token", existingUser: false };
      }
      return { result: { data: { json: value } } };
    });
    return route.fulfill({ json: data });
  }
  if (url.pathname === "/api/version")
    return route.fulfill({ json: { version: "3.0.1" } });
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.goto(
  (process.env.AUDIT_URL || "http://127.0.0.1:5190") + "/book/ella-morgan"
);
await page
  .getByLabel("What would you like tattooed?")
  .fill("A botanical sleeve with peonies and room to extend later.");
await page.getByLabel("Fine Line", { exact: true }).check();
for (let step = 1; step <= 5; step++) {
  if (await page.getByLabel("Create password", { exact: true }).count())
    throw Error("Password requested before submission");
  if (step === 2) {
    await page.getByLabel("Placement", { exact: true }).fill("Outer forearm");
    await page
      .getByLabel("Preferred timeframe")
      .selectOption("Within 3 months");
  }
  if (step === 5) {
    await page.getByLabel("First name").fill("Mia");
    await page.getByLabel("Last name").fill("Chen");
    await page.getByLabel("Email", { exact: true }).fill("mia@example.test");
    await page.getByLabel("Phone", { exact: true }).fill("0400000000");
    await page.getByLabel("Date of birth").fill("1995-02-03");
    await page.getByLabel("Gender", { exact: true }).selectOption("female");
  }
  await page.screenshot({ path: `${out}/client-intake-step-${step}.png` });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
await page.getByText("Review your request", { exact: true }).waitFor();
await page.screenshot({ path: `${out}/client-intake-review.png` });
await page
  .getByRole("button", { name: "Send booking request", exact: true })
  .click();
await page.getByLabel("Create password", { exact: true }).waitFor();
if (!JSON.stringify(submittedInput).includes("Within 3 months"))
  throw Error("Timeframe lost in submission");
if (errors.length) throw Error(errors.join(";"));
await page.screenshot({ path: `${out}/client-intake-sent.png` });
console.log(
  "PASS: six-step client intake, timeframe preserved, password only after successful request"
);
await context.close();
await browser.close();
