import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { response } from "./ivory-fixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const base = process.env.AUDIT_URL || "http://127.0.0.1:5196";
const output =
  process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-cohesion-interactions";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const reports = [];
const errorResult = message => ({
  error: {
    json: {
      message,
      code: -32603,
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    },
  },
});

try {
  for (const role of ["artist", "merchant"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      serviceWorkers: "block",
      timezoneId: "Australia/Brisbane",
    });
    await context.addInitScript(() => {
      localStorage.setItem("authToken", "isolated-audit");
      localStorage.setItem("theme", "light");
      localStorage.setItem("ui_debug_enabled", "false");
      sessionStorage.setItem("splashShown", "true");
    });
    const requests = [],
      mutations = [],
      errors = [];
    const products = [
      {
        id: 1,
        title: "Botanical print",
        description: "Fine art print",
        priceCents: 3200,
        inventoryCount: 24,
        shippingCents: 500,
        isActive: 0,
        fulfillmentType: "delivery",
        imageUrl: "https://example.test/art.png",
        variants: [
          { id: 11, name: "A4", inventoryCount: 24, priceCents: 3200 },
        ],
      },
    ];
    const orders = response("storefront.getOrders", role).map(o => ({
      ...o,
      currency: "AUD",
      fulfillmentMethod: "delivery",
      items: o.items.map((i, n) => ({ ...i, id: n + 1 })),
    }));
    let createAttempts = 0,
      updateAttempts = 0,
      fulfilAttempts = 0;
    let recipientMode = false;
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") return route.abort();
      if (url.pathname.startsWith("/api/trpc/")) {
        const names = url.pathname.split("/").at(-1).split(",");
        const inputs = JSON.parse(
          route.request().postData() || url.searchParams.get("input") || "{}"
        );
        const results = names.map((name, index) => {
          requests.push(name);
          const input = inputs[index]?.json || inputs.json || {};
          let data;
          if (name === "storefront.getProducts") data = products;
          else if (name === "storefront.getOrders") data = orders;
          else if (name === "storefront.createProduct") {
            createAttempts++;
            mutations.push({ name, input });
            if (createAttempts === 1)
              return errorResult("Simulated product save failure");
            products.push({
              ...input,
              id: 2,
              variants: [],
              isActive: input.isActive ? 1 : 0,
            });
            data = { success: true, id: 2 };
          } else if (name === "storefront.updateProduct") {
            updateAttempts++;
            mutations.push({ name, input });
            if (updateAttempts === 1)
              return errorResult("Simulated edit failure");
            Object.assign(products[0], input, {
              isActive: input.isActive ? 1 : 0,
              variants: input.variants.map(v => ({ ...v, name: "A4" })),
            });
            data = { success: true };
          } else if (name === "storefront.updateOrderStatus") {
            fulfilAttempts++;
            mutations.push({ name, input });
            if (fulfilAttempts === 1)
              return errorResult("Simulated fulfilment failure");
            orders.find(o => o.id === input.orderId).status = input.status;
            data = { success: true };
          } else data = response(name, role);
          if (recipientMode && name === "conversations.getById") {
            data = {
              ...data,
              artistId: "other-provider",
              clientId: response("auth.me", role).id,
              otherUser: {
                id: "other-provider",
                name: "Guest artist",
                role: "artist",
              },
            };
          }
          if (recipientMode && name === "projects.summary") {
            data = {
              ...data,
              artist: { id: "other-provider", name: "Guest artist" },
              client: response("auth.me", role),
            };
          }
          return { result: { data: { json: data } } };
        });
        return route.fulfill({ json: results });
      }
      if (url.pathname === "/api/version")
        return route.fulfill({ json: { version: "3.2.3" } });
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.install({ time: new Date("2026-09-09T23:41:00Z") });
    const click = name =>
      page
        .getByRole("button", { name, exact: true })
        .filter({ visible: true })
        .click();
    await page.goto(
      base + (role === "artist" ? "/products" : "/merchant/products")
    );
    await click("Add product");
    await page.screenshot({ path: join(output, `${role}-product-add.png`) });
    await click("Save product");
    assert.equal(createAttempts, 0, "Empty form submitted a mutation");
    await page
      .getByLabel("Product name", { exact: true })
      .fill("Botanical postcard");
    await page.getByLabel("Price · AUD", { exact: true }).fill("12.50");
    await page.getByLabel("Available quantity", { exact: true }).fill("8");
    await page.getByLabel("Delivery charge · AUD", { exact: true }).fill("2");
    await click("Save product");
    await page
      .getByRole("alert")
      .filter({ hasText: "Simulated product save failure" })
      .waitFor();
    assert.equal(
      await page.getByLabel("Product name", { exact: true }).inputValue(),
      "Botanical postcard"
    );
    await page.screenshot({
      path: join(output, `${role}-product-save-retry.png`),
    });
    await click("Save product");
    await page.getByText("Product saved.", { exact: true }).waitFor();
    assert.equal(products[1].priceCents, 1250);
    assert.equal(products[1].shippingCents, 200);
    assert.equal(products[1].inventoryCount, 8);
    await click("Edit Botanical print");
    await page.getByLabel("Image URL (optional)", { exact: true }).fill("");
    assert.equal(
      await page.getByLabel("Publish product", { exact: true }).isChecked(),
      false
    );
    await page.getByLabel("A4 Price · AUD", { exact: true }).fill("39.50");
    await page.getByLabel("A4 Available quantity", { exact: true }).fill("12");
    await page.getByLabel("Publish product", { exact: true }).check();
    await page.screenshot({ path: join(output, `${role}-product-edit.png`) });
    await click("Save product");
    await page
      .getByRole("alert")
      .filter({ hasText: "Simulated edit failure" })
      .waitFor();
    assert.equal(
      await page.getByLabel("A4 Price · AUD", { exact: true }).inputValue(),
      "39.50"
    );
    assert.equal(
      await page.getByLabel("Publish product", { exact: true }).isChecked(),
      true
    );
    await click("Save product");
    await page.getByText("Product saved.", { exact: true }).waitFor();
    assert.equal(products[0].variants[0].priceCents, 3950);
    assert.equal(products[0].variants[0].inventoryCount, 12);
    assert.equal(products[0].isActive, 1);
    assert.equal(
      products[0].imageUrl,
      null,
      "Clearing an existing product image was not persisted"
    );
    if (role === "artist")
      assert.equal(
        requests.includes("merchantAuth.getMerchantProfile"),
        false,
        "Artist Products called a merchant-only endpoint"
      );
    await page.goto(
      base + (role === "artist" ? "/store-orders" : "/merchant/orders")
    );
    await page.getByRole("button", { name: /Order #1/ }).click();
    await click("Mark fulfilled");
    await page
      .getByRole("alert")
      .filter({ hasText: "Simulated fulfilment failure" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Order #1", exact: true })
      .waitFor();
    await click("Mark fulfilled");
    await page.getByText("Order marked fulfilled.", { exact: true }).waitFor();
    assert.equal(orders[0].status, "fulfilled");
    assert.equal(
      await page
        .getByRole("button", { name: "Mark fulfilled", exact: true })
        .count(),
      0
    );
    await page.screenshot({
      path: join(output, `${role}-order-fulfilled.png`),
    });
    if (role === "artist") {
      await page.goto(base + "/chat/12");
      await page.getByRole("button", { name: "Book", exact: true }).waitFor();
      recipientMode = true;
      await page.goto(base + "/chat/12?recipient=true");
      await page
        .getByRole("heading", { name: "Guest artist", exact: true })
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Book", exact: true }).count(),
        0
      );
      assert.equal(
        await page
          .getByText("Client records & private notes", { exact: true })
          .count(),
        0
      );
      await page
        .getByRole("link", { name: "Open booking", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Request a date change", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Reschedule", exact: true })
          .count(),
        0
      );
      await page.screenshot({
        path: join(output, "artist-as-client-booking.png"),
      });
    }
    const text = await page.locator("body").innerText();
    assert.ok(
      !text.includes("Something went wrong"),
      "Rendered error boundary"
    );
    assert.deepEqual(errors, []);
    reports.push({
      role,
      passed: true,
      assertions: [
        "Required fields block empty submission",
        "Create persists price, stock and shipping",
        "Create/edit failure retains entered data for retry",
        "Variant price, quantity and publishing are editable; image removal persists",
        "Artist makes no merchant-only profile request",
        "Paid order fulfilment survives failed-save retry",
        ...(role === "artist"
          ? [
              "Artist-as-client sees client booking actions; provider-only Book and private records are hidden",
            ]
          : []),
      ],
      mutations,
    });
    console.log(
      `PASS ${role}: product create/edit/variants/publish, validation, failed-save retry, order fulfilment`
    );
    await context.close();
  }
  await writeFile(
    join(output, "cohesion-interaction-report.json"),
    JSON.stringify(reports, null, 2)
  );
} finally {
  await browser.close();
}
