import { describe, expect, it } from "vitest";
import { sittingFinancials } from "./sittingFinancials";
describe("sitting financial presentation", () => {
  it("does not display a missing legacy balance as paid off", () => {
    expect(sittingFinancials({ price: 600, amountPaid: 150 })).toEqual({
      estimateCents: 60000,
      paidCents: 15000,
      remainingCents: 45000,
    });
  });
  it("respects recorded cents including explicit zero over legacy values", () => {
    expect(
      sittingFinancials({
        price: 600,
        amountPaid: 150,
        totalExpectedAmountCents: 0,
        totalPaidAmountCents: 0,
        remainingBalanceCents: 0,
      })
    ).toEqual({ estimateCents: 0, paidCents: 0, remainingCents: 0 });
  });
  it("preserves recorded balances and rounds legacy cents without negative derived debt", () => {
    expect(
      sittingFinancials({ price: 10.23, amountPaid: 15 }).remainingCents
    ).toBe(0);
    expect(
      sittingFinancials({ price: 10.23, remainingBalanceCents: 700 })
        .remainingCents
    ).toBe(700);
    expect(sittingFinancials({ price: 10.23 }).estimateCents).toBe(1023);
  });
});
