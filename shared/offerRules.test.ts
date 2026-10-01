import { describe, expect, it } from "vitest";
import {
  allocateCents,
  offerEligibility,
  offerRulesSchema,
  quoteOffer,
  type OfferRules,
} from "./offerRules";
const base: OfferRules = {
  name: "Fill Friday",
  description: "",
  kind: "discount",
  valueType: "percentage",
  value: 15,
  currency: "AUD",
  eligibility: "new",
  expiresAt: null,
  sittingFrom: null,
  sittingUntil: null,
  backgroundImageUrl: "",
};
describe("offer amounts and eligibility", () => {
  it("keeps every cent when distributing a discount across sittings", () => {
    const q = quoteOffer(base, 15, [
      { id: 1, estimateCents: 10001, depositCents: 2500 },
      { id: 2, estimateCents: 10002, depositCents: 2501 },
    ]);
    expect(q.discountCents).toBe(3000);
    expect(q.totalEstimateCents).toBe(17003);
    expect(q.items.reduce((n, i) => n + i.estimateCents, 0)).toBe(
      q.totalEstimateCents
    );
    expect(q.depositTotalCents).toBe(4251);
  });
  it("keeps tattoo value intact when applying a voucher", () => {
    const q = quoteOffer(
      { ...base, kind: "voucher", valueType: "fixed", value: 10000 },
      10000,
      [{ id: 1, estimateCents: 100000, depositCents: 25000 }]
    );
    expect(q.totalEstimateCents).toBe(100000);
    expect(q.creditCents).toBe(10000);
    expect(q.depositTotalCents).toBe(15000);
    expect(
      q.items[0].estimateCents -
        q.items[0].depositCents -
        q.items[0].creditCents
    ).toBe(75000);
  });
  it("caps credit and discounts at the booking value", () => {
    expect(
      quoteOffer({ ...base, valueType: "fixed", value: 999999 }, 999999, [
        { id: 1, estimateCents: 5000, depositCents: 1250 },
      ]).amount
    ).toBe(5000);
  });
  it("rejects older bookings unless artist permits them", () => {
    expect(offerEligibility(base, "2026-10-02Z", "2026-10-01Z", [])).toMatch(
      /new bookings/
    );
    expect(
      offerEligibility(
        { ...base, eligibility: "unpaid" },
        "2026-10-02Z",
        "2026-10-01Z",
        []
      )
    ).toBeNull();
  });
  it("rejects expired offers and dates outside the sitting window", () => {
    expect(
      offerEligibility(
        { ...base, expiresAt: "2026-10-01T00:00:00Z" },
        "2026-09-01Z",
        "2026-10-01Z",
        [],
        +new Date("2026-10-02Z")
      )
    ).toMatch(/expired/);
    expect(
      offerEligibility(
        { ...base, sittingUntil: "2026-10-31T00:00:00Z" },
        "2026-09-01Z",
        "2026-10-01Z",
        ["2026-11-01Z"]
      )
    ).toMatch(/outside/);
  });
  it("rejects percentage vouchers and invalid values", () => {
    expect(
      offerRulesSchema.safeParse({ ...base, kind: "voucher" }).success
    ).toBe(false);
    expect(offerRulesSchema.safeParse({ ...base, value: 101 }).success).toBe(
      false
    );
  });
  it("never allocates a discount to a free sitting", () => {
    const q = quoteOffer({ ...base, valueType: "fixed", value: 1 }, 1, [
      { id: 1, estimateCents: 1, depositCents: 1 },
      { id: 2, estimateCents: 1, depositCents: 1 },
      { id: 3, estimateCents: 0, depositCents: 0 },
    ]);
    expect(q.items[2].estimateCents).toBe(0);
    expect(q.items.every(i => i.estimateCents >= 0)).toBe(true);
    expect(q.items.reduce((n, i) => n + i.estimateCents, 0)).toBe(1);
  });
  it("never loses or creates cents across uneven allocations", () => {
    for (let total = 0; total < 1000; total++)
      expect(
        allocateCents(total, [1300, 2700, 6100]).reduce((a, b) => a + b, 0)
      ).toBe(total);
  });
});

it("restricts offers to selected year-months including nonconsecutive months", () => {
  const rules = { ...base, eligibility: "unpaid" as const, sittingMonths: ["2026-10", "2026-12"] };
  const check = (dates: string[]) => offerEligibility(rules, "2026-01-01", "2026-01-01", dates, 0);
  expect(check(["2026-10-10T10:00:00Z", "2026-12-10T10:00:00Z"])).toBeNull();
  expect(check(["2026-11-10T10:00:00Z"])).toContain("selected months");
  expect(check(["2027-10-10T10:00:00Z"])).toContain("selected months");
  expect(offerRulesSchema.safeParse({ ...rules, sittingMonths: ["2026-13"] }).success).toBe(false);
});
