import { describe, expect, it } from "vitest";
import { daysUntil, healingDay, lowStock, orderBelt, soldSince } from "./landingData";

const now = new Date(2026, 10, 4, 15).getTime();
const day = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString();

describe("landing data", () => {
  it("counts calendar days to the next sitting", () => {
    expect(daysUntil(day(4, 18), now)).toBe(0);
    expect(daysUntil(day(5, 9), now)).toBe(1);
    expect(daysUntil(day(14), now)).toBe(10);
  });

  it("finds the newest finished sitting still healing", () => {
    const past = [
      { id: 1, status: "completed", endsAt: day(1), completedAt: day(1) },
      { id: 2, status: "completed", endsAt: day(3) },
      { id: 3, status: "cancelled", endsAt: day(4, 10) },
    ];
    expect(healingDay(past, now)).toMatchObject({ day: 2, sitting: { id: 2 } });
    expect(healingDay(past, new Date(2026, 11, 5).getTime())).toBeNull();
    expect(healingDay([], now)).toBeNull();
  });

  it("splits orders along the belt and totals recent sales", () => {
    const orders = [
      { id: 1, status: "paid", totalAmountCents: 5000, createdAt: day(3) },
      { id: 2, status: "fulfilled", totalAmountCents: 7000, createdAt: day(1) },
      { id: 3, status: "cancelled", totalAmountCents: 9000, createdAt: day(2) },
      { id: 4, status: "fulfilled", totalAmountCents: 1000, createdAt: new Date(2026, 8, 1).toISOString() },
    ];
    const belt = orderBelt(orders);
    expect(belt.toPack.map(o => o.id)).toEqual([1]);
    expect(belt.shipped.map(o => o.id)).toEqual([2, 4]);
    expect(soldSince(orders, now)).toBe(12000);
  });

  it("flags products, or their variants, at or below the threshold", () => {
    const low = lowStock(
      [
        { id: 1, title: "Needles", inventoryCount: 3, variants: [] },
        { id: 2, title: "Ink", variants: [{ name: "Black", inventoryCount: 2 }, { name: "Red", inventoryCount: 40 }] },
        { id: 3, title: "Gloves", inventoryCount: 50 },
      ],
      5
    );
    expect(low.map(l => l.product.title)).toEqual(["Needles", "Ink"]);
    expect(low[1].low.map(v => v.name)).toEqual(["Black"]);
  });
});
