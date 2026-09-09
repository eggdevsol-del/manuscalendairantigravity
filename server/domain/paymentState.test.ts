// @vitest-environment node
import { describe, expect, it } from "vitest";
import { settledBalance } from "./paymentState";
describe("balance payment state", () => {
  it("marks an advance payment paid without completing the future appointment", () => {
    const update = settledBalance(
      { totalPaidAmountCents: 10000, totalExpectedAmountCents: 40000 },
      30000
    );
    expect(update).toMatchObject({
      totalPaidAmountCents: 40000,
      remainingBalanceCents: 0,
      paymentStatus: "fully_paid",
    });
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("actualEndTime");
  });
  it("retains partial balances precisely in cents", () => {
    expect(
      settledBalance(
        { totalPaidAmountCents: 10001, totalExpectedAmountCents: 40005 },
        20002
      )
    ).toMatchObject({
      totalPaidAmountCents: 30003,
      remainingBalanceCents: 10002,
      paymentStatus: "deposit_paid",
    });
  });
  it("rejects negative, fractional and nonfinite payment amounts", () => {
    for (const amount of [-1, 0, 1.5, NaN, Infinity])
      expect(() =>
        settledBalance(
          { totalPaidAmountCents: 0, totalExpectedAmountCents: 100 },
          amount
        )
      ).toThrow();
  });
});
