import { describe, expect, it } from "vitest";
import {
  chairWeek,
  countsStock,
  freeDelivery,
  fromLastOrder,
  shelvesOf,
  type StoreProduct,
} from "./supplyStore";

const product = (
  id: number,
  category: string | null,
  variants: [number, number, number][]
): StoreProduct => ({
  id,
  title: `Product ${id}`,
  category,
  imageUrl: null,
  variants: variants.map(([vid, priceCents, stock]) => ({
    id: vid,
    name: `Option ${vid}`,
    priceCents,
    stock,
  })),
});

describe("chairWeek", () => {
  const monday = new Date(2026, 10, 2, 9).getTime();
  const at = (day: number, hour: number) => new Date(2026, 10, day, hour);
  const schedule = [
    { day: "Monday", enabled: true, start: "10:00", end: "18:00" },
    { day: "Tuesday", enabled: true, start: "10:00", end: "16:00", breaks: [{ start: "12:00", end: "13:00" }] },
  ];
  it("counts booked hours and open hours for each of the next seven days", () => {
    const week = chairWeek(
      [
        { id: 1, startTime: at(2, 10), endTime: at(2, 14) },
        { id: 2, startTime: at(3, 11), endTime: at(3, 13) },
        { id: 3, startTime: at(3, 14), endTime: at(3, 15), status: "cancelled" },
        { id: 4, startTime: at(9, 10), endTime: at(9, 12) },
      ],
      schedule,
      monday
    );
    expect(week).toHaveLength(7);
    expect(week.map(d => d.hours)).toEqual([4, 2, 0, 0, 0, 0, 0]);
    expect(week.map(d => d.sittings)).toEqual([1, 1, 0, 0, 0, 0, 0]);
    expect(week[0].open).toBe(8);
    expect(week[1].open).toBe(5);
    expect(week[2].open).toBe(0);
  });
});

describe("shelvesOf", () => {
  it("groups by category in catalogue order with uncategorised products last", () => {
    const shelves = shelvesOf([
      product(1, null, []),
      product(2, "Needles", []),
      product(3, "Ink", []),
      product(4, "Needles ", []),
    ]);
    expect(shelves.map(s => [s.title, s.products.map(p => p.id)])).toEqual([
      ["Needles", [2, 4]],
      ["Ink", [3]],
      ["", [1]],
    ]);
  });
});

describe("fromLastOrder", () => {
  const products = [
    product(10, "Needles", [[100, 2500, 5], [101, 2500, 0]]),
    product(11, "Ink", [[110, 1800, 20]]),
  ];
  const item = (supplierProductId: number, variantId: number, quantity: number) => ({
    supplierProductId,
    variantId,
    quantity,
  });
  it("takes the latest paid order from this supplier, capped by today's stock", () => {
    const result = fromLastOrder(
      [
        { id: 1, supplierId: 7, status: "paid", createdAt: "2026-09-01T00:00:00Z", items: [item(11, 110, 1)] },
        { id: 2, supplierId: 7, status: "paid", createdAt: "2026-10-01T00:00:00Z", items: [item(10, 100, 8), item(10, 101, 2), item(11, 110, 3), item(99, 990, 1)] },
        { id: 3, supplierId: 7, status: "pending", createdAt: "2026-10-20T00:00:00Z", items: [item(11, 110, 9)] },
        { id: 4, supplierId: 8, status: "paid", createdAt: "2026-10-25T00:00:00Z", items: [item(11, 110, 4)] },
      ],
      7,
      products
    );
    expect(result?.order.id).toBe(2);
    expect(result?.lines.map(l => [l.variant.id, l.quantity])).toEqual([
      [100, 5],
      [110, 3],
    ]);
  });
  it("is empty without a paid order", () => {
    expect(fromLastOrder([], 7, products)).toBeNull();
  });
});

describe("freeDelivery", () => {
  const rate = (name: string, priceCents: number, min: number | null, max: number | null = null) => ({
    name,
    priceCents,
    minOrderSubtotalCents: min,
    maxOrderSubtotalCents: max,
  });
  it("measures the tray against the supplier's free rate", () => {
    const rates = [rate("Standard", 1200, null, 14999), rate("Free", 0, 15000)];
    expect(freeDelivery(rates, 10000)).toEqual({ name: "Free", min: 15000, short: 5000 });
    expect(freeDelivery(rates, 15000)).toEqual({ name: "Free", min: 15000, short: 0 });
  });
  it("is null when the supplier has no free rate", () => {
    expect(freeDelivery([rate("Standard", 1200, null)], 50000)).toBeNull();
  });
});

describe("countsStock", () => {
  it("is false for catalogues that only know whether an option is available", () => {
    expect(countsStock([product(1, null, [[1, 100, 1], [2, 100, 0]])])).toBe(false);
    expect(countsStock([product(1, null, [[1, 100, 1]]), product(2, null, [[2, 100, 6]])])).toBe(true);
  });
});
