// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { reconcileChargeRefund } from "./refundReconciliation";
import { appointments } from "../../drizzle/schema";
function fixture() {
  const rows: any[] = [];
  let booking = {
    id: 1,
    totalPaidAmountCents: 10000,
    totalExpectedAmountCents: 30000,
  };
  const update = vi.fn((data: any) => {
    Object.assign(booking, data);
    return { where: async () => undefined };
  });
  const insert = vi.fn(async (row: any) => {
    rows.push(row);
  });
  const db = {
    query: {
      paymentLedger: {
        findFirst: async () => ({
          artistId: "artist",
          clientId: "client",
          bookingId: 1,
          amountCents: 10000,
          platformFeeCents: 200,
          transactionType: "deposit",
          paymentMethod: "card",
        }),
      },
      sessionPlans: { findFirst: async () => null },
    },
    select: () => ({
      from: (table: unknown) => ({
        where: () =>
          table === appointments
            ? { for: async () => [booking] }
            : Promise.resolve(rows),
      }),
    }),
    update: () => ({ set: update }),
    insert: () => ({ values: insert }),
  };
  return { db: db as any, rows, booking, update, insert };
}
const charge = (amount: number) =>
  ({
    id: "ch_test",
    payment_intent: "pi_test",
    amount_refunded: amount,
  }) as any;
describe("cumulative refund reconciliation", () => {
  it("records a later fee-only refund without reducing the booking twice", async () => {
    const f = fixture();
    await reconcileChargeRefund(f.db, charge(10000));
    expect(f.booking.totalPaidAmountCents).toBe(0);
    await reconcileChargeRefund(f.db, charge(10200));
    expect(f.rows.map(r => [r.amountCents, r.platformFeeCents])).toEqual([
      [-10000, 0],
      [0, -200],
    ]);
    expect(f.update).toHaveBeenCalledTimes(1);
  });
  it("ignores repeated and out-of-order cumulative totals", async () => {
    const f = fixture();
    await reconcileChargeRefund(f.db, charge(7000));
    await reconcileChargeRefund(f.db, charge(2000));
    await reconcileChargeRefund(f.db, charge(7000));
    expect(f.rows).toHaveLength(1);
    expect(f.booking.totalPaidAmountCents).toBe(3000);
    expect(f.booking).toMatchObject({ remainingBalanceCents: 27000 });
  });
});
