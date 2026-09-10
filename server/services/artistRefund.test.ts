// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  entry: {} as any,
  originals: [] as any[],
  items: [] as any[],
  charge: {} as any,
  create: vi.fn(),
}));
vi.mock("./core", () => ({
  getDb: async () => ({
    query: {
      paymentLedger: {
        findFirst: async () => mocks.entry,
        findMany: async () => mocks.originals,
      },
      sessionPlans: { findFirst: async () => ({ id: 1 }) },
      sessionPlanItems: { findMany: async () => mocks.items },
    },
  }),
}));
vi.mock("./stripe", () => ({
  stripe: {
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_fixture" }) },
    charges: { retrieve: async () => mocks.charge },
    refunds: { create: mocks.create },
  },
}));
import { previewArtistRefund, requestArtistRefund } from "./artistRefund";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.entry = {
    id: 1,
    artistId: "artist",
    stripePaymentId: "pi_fixture",
    amountCents: 10000,
    platformFeeCents: 200,
    transactionType: "deposit",
    bookingId: null,
  };
  mocks.originals = [mocks.entry];
  mocks.items = [
    { appointmentId: 1, depositCents: 4000 },
    { appointmentId: 2, depositCents: 6000 },
  ];
  mocks.charge = {
    id: "ch_fixture",
    payment_intent: "pi_fixture",
    paid: true,
    captured: true,
    amount: 10200,
    amount_refunded: 0,
    currency: "aud",
    transfer: "tr_fixture",
    application_fee: "fee_fixture",
  };
  mocks.create.mockResolvedValue({
    id: "re_fixture",
    amount: 10200,
    currency: "aud",
    status: "succeeded",
  });
});
describe("artist refund review", () => {
  it("previews the actual full charge and bundled session count", async () => {
    expect(await previewArtistRefund("artist", 1)).toMatchObject({
      amountCents: 10200,
      sessionCount: 2,
      currency: "aud",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects another artist and mismatched historical records", async () => {
    await expect(previewArtistRefund("other", 1)).rejects.toThrow(
      "Transaction not found"
    );
    mocks.originals.push({ ...mocks.entry, id: 2 });
    await expect(previewArtistRefund("artist", 1)).rejects.toThrow(
      "reconciliation"
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires a fresh amount if another refund changed the charge", async () => {
    mocks.charge.amount_refunded = 1000;
    await expect(requestArtistRefund("artist", 1, 10200)).rejects.toThrow(
      "amount changed"
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses a stable idempotency key, explicit amount and no independent ledger writes", async () => {
    await requestArtistRefund("artist", 1, 10200);
    await requestArtistRefund("artist", 1, 10200);
    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      {
        charge: "ch_fixture",
        amount: 10200,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { artistId: "artist", ledgerId: "1" },
      },
      { idempotencyKey: "artist-refund:ch_fixture:0" }
    );
    expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0]);
  });
  it("refuses deposits whose linked appointments cannot be reconciled", async () => {
    mocks.items = [];
    await expect(requestArtistRefund("artist", 1, 10200)).rejects.toThrow(
      "appointment records"
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
