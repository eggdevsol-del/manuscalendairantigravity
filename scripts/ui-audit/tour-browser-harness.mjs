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
const out = process.env.AUDIT_OUTPUT || "output/tattoi-complete-tours";
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


async function inspectGuide(page) {
 const island=page.locator('.tooltip-tour-bubble');
 await island.waitFor();
 const steps=[];
 for(let i=0;i<180;i++) {
   await page.waitForTimeout(210);
   const title=await island.locator('.tooltip-tour-title').innerText();
   const id=await island.getAttribute('data-tour-target');
   assert.notEqual(title,'Control','Each control needs an accessible name');
   const target=page.locator('[data-tour-current-target]');
   assert.equal(await target.count(),1,'Exactly one live target');
   const rect=await target.boundingBox();
   const box=await island.boundingBox();
   const viewport=page.viewportSize();
   assert.ok(rect && rect.width>0 && rect.height>0,'Target has a rendered box');
   assert.ok(box.x>=-1 && box.y>=-1 && box.x+box.width<=viewport.width+1 && box.y+box.height<=viewport.height+1,'Island fits viewport');
   const body=await island.locator('.tooltip-tour-body').first().innerText();
   steps.push({title,body,target:id});
   const done=island.getByRole('button',{name:'Done',exact:true});
   if(await done.count()) {await done.click();await island.waitFor({state:'hidden'});return steps;}
   const next=island.getByRole('button',{name:'Next',exact:true});
   assert.ok(await next.isEnabled(),'Next must resolve its actual target');
   await next.click();
 }
 throw Error('Tour did not finish in 180 steps');
}

export {browser,setup,inspectGuide,out};
