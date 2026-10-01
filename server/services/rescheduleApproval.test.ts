// @vitest-environment node
import { describe, it, expect } from "vitest";
import { reschedulePriceTerms } from "./rescheduleApproval";
const original = {
  items: [
    { id: 1, estimateCents: 100000 },
    { id: 2, estimateCents: 100000 },
  ],
};
const quote = {
  items: [
    { id: 1, estimateCents: 75000 },
    { id: 2, estimateCents: 75000 },
  ],
};
describe("reschedule financial terms", () => {
  it("removes only the moved sitting's allocated discount and keeps paid money credited", () => {
    expect(
      reschedulePriceTerms(
        { totalExpectedAmountCents: 75000, totalPaidAmountCents: 20000 },
        original,
        quote,
        2,
        "discount"
      )
    ).toEqual({
      oldEstimateCents: 75000,
      estimateCents: 100000,
      paidCents: 20000,
      remainingCents: 80000,
      removedDiscountCents: 25000,
    });
    expect(quote.items[0].estimateCents).toBe(75000);
  });
  it("never revokes paid gift voucher credit", () => {
    expect(
      reschedulePriceTerms(
        { totalExpectedAmountCents: 100000, totalPaidAmountCents: 40000 },
        original,
        quote,
        2,
        "voucher"
      )
    ).toMatchObject({
      estimateCents: 100000,
      paidCents: 40000,
      remainingCents: 60000,
      removedDiscountCents: 0,
    });
  });
  it("rejects an unknown allocation rather than guessing a price", () => {
    expect(() =>
      reschedulePriceTerms({}, original, quote, 99, "discount")
    ).toThrow("could not be verified");
  });
});
