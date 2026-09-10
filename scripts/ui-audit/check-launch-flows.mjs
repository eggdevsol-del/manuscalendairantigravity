import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-launch-ui";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const results = [];
for (const [device, width, height, top, bottom] of [
  ["iphone", 440, 956, 62, 34],
  ["ipad", 820, 1180, 24, 20],
]) {
  for (const [kind, role] of [
    ["launch-dashboard", "artist"],
    ["project", "artist"],
    ["project", "client"],
    ["launch-bookings", "client"],
    ["launch-dashboard", "merchant"],
    ["launch-products", "merchant"],
    ["launch-orders", "merchant"],
  ]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
      });
      await context.route("**/*", route =>
        new URL(route.request().url()).hostname === "127.0.0.1"
          ? route.continue()
          : route.abort()
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(
        `http://127.0.0.1:5174/ui-audit.html?kind=${kind}&role=${role}&theme=${theme}&debugUI=false`
      );
      await page.evaluate(
        ({ top, bottom }) => {
          document.documentElement.style.setProperty(
            "--app-safe-top",
            `${top}px`
          );
          document.documentElement.style.setProperty(
            "--app-safe-bottom",
            `${bottom}px`
          );
        },
        { top, bottom }
      );
      await page.locator("h1").first().waitFor();
      await page.waitForTimeout(600);
      if (kind === "project")
        await page
          .getByText("Design brief & references", { exact: true })
          .waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1
      );
      await page.screenshot({
        path: `${out}/${device}-${kind}-${role}-${theme}.png`,
      });
      await page
        .getByRole("button", { name: /Help with/ })
        .first()
        .click();
      await page
        .getByRole("heading", { name: "Workflow guides", exact: true })
        .waitFor();
      const firstGuide = page
        .getByRole("dialog")
        .getByRole("button")
        .filter({ hasText: "Read guide" })
        .first();
      await firstGuide.click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await page.screenshot({
        path: `${out}/${device}-${kind}-${role}-${theme}-guide.png`,
      });
      const bounds = await page.getByRole("dialog").evaluate(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width };
      });
      const innerOverflow = await page.getByRole("dialog").evaluate(el =>
        Array.from(el.querySelectorAll("*"))
          .filter(
            e =>
              e.clientWidth > 1 &&
              !e.classList.contains("sr-only") &&
              e.scrollWidth > e.clientWidth + 2
          )
          .map(e => e.tagName + ": " + e.className)
      );
      const result = {
        device,
        kind,
        role,
        theme,
        overflow,
        innerOverflow,
        errors,
        bounds,
        pass:
          innerOverflow.length === 0 &&
          !overflow &&
          !errors.length &&
          bounds.top >= top - 1 &&
          bounds.bottom <= height + 1 &&
          bounds.width <= width,
      };
      results.push(result);
      console.log(JSON.stringify(result));
      if (kind === "project" && role === "client") {
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await page
          .getByRole("button", { name: "Review & sign forms", exact: true })
          .click();
        await page
          .getByText("Sample form for layout testing only.", { exact: true })
          .waitFor();
        await page.waitForTimeout(650);
        await page.screenshot({ path: `${out}/${device}-forms-${theme}.png` });
      }
      await context.close();
    }
  }
}
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
if (results.some(r => !r.pass)) process.exitCode = 1;
