// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ status: "pending", items: vi.fn() }));
vi.mock("../db", () => ({
  getDb: async () => ({
    query: {
      orders: {
        findFirst: async () => ({
          id: 1,
          status: mocks.status,
          totalAmountCents: 2000,
        }),
      },
      orderItems: { findMany: mocks.items },
    },
  }),
}));
import { storefrontRouter } from "../routers/storefront";
const caller = storefrontRouter.createCaller({
  user: null,
  req: {},
  res: {},
} as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "pending";
  mocks.items.mockResolvedValue([
    {
      seminar: {
        title: "Workshop",
        locationUrl: "https://example.invalid/private",
        type: "virtual",
      },
    },
  ]);
});
describe("event admission visibility", () => {
  it.each(["pending", "cancelled"])(
    "hides event access for %s orders",
    async status => {
      mocks.status = status;
      expect(
        (await caller.getOrderStatus({ orderId: 1, sessionId: "cs_order" }))
          .eventAccess
      ).toEqual([]);
      expect(mocks.items).not.toHaveBeenCalled();
    }
  );
  it.each(["paid", "fulfilled"])(
    "returns purchased access only for %s orders",
    async status => {
      mocks.status = status;
      expect(
        (await caller.getOrderStatus({ orderId: 1, sessionId: "cs_order" }))
          .eventAccess[0].locationUrl
      ).toBe("https://example.invalid/private");
    }
  );
});
