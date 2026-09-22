import { describe, it, expect } from "vitest";
import { shopifyImportSimulatorEnabled } from "./shopifyImportSimulator";
describe("Shopify import simulator gate", () => {
  it("is disabled by default in production", () =>
    expect(shopifyImportSimulatorEnabled({ NODE_ENV: "production" })).toBe(
      false
    ));
  it("works in development or an explicitly enabled test deployment", () => {
    expect(shopifyImportSimulatorEnabled({ NODE_ENV: "development" })).toBe(
      true
    );
    expect(
      shopifyImportSimulatorEnabled({
        NODE_ENV: "production",
        ENABLE_SHOPIFY_IMPORT_SIMULATOR: "true",
      })
    ).toBe(true);
  });
});
