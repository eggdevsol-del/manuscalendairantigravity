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

describe("booking price changes", () => {
  it("recomputes the balance while preserving the paid deposit", async () => {
    const { revisedBookingPrice } = await import("./paymentState");
    expect(
      revisedBookingPrice({ totalPaidAmountCents: 15000 }, 750.5)
    ).toMatchObject({
      totalExpectedAmountCents: 75050,
      totalPaidAmountCents: 15000,
      remainingBalanceCents: 60050,
      paymentStatus: "deposit_paid",
      clientPaid: 0,
    });
  });
  it("restores a balance when a fully paid booking price increases", async () => {
    const { revisedBookingPrice } = await import("./paymentState");
    expect(
      revisedBookingPrice({ totalPaidAmountCents: 60000 }, 700)
    ).toMatchObject({
      remainingBalanceCents: 10000,
      paymentStatus: "deposit_paid",
      clientPaid: 0,
    });
  });
  it("uses the recorded legacy deposit without counting it twice", async () => {
    const { revisedBookingPrice } = await import("./paymentState");
    expect(
      revisedBookingPrice(
        { depositPaid: 1, depositAmount: 150, totalPaidAmountCents: 0 },
        600
      ).remainingBalanceCents
    ).toBe(45000);
    expect(
      revisedBookingPrice(
        { depositPaid: 1, depositAmount: 150, totalPaidAmountCents: 20000 },
        600
      ).remainingBalanceCents
    ).toBe(40000);
  });
  it("rejects invalid prices and reductions below payments already received", async () => {
    const { revisedBookingPrice } = await import("./paymentState");
    for (const price of [-1, Infinity, NaN, 1e12])
      expect(() => revisedBookingPrice({}, price)).toThrow();
    expect(() =>
      revisedBookingPrice({ totalPaidAmountCents: 20000 }, 100)
    ).toThrow("already received");
  });
});
