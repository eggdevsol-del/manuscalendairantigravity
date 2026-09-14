// Real Home interactions with isolated fixtures; no request reaches a live backend.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { response as base } from "./ivory-fixtures.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = "output/tattoi-ui-audit";
await mkdir(`${out}/screens`, { recursive: true });
const artist = {
  id: "artist-test",
  name: "Ella Morgan",
  displayName: "Ella Morgan",
  keywords: "Fine Line",
  lat: "-27.47",
  lng: "153.026",
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AUDIT_BROWSER,
});
const selectedCases = process.env.ARTIST_CASES?.split(",");
const results = selectedCases
  ? JSON.parse(
      await readFile(`${out}/artist-card-results.json`, "utf8")
    ).filter(result => !selectedCases.includes(result.scenario))
  : [];
const keywordContrast = page =>
  page
    .locator("span")
    .filter({ hasText: /^Fine Line$/ })
    .last()
    .evaluate(el => {
      const luminance = colour => {
        const channels = (colour.match(/[\d.]+/g) || [])
          .slice(0, 3)
          .map(Number)
          .map(channel => channel / 255)
          .map(channel =>
            channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const foreground = luminance(getComputedStyle(el).color);
      const background = luminance(getComputedStyle(el).backgroundColor);
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });
try {
  for (const scenario of [
    "existing-chat",
    "favourite-retry",
    "favourite-portfolio-message",
    "nearby-map-retry",
    "discovery-card-retry",
  ]) {
    if (selectedCases && !selectedCases.includes(scenario)) continue;
    const favourite = scenario.startsWith("favourite-");
    const mapPopup = scenario === "nearby-map-retry";
    const discoveryCard = scenario === "discovery-card-retry";
    const requests = [];
    let releaseCreate;
    const createGate = new Promise(resolve => {
      releaseCreate = resolve;
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 874 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      serviceWorkers: "block",
      timezoneId: "Australia/Brisbane",
    });
    await context.addInitScript(() => {
      localStorage.setItem("tattoi-theme-override", "light");
      localStorage.setItem("authToken", "test");
      sessionStorage.setItem("splashShown", "true");
      localStorage.setItem("ui_debug_enabled", "false");
    });
    await context.route("**/*", async route => {
      const u = new URL(route.request().url());
      if (u.hostname !== "127.0.0.1") return route.abort();
      if (u.pathname === "/__ivory_artwork.png")
        return route.fulfill({
          path: "output/tattoi-ivory-complete/assets/botanical.png",
          contentType: "image/png",
        });
      if (u.pathname.startsWith("/api/trpc/")) {
        const names = u.pathname.split("/").at(-1).split(",");
        const values = [];
        for (const [index, name] of names.entries()) {
          let value;
          if (name === "conversations.getOrCreate") {
            const data = route.request().postDataJSON();
            requests.push(data[index]?.json ?? data.json);
            if (requests.length === 1) await createGate;
            if (
              (scenario === "favourite-retry" || mapPopup || discoveryCard) &&
              requests.length === 1
            ) {
              values.push({
                error: {
                  json: {
                    message: "Fixture service unavailable",
                    code: -32603,
                    data: {
                      code: "INTERNAL_SERVER_ERROR",
                      httpStatus: 500,
                      path: name,
                    },
                  },
                },
              });
              continue;
            }
            value = { id: 12 };
          } else if (name === "conversations.list")
            value =
              favourite || mapPopup || discoveryCard
                ? []
                : [{ id: 12, otherUser: artist, unreadCount: 0 }];
          else if (name === "auth.listArtists") value = [artist];
          else if (name === "favourites.list")
            value = favourite ? [artist.id] : [];
          else value = base(name, "client");
          values.push({ result: { data: { json: value } } });
        }
        return route.fulfill({ json: values });
      }
      if (u.pathname === "/api/version")
        return route.fulfill({ json: { version: "3.2.3" } });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(8000);
    const checks = [];
    const check = (name, condition) => {
      assert.ok(condition, name);
      checks.push(name);
    };
    await page.goto(
      (process.env.AUDIT_URL || "http://127.0.0.1:5196") + "/discover",
      { waitUntil: "networkidle" }
    );
    await page.addStyleTag({
      content:
        ":root{--app-safe-top:54px!important;--app-safe-bottom:34px!important}",
    });
    await page
      .getByRole("button", { name: "Your artists and bookings", exact: true })
      .click();
    if (mapPopup) {
      await page.getByRole("button", { name: /See Artist Map/ }).click();
      await page.getByTitle("Ella Morgan", { exact: true }).click();
      await page.getByRole("button", { name: "Message", exact: true }).click();
      const opening = page.getByRole("button", {
        name: "Opening chat…",
        exact: true,
      });
      await opening.waitFor();
      check(
        "nearby Message is disabled while creating",
        await opening.isDisabled()
      );
      check(
        "nearby pending request stays on map",
        new URL(page.url()).pathname === "/discover"
      );
      releaseCreate();
      await page
        .getByRole("alert")
        .filter({ hasText: "Chat couldn't open. Please try again." })
        .waitFor();
      check(
        "nearby failure keeps the popup visible",
        await page
          .getByRole("button", { name: "Retry chat", exact: true })
          .isVisible()
      );
      check(
        "nearby failure does not navigate",
        new URL(page.url()).pathname === "/discover"
      );
      const chipContrast = await keywordContrast(page);
      check(
        `Fine Line chip contrast is at least 4.5:1 (measured ${chipContrast.toFixed(2)}:1)`,
        chipContrast >= 4.5
      );
      await page.screenshot({ path: `${out}/screens/map-chat-retry-390.png` });
      await page
        .getByRole("button", { name: "Retry chat", exact: true })
        .click();
      await page.waitForURL("**/chat/12");
      check(
        "nearby retry opens returned conversation",
        new URL(page.url()).pathname === "/chat/12"
      );
      check(
        "nearby retry makes exactly one additional request",
        requests.length === 2
      );
      check(
        "nearby success dismisses popup",
        (await page
          .getByRole("button", { name: "Retry chat", exact: true })
          .count()) === 0
      );
    } else {
      const portfolio = page
        .getByRole("button", {
          name: "View Ella Morgan's portfolio",
          exact: true,
        })
        .first();
      const chat = page
        .getByRole("button", {
          name: "Chat with Ella Morgan",
          exact: true,
        })
        .first();
      await portfolio.waitFor();
      if (discoveryCard) {
        const consultation = page.getByRole("button", {
          name: "Request consultation with Ella Morgan",
          exact: true,
        });
        await consultation.click();
        const hideConsultation = page.getByRole("button", {
          name: "Hide consultation with Ella Morgan",
          exact: true,
        });
        check(
          "nearby consultation opens independently",
          (await hideConsultation.getAttribute("aria-expanded")) === "true"
        );
        check(
          "consultation does not open portfolio",
          (await portfolio.getAttribute("aria-expanded")) === "false"
        );
        await hideConsultation.click();
        await page
          .getByText("1 · Style & Placement", { exact: true })
          .waitFor({ state: "hidden" });
        check(
          "nearby consultation toggles closed",
          (await consultation.getAttribute("aria-expanded")) === "false"
        );
        const chatBox = await chat.boundingBox();
        const consultationBox = await consultation.boundingBox();
        check(
          "nearby Chat and consultation keep 44px targets",
          chatBox.width >= 44 &&
            chatBox.height >= 44 &&
            consultationBox.width >= 44 &&
            consultationBox.height >= 44
        );
      }
      await portfolio.evaluate(el => {
        window.__portfolioToggleChanges = [];
        new MutationObserver(mutations => {
          for (const m of mutations)
            window.__portfolioToggleChanges.push(
              m.target.getAttribute("aria-expanded")
            );
        }).observe(el, {
          attributes: true,
          attributeFilter: ["aria-expanded"],
        });
      });
      if (scenario === "favourite-portfolio-message") {
        await portfolio.click();
        await page
          .getByRole("button", { name: "Message Ella Morgan", exact: true })
          .click();
        const messagePending = page.getByRole("button", {
          name: "Opening chat…",
          exact: true,
        });
        await messagePending.waitFor();
        check(
          "portfolio Message is disabled while creating",
          await messagePending.isDisabled()
        );
        check(
          "card Chat shares the pending guard",
          await page
            .getByRole("button", { name: "Opening chat", exact: true })
            .isDisabled()
        );
        check(
          "portfolio remains expanded while creating",
          (await page
            .getByRole("button", {
              name: "Hide Ella Morgan's portfolio",
              exact: true,
            })
            .getAttribute("aria-expanded")) === "true"
        );
        releaseCreate();
        await page.waitForURL("**/chat/12");
        check(
          "portfolio Message opens the returned conversation",
          new URL(page.url()).pathname === "/chat/12"
        );
        check("portfolio Message creates once", requests.length === 1);
      } else {
        await chat.click();
        if (favourite || discoveryCard) {
          const opening = page.getByRole("button", {
            name: "Opening chat",
            exact: true,
          });
          await opening.waitFor();
          check(
            "card Chat is disabled while creating",
            await opening.isDisabled()
          );
          check(
            "Chat does not expand portfolio",
            (await portfolio.getAttribute("aria-expanded")) === "false"
          );
          check(
            "pending request stays on Home",
            new URL(page.url()).pathname === "/discover"
          );
          releaseCreate();
          await page
            .getByRole("alert")
            .filter({ hasText: "Chat couldn't open. Please try again." })
            .waitFor();
          check(
            "failed creation stays on Home",
            new URL(page.url()).pathname === "/discover"
          );
          check(
            "failed creation exposes Retry chat",
            await page
              .getByRole("button", { name: "Retry chat", exact: true })
              .isVisible()
          );
          const retryContrast = await page
            .getByRole("button", { name: "Retry chat", exact: true })
            .evaluate(el => {
              const luminance = colour => {
                const channels = (colour.match(/[\d.]+/g) || [])
                  .slice(0, 3)
                  .map(Number)
                  .map(channel => channel / 255)
                  .map(channel =>
                    channel <= 0.04045
                      ? channel / 12.92
                      : ((channel + 0.055) / 1.055) ** 2.4
                  );
                return (
                  channels[0] * 0.2126 +
                  channels[1] * 0.7152 +
                  channels[2] * 0.0722
                );
              };
              const foreground = luminance(getComputedStyle(el).color);
              const background = luminance(
                getComputedStyle(el.parentElement).backgroundColor
              );
              return (
                (Math.max(foreground, background) + 0.05) /
                (Math.min(foreground, background) + 0.05)
              );
            });
          check(
            "Retry chat maintains readable text contrast",
            retryContrast >= 4.5
          );
          if (discoveryCard) {
            const chipContrast = await keywordContrast(page);
            check(
              `Fine Line chip contrast is at least 4.5:1 (measured ${chipContrast.toFixed(2)}:1)`,
              chipContrast >= 4.5
            );
          }
          await page.screenshot({
            path: `${out}/screens/${discoveryCard ? "discovery-card-chat-retry" : "favourite-chat-retry"}-390.png`,
          });
          await page
            .getByRole("button", { name: "Retry chat", exact: true })
            .click();
          await page.waitForURL("**/chat/12");
          check(
            "retry opens the returned conversation",
            new URL(page.url()).pathname === "/chat/12"
          );
          check(
            "retry makes exactly one additional request",
            requests.length === 2
          );
        } else {
          await page.waitForURL("**/chat/12");
          check(
            "existing Chat preserves the conversation destination",
            new URL(page.url()).pathname === "/chat/12"
          );
          check("existing Chat makes no create request", requests.length === 0);
        }
        check(
          "Chat never toggles portfolio",
          (await page.evaluate(() => window.__portfolioToggleChanges))
            .length === 0
        );
      }
    }
    if (favourite || mapPopup || discoveryCard)
      check(
        "creation uses the authenticated client and selected artist",
        requests.every(
          input =>
            input?.artistId === "artist-test" &&
            input?.clientId === "client-test"
        )
      );
    check(
      "no synthetic conversation route is used",
      !page.url().includes("fav-")
    );
    check("no unhandled browser errors", errors.length === 0);
    results.push({
      scenario,
      width: 390,
      checks: checks.length,
      assertions: checks,
      requests,
      errors,
      passed: true,
    });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    `${out}/artist-card-results.json`,
    JSON.stringify(results, null, 2) + "\n"
  );
}
console.log(JSON.stringify(results, null, 2));
