// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  resolveSupplierShipping,
  validateSupplierItem,
} from "./supplierCheckout";
const variant = {
  inventoryCount: 3,
  priceCents: 1000,
  product: { id: 5, supplierId: 2 },
};
const zones = [
  {
    countryCodes: '["AU"]',
    rates: [
      { name: "Standard", priceCents: 1200, currency: "AUD" },
      {
        name: "Free over $100",
        priceCents: 0,
        minOrderSubtotalCents: 10000,
        currency: "AUD",
      },
    ],
  },
];
describe("supplier checkout integrity", () => {
  it("rejects a product from another supplier", () =>
    expect(() => validateSupplierItem(3, 5, 1, variant)).toThrow(
      "does not belong"
    ));
  it("rejects a mismatched product ID", () =>
    expect(() => validateSupplierItem(2, 6, 1, variant)).toThrow());
  it("rejects fractional and excessive quantities", () => {
    expect(() => validateSupplierItem(2, 5, 0.5, variant)).toThrow();
    expect(() => validateSupplierItem(2, 5, 4, variant)).toThrow();
  });
  it("charges the selected eligible shipping rate", () =>
    expect(resolveSupplierShipping(zones, "AU", "AUD", 3000, "Standard")).toBe(
      1200
    ));
  it("does not turn a missing or invalid selection into free shipping", () => {
    expect(() => resolveSupplierShipping(zones, "AU", "AUD", 3000)).toThrow();
    expect(() =>
      resolveSupplierShipping(zones, "AU", "AUD", 3000, "Unknown")
    ).toThrow();
  });
  it("enforces minimum order amounts and destination eligibility", () => {
    expect(() =>
      resolveSupplierShipping(zones, "AU", "AUD", 3000, "Free over $100")
    ).toThrow();
    expect(() =>
      resolveSupplierShipping(zones, "NZ", "AUD", 13000, "Standard")
    ).toThrow();
  });
  it("rejects mixing shipping currencies", () =>
    expect(() =>
      resolveSupplierShipping(zones, "AU", "NZD", 3000, "Standard")
    ).toThrow());
});
