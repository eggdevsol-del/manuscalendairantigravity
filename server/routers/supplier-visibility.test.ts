// @vitest-environment node
import { expect, it, vi } from "vitest";
const charge = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({
  getDb: async () => ({
    query: { suppliers: { findFirst: async () => ({ id: 1, isActive: 0 }) } },
  }),
}));
vi.mock("../services/stripe", () => ({
  createSupplierCheckoutSession: charge,
  getOrCreateStripeCustomer: charge,
}));
import { supplierOrdersRouter } from "./supplierOrders";
it("blocks new checkout for a removed supplier before pricing or Stripe access", async () => {
  const caller = supplierOrdersRouter.createCaller({
    user: { id: "artist", role: "artist" },
    req: {},
    res: {},
  } as any);
  await expect(
    caller.createSupplierCheckout({
      supplierId: 1,
      items: [{ productId: 1, variantId: 1, quantity: 1 }],
    })
  ).rejects.toThrow("no longer available");
  expect(charge).not.toHaveBeenCalled();
});
