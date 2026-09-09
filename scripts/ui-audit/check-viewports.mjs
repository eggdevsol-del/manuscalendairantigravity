import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const out = process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-ui-audit";
await mkdir(out, { recursive: true });
const cases = [
  ["iphone-portrait", 440, 956, 62, 34, 0],
  ["iphone-landscape", 956, 440, 0, 21, 62],
  ["ipad-portrait", 820, 1180, 24, 20, 0],
  ["ipad-landscape", 1180, 820, 24, 20, 0],
  ["ipad-large", 1024, 1366, 24, 20, 0],
  ["split-view", 375, 1024, 24, 20, 0],
];
const results = [];
for (const [device, width, height, top, bottom, side] of cases) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await context.route("**/*", route =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort()
  );
  await context.route("**/api/trpc/**", async route => {
    const names = new URL(route.request().url()).pathname
      .split("/")
      .pop()
      .split(",");
    await route.fulfill({
      json: names.map(name => ({
        result: {
          data: {
            json:
              name === "auth.me"
                ? {
                    id: "ui-audit",
                    role: "artist",
                    name: "A very long studio and artist business name",
                  }
                : { token: "test" },
          },
        },
      })),
    });
  });
  for (const theme of ["light", "dark"])
    for (const kind of (process.env.AUDIT_KINDS?.split(",") || [
      "page",
      "document",
      "full",
      "half",
      "sheet",
      "side",
      "modal",
      "action",
      "bottom",
    ])) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(
        `${process.env.AUDIT_URL || "http://127.0.0.1:5174"}/ui-audit.html?kind=${kind}&theme=${theme}&debugUI=false`,
        { waitUntil: "domcontentloaded", timeout: 15000 }
      );
      await page.evaluate(
        ({ top, bottom, side }) => {
          for (const [k, v] of Object.entries({
            top,
            bottom,
            left: side,
            right: side,
          }))
            document.documentElement.style.setProperty(
              `--app-safe-${k}`,
              `${v}px`
            );
        },
        { top, bottom, side }
      );
      await page.locator("[data-audit-content]").waitFor({ timeout: 15000 });
      await page.waitForTimeout(300);
      const geometry = await page.evaluate(
        ({ top, bottom, side }) => {
          const visible = e => {
            const r = e.getBoundingClientRect();
            return r.width > 1 && r.height > 1;
          };
          const headers = [
            ...document.querySelectorAll(
              'h1,h2,[data-slot="sheet-title"],[data-slot="dialog-title"]'
            ),
          ]
            .filter(visible)
            .filter(e => !e.closest("[data-audit-content]"));
          const boxes = headers.map(e => {
            const r = e.getBoundingClientRect();
            return {
              text: e.textContent,
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
            };
          });
          const clipped = boxes.filter(
            r =>
              r.y < top - 1 || r.x < side - 1 || r.right > innerWidth - side + 1
          );
          const overflow =
            document.documentElement.scrollWidth > innerWidth + 1;
          const button = document.querySelector("[data-audit-last]");
          for (let e = button?.parentElement; e; e = e.parentElement)
            if (e.scrollHeight > e.clientHeight)
              e.scrollTo({ top: e.scrollHeight, behavior: "instant" });
          return { boxes, clipped, overflow };
        },
        { top, bottom, side }
      );
      await page.waitForTimeout(350);
      const last = await page.locator("[data-audit-last]").boundingBox();
      const reachable =
        !!last && last.y >= top && last.y + last.height <= height - bottom + 1;
      const result = {
        device,
        theme,
        kind,
        ...geometry,
        last,
        reachable,
        errors,
        pass:
          !geometry.clipped.length &&
          !geometry.overflow &&
          reachable &&
          !errors.length,
      };
      results.push(result);
      console.log(
        `${device} ${theme} ${kind}: ${result.pass ? "PASS" : "FAIL"}`
      );
      if (
        !result.pass ||
        (["iphone-portrait", "ipad-landscape"].includes(device) &&
          theme === "light")
      )
        await page.screenshot({
          path: `${out}/${device}-${theme}-${kind}.png`,
        });
      await page.close();
    }
  await context.close();
}
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    {
      cases: results.length,
      passed: results.filter(r => r.pass).length,
      failures: results.filter(r => !r.pass),
    },
    null,
    2
  )
);
process.exitCode = results.some(r => !r.pass) ? 1 : 0;
