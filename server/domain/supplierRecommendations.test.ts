import { describe, it, expect } from "vitest";
import { supplierRecommendations } from "./supplierRecommendations";
const order = (id: number, date: string, status = "paid", supplierId = 1) => ({
  id,
  supplierId,
  status,
  createdAt: date,
  supplier: { name: "Studio Supply" },
  items: [
    {
      supplierProductId: 1,
      variantId: 1,
      productTitle: "Cartridges",
      variantTitle: "Liner",
      quantity: 3,
    },
  ],
});
describe("supplier reorder cadence", () => {
  it("requires repeat paid purchases, not a guessed fixed interval", () => {
    expect(
      supplierRecommendations([order(1, "2026-01-01")], new Date("2026-05-01"))
    ).toEqual([]);
  });
  it("learns median intervals and preserves the last ordered quantities", () => {
    const history = [
      order(1, "2026-01-01"),
      order(2, "2026-01-15"),
      order(3, "2026-01-29"),
      order(4, "2026-02-01", "failed"),
    ];
    const [r] = supplierRecommendations(history, new Date("2026-02-13"));
    expect(r).toMatchObject({
      intervalDays: 14,
      orderId: 3,
      due: true,
      sampleOrders: 3,
    });
    expect(r.items[0].quantity).toBe(3);
    expect(
      supplierRecommendations(history, new Date("2026-02-01"))[0].due
    ).toBe(false);
  });
  it("suppresses suggestions while a newer order awaits payment", () => {
    expect(
      supplierRecommendations(
        [
          order(1, "2026-01-01"),
          order(2, "2026-01-15"),
          order(3, "2026-02-28", "pending"),
        ],
        new Date("2026-03-01")
      )
    ).toEqual([]);
  });
  it("does not suppress reminders forever after an abandoned checkout", () => {
    expect(supplierRecommendations([order(1,"2026-01-01"),order(2,"2026-01-15"),order(3,"2026-01-30","pending")],new Date("2026-03-01"))[0].due).toBe(true);
  });
  it("ignores same-day repeat checkouts and keeps suppliers separate", () => {
    const result = supplierRecommendations(
      [
        order(1, "2026-01-01"),
        order(2, "2026-01-15"),
        order(3, "2026-01-15T12:00:00Z"),
        order(4, "2026-01-01", "paid", 2),
      ],
      new Date("2026-03-01")
    );
    expect(result).toHaveLength(1);
    expect(result[0].intervalDays).toBe(15);
  });
});
