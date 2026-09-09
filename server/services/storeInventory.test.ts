// @vitest-environment node
import { beforeEach, describe, it, expect } from "vitest";
import {
  orders,
  products,
  productVariants,
  seminars,
} from "../../drizzle/schema";
import {
  changeOrderInventory,
  releaseExpiredStoreOrder,
} from "./storeInventory";
let order: any,
  variant: any,
  product: any,
  seminar: any,
  items: any[],
  writes: any[];
const db: any = {
  query: { orderItems: { findMany: async () => items } },
  select: () => ({
    from: (table: any) => ({
      where: () => ({
        for: async () => [
          table === orders
            ? order
            : table === productVariants
              ? variant
              : table === products
                ? product
                : seminar,
        ],
      }),
    }),
  }),
  update: (table: any) => ({
    set: (values: any) => ({
      where: async () => {
        writes.push({ table, values });
        Object.assign(
          table === orders
            ? order
            : table === productVariants
              ? variant
              : table === products
                ? product
                : seminar,
          values
        );
      },
    }),
  }),
};
beforeEach(() => {
  order = { id: 1, status: "pending", stripeCheckoutSessionId: "cs_test" };
  variant = { id: 3, productId: 2, inventoryCount: 5 };
  product = { id: 2, inventoryCount: 20 };
  seminar = { id: 4, capacity: 2, ticketsSold: 1 };
  items = [{ productId: 2, variantId: 3, quantity: 2 }];
  writes = [];
});
describe("store inventory reservation", () => {
  it("reserves the selected variant instead of changing base-product stock", async () => {
    await changeOrderInventory(db, 1, -1);
    expect(variant.inventoryCount).toBe(3);
    expect(product.inventoryCount).toBe(20);
  });
  it("rejects insufficient stock without making it negative", async () => {
    variant.inventoryCount = 1;
    await expect(changeOrderInventory(db, 1, -1)).rejects.toThrow(
      "out of stock"
    );
    expect(writes).toHaveLength(0);
  });
  it("releases an expired checkout exactly once", async () => {
    variant.inventoryCount = 3;
    await releaseExpiredStoreOrder(db, 1, "cs_test");
    await releaseExpiredStoreOrder(db, 1, "cs_test");
    expect(variant.inventoryCount).toBe(5);
    expect(order.status).toBe("cancelled");
  });
  it("does not release someone else’s checkout or a paid order", async () => {
    await releaseExpiredStoreOrder(db, 1, "cs_other");
    order.status = "paid";
    await releaseExpiredStoreOrder(db, 1, "cs_test");
    expect(writes).toHaveLength(0);
  });
  it("reserves and releases event seats and rejects sold-out events", async () => {
    items = [{ seminarId: 4, quantity: 1 }];
    await changeOrderInventory(db, 1, -1);
    expect(seminar.ticketsSold).toBe(2);
    await expect(changeOrderInventory(db, 1, -1)).rejects.toThrow("sold out");
    await changeOrderInventory(db, 1, 1);
    expect(seminar.ticketsSold).toBe(1);
  });
});
