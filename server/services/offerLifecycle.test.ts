// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import * as s from "../../drizzle/schema";
const provider = vi.hoisted(() => ({
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
    cancel: vi.fn(),
    search: vi.fn(),
  },
  checkout: { sessions: { retrieve: vi.fn(), expire: vi.fn() } },
}));
vi.mock("./stripe", () => ({ stripe: provider }));
vi.mock("./paymentEntitlements", () => ({
  effectivePaymentTier: async () => "pro",
}));
import {
  getBalanceOffers,
  settleOfferBalance,
  cancelOfferBalance,
} from "./offerBalance";
import { restoreCancelledOfferCredit } from "./offerRestoration";
import { fulfillVoucherPurchase, purchaseVoucher } from "./offerPurchase";
import { cancelPlanOfferCheckout } from "./offerCheckout";
const rules = {
  name: "Gift",
  kind: "voucher",
  valueType: "fixed",
  value: 10000,
  currency: "AUD",
  eligibility: "unpaid",
  expiresAt: null,
  sittingFrom: null,
  sittingUntil: null,
  description: "",
  backgroundImageUrl: "",
};
function memory(initial: Record<string, any[]>) {
  const rows = { ...initial },
    writes: any[] = [];
  const table = (t: any) => getTableName(t);
  const query: any = {};
  for (const [key, value] of Object.entries(s)) {
    try {
      const name = table(value);
      if (name)
        query[key] = {
          findFirst: async () => rows[name]?.[0],
          findMany: async () => rows[name] || [],
        };
    } catch {}
  }
  return {
    rows,
    writes,
    db: {
      query,
      select: () => ({
        from: (t: any) => ({
          where: () => {
            const result = Promise.resolve(rows[table(t)] || []);
            return Object.assign(result, {
              for: async () => rows[table(t)] || [],
            });
          },
        }),
      }),
      update: (t: any) => ({
        set: (values: any) => ({
          where: async () => {
            writes.push({ table: table(t), values });
            if (rows[table(t)]?.[0]) Object.assign(rows[table(t)][0], values);
          },
        }),
      }),
      insert: (t: any) => ({
        values: (value: any) => {
          const execute = async () => {
            const name = table(t),
              id = (rows[name]?.length || 0) + 1;
            const row = { id, ...value };
            (rows[name] ??= []).push(row);
            writes.push({ table: name, values: value });
            return [{ insertId: id }];
          };
          return {
            then: (resolve: any, reject: any) =>
              execute().then(resolve, reject),
            onDuplicateKeyUpdate: execute,
          };
        },
      }),
    },
  };
}
beforeEach(() => {
  vi.stubEnv("IVORY_OFFERS_ENABLED", "true");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
describe("balance offers", () => {
  const booking = () => ({
    id: 1,
    clientId: "client",
    artistId: "artist",
    status: "confirmed",
    createdAt: "2026-01-01 00:00:00",
    startTime: "2027-01-01 00:00:00",
    totalExpectedAmountCents: 10000,
    totalPaidAmountCents: 2000,
  });
  it("denies another client's balance", async () => {
    const m = memory({ appointments: [booking()] });
    await expect(getBalanceOffers(m.db, 1, "other")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(m.writes).toEqual([]);
  });
  it("quotes only the remaining balance and recomputes the platform fee", async () => {
    const m = memory({
      appointments: [booking()],
      client_offers: [
        {
          id: 2,
          clientId: "client",
          artistId: "artist",
          remainingValue: 3000,
          issuedAt: "2026-01-01 00:00:00",
          rulesJson: JSON.stringify(rules),
        },
      ],
      artistSettings: [
        { stripeConnectAccountId: "acct", stripeConnectOnboardingComplete: 1 },
      ],
    });
    const result = await getBalanceOffers(m.db, 1, "client", 2);
    expect(result.quote).toMatchObject({
      due: 8000,
      creditCents: 3000,
      cashCents: 5000,
      platformFeeCents: 500,
      totalCents: 5500,
    });
  });
  it("does not consume a voucher reserved by another checkout", async () => {
    const m = memory({
      appointments: [booking()],
      client_offers: [
        {
          id: 2,
          clientId: "client",
          artistId: "artist",
          reservedBalanceId: 99,
          remainingValue: 3000,
          rulesJson: JSON.stringify(rules),
        },
      ],
    });
    await expect(getBalanceOffers(m.db, 1, "client", 2)).rejects.toThrow(
      "not available"
    );
    expect(m.writes).toEqual([]);
  });
  it("zero-cash settlement consumes credit exactly once without a cash ledger entry", async () => {
    const q = {
      cashCents: 0,
      totalCents: 0,
      creditCents: 8000,
      discountCents: 0,
      original: { paid: 2000, expected: 10000 },
    };
    const m = memory({
      appointments: [booking()],
      offer_balance_checkouts: [
        {
          id: 3,
          bookingId: 1,
          offerId: 2,
          clientId: "client",
          status: "reserved",
          quoteJson: JSON.stringify(q),
        },
      ],
      client_offers: [
        {
          id: 2,
          clientId: "client",
          remainingValue: 10000,
          reservedBalanceId: 3,
          rulesJson: JSON.stringify(rules),
        },
      ],
    });
    await settleOfferBalance(m.db, 3, null, "client");
    await settleOfferBalance(m.db, 3, null, "client");
    expect(m.rows.client_offers[0].remainingValue).toBe(2000);
    expect(m.rows.appointments[0]).toMatchObject({
      totalPaidAmountCents: 10000,
      remainingBalanceCents: 0,
      paymentStatus: "fully_paid",
    });
    expect(m.rows.payment_ledger).toBeUndefined();
    expect(m.rows.notification_outbox).toHaveLength(1);
  });
  it("rejects changed prices before allocating a captured payment", async () => {
    const m = memory({
      appointments: [booking()],
      offer_balance_checkouts: [
        {
          id: 3,
          bookingId: 1,
          clientId: "client",
          status: "reserved",
          quoteJson: JSON.stringify({
            cashCents: 0,
            totalCents: 0,
            original: { paid: 2000, expected: 9000 },
          }),
        },
      ],
    });
    await expect(settleOfferBalance(m.db, 3, null, "client")).rejects.toThrow(
      "Booking changed"
    );
    expect(m.writes).toEqual([]);
  });
  it("does not release credit while Stripe is processing", async () => {
    provider.paymentIntents.retrieve.mockResolvedValue({
      status: "processing",
    });
    const m = memory({
      appointments: [booking()],
      offer_balance_checkouts: [
        { id: 3, bookingId: 1, paymentId: "pi_pending", offerId: 2 },
      ],
    });
    await expect(cancelOfferBalance(m.db, 1, "client")).rejects.toThrow(
      "processing"
    );
    expect(m.writes).toEqual([]);
  });
});
describe("gift lifecycle", () => {
  it("restores cancelled sitting credit to its payer after the original gift has been transferred", async () => {
    const m = memory({
      appointments: [
        {
          id: 1,
          clientId: "payer",
          artistId: "artist",
          status: "cancelled",
          totalPaidAmountCents: 5000,
          remainingBalanceCents: 0,
        },
      ],
      offer_balance_checkouts: [
        { id: 8, offerId: 2, quoteJson: JSON.stringify({ creditCents: 5000 }) },
      ],
      client_offers: [
        {
          id: 2,
          clientId: "recipient",
          campaignId: 1,
          rulesJson: JSON.stringify(rules),
          remainingValue: 1000,
        },
      ],
    });
    await restoreCancelledOfferCredit(m.db, 1);
    await restoreCancelledOfferCredit(m.db, 1);
    expect(m.rows.client_offers).toHaveLength(2);
    expect(m.rows.client_offers[1]).toMatchObject({
      clientId: "payer",
      remainingValue: 5000,
    });
    expect(m.rows.client_offers[0].remainingValue).toBe(1000);
    expect(m.rows.offer_credit_restorations).toHaveLength(1);
    expect(m.rows.appointments[0].totalPaidAmountCents).toBe(0);
  });
  it("does not expose another client's voucher purchase", async () => {
    const m = memory({ client_offers: [{ clientId: "owner" }] });
    await expect(purchaseVoucher(m.db, 1, "other")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(provider.paymentIntents.create).not.toHaveBeenCalled();
  });
  it("activates a paid voucher once and begins validity at purchase", async () => {
    const m = memory({
      client_offers: [
        {
          id: 1,
          clientId: "client",
          artistId: "artist",
          purchasePaymentId: "pi_gift",
          remainingValue: 0,
          purchaseRequired: 1,
          rulesJson: JSON.stringify({
            ...rules,
            funding: "sale",
            validityYears: 3,
          }),
        },
      ],
      artistSettings: [{ stripeConnectAccountId: "acct" }],
    });
    const p: any = {
      id: "pi_gift",
      status: "succeeded",
      currency: "aud",
      amount_received: 10500,
      transfer_data: { destination: "acct" },
      metadata: {
        offerId: "1",
        baseAmountCents: "10000",
        platformFeeCents: "500",
        artistFeeCents: "0",
        tier: "pro",
      },
    };
    await fulfillVoucherPurchase(m.db, p);
    await fulfillVoucherPurchase(m.db, p);
    expect(m.rows.client_offers[0]).toMatchObject({
      remainingValue: 10000,
      purchaseRequired: 0,
    });
    expect(
      +new Date(JSON.parse(m.rows.client_offers[0].rulesJson).expiresAt)
    ).toBeGreaterThan(Date.now() + 1094 * 86400000);
    expect(m.rows.payment_ledger).toHaveLength(1);
    expect(m.rows.payment_ledger[0].transactionType).toBe("voucher_sale");
  });
  it("rejects a voucher payment routed to the wrong artist", async () => {
    const m = memory({
      client_offers: [
        {
          id: 1,
          clientId: "client",
          artistId: "artist",
          purchasePaymentId: "pi_gift",
          rulesJson: JSON.stringify({ ...rules, funding: "sale" }),
        },
      ],
      artistSettings: [{ stripeConnectAccountId: "acct" }],
    });
    await expect(
      fulfillVoucherPurchase(m.db, {
        id: "pi_gift",
        status: "succeeded",
        currency: "aud",
        amount_received: 10500,
        transfer_data: { destination: "other" },
        metadata: {
          offerId: "1",
          baseAmountCents: "10000",
          platformFeeCents: "500",
        },
      } as any)
    ).rejects.toThrow("does not match");
    expect(m.writes).toEqual([]);
  });
  it("requires ownership before cancelling a proposal checkout", async () => {
    const m = memory({
      session_plans: [{ id: 1, clientId: "owner", status: "pending" }],
    });
    await expect(
      cancelPlanOfferCheckout(m.db, 1, "other")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
