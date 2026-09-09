// @vitest-environment node
import { vi, it, expect, beforeEach } from "vitest";
const fixture = vi.hoisted(() => ({
  merchant: {
    id: 1,
    userId: "merchant",
    businessName: "Test Store",
    country: "AU",
    shopifyToken: "private-shopify-token",
    xeroAccessToken: "private-xero-token",
    xeroRefreshToken: "private-refresh-token",
    myobAccessToken: "private-myob-token",
    shippitApiKey: "private-shipping-key",
    lowStockThreshold: 5,
  },
  orders: [
    { status: "pending", totalAmountCents: 10000 },
    { status: "paid", totalAmountCents: 2000 },
    { status: "fulfilled", totalAmountCents: 3000 },
  ],
  products: [
    { isActive: 1, inventoryCount: 2, variants: [] },
    { isActive: 0, inventoryCount: 0, variants: [] },
  ],
}));
vi.mock("../db", () => ({
  getDb: async () => ({
    query: {
      merchants: { findFirst: async () => fixture.merchant },
      orders: { findMany: async () => fixture.orders },
      products: { findMany: async () => fixture.products },
    },
  }),
  getUserByEmail: vi.fn(),
}));
import { merchantAuthRouter } from "./merchantAuth";
const caller = merchantAuthRouter.createCaller({
  user: { id: "merchant", role: "merchant" },
  req: {},
  res: {},
} as any);
it("returns a safe business profile without provider credentials", async () => {
  const profile = await caller.getMerchantProfile();
  const json = JSON.stringify(profile);
  expect(json).not.toContain("private-");
  expect(profile).toMatchObject({
    businessName: "Test Store",
    shopifyConnected: true,
  });
});
it("counts paid orders needing fulfilment rather than abandoned checkouts", async () => {
  expect(await caller.getDashboardStats()).toMatchObject({
    revenueCents: 5000,
    pendingOrders: 1,
    totalOrders: 2,
    lowStockItems: 1,
  });
});
