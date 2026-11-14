// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));
const forms = vi.hoisted(() => vi.fn());
vi.mock("./appointmentService", () => ({ generateRequiredForms: forms }));
vi.mock("./core", async original => ({
  ...(await original<typeof import("./core")>()),
  getDb: async () => state.db,
}));
// The receipt/transaction wrapper is tested on its own; run the handler directly.
vi.mock("./webhookProcessing", () => ({
  processWebhookOnce: async (_event: unknown, handle: (db: any) => unknown) =>
    handle(state.db),
}));
import { handleStripeWebhook, stripe } from "./stripe";

const CREATED = 1_767_268_800; // 2026-01-01T12:00:00Z

function database(opts: { lead: any; message: any; sittings: any[] }) {
  const updates: { table: unknown; values: any }[] = [];
  const inserts: { table: unknown; values: any }[] = [];
  const db = {
    query: {
      leads: { findFirst: async () => opts.lead },
      conversations: {
        findFirst: async () => ({
          id: 9,
          artistId: "artist",
          clientId: "client",
        }),
      },
      messages: { findFirst: async () => opts.message },
      sessionPlans: { findFirst: async () => undefined },
    },
    select: () => ({
      from: () => ({ where: () => ({ for: async () => opts.sittings }) }),
    }),
    update: (table: unknown) => ({
      set: (values: any) => ({
        where: async () => void updates.push({ table, values }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: any) => void inserts.push({ table, values }),
    }),
  };
  state.db = db;
  return { updates, inserts };
}

const lead = {
  id: 5,
  artistId: "artist",
  clientId: "client",
  conversationId: 9,
  depositAmount: 20000,
  depositVerifiedAt: null,
  status: "deposit_requested",
};
const sitting = (id: number, over = {}) => ({
  id,
  conversationId: 9,
  artistId: "artist",
  clientId: "client",
  status: "pending",
  depositAmount: 100,
  sessionPlanId: null,
  createdAtUnix: CREATED - 60,
  ...over,
});
const proposal = (appointmentIds: number[]) => ({
  id: 43,
  conversationId: 9,
  senderId: "artist",
  messageType: "appointment_request",
  metadata: JSON.stringify({ status: "pending", appointmentIds }),
});
const metadata = (over = {}) => ({
  type: "deposit",
  leadId: "5",
  messageId: "43",
  platformFeeCents: "500",
  artistFeeCents: "0",
  baseAmountCents: "20000",
  stripeConnectAccountId: "acct_artist",
  tier: "free",
  ...over,
});

/** One deposit payment, delivered as either webhook event. */
const events = {
  "checkout.session.completed": (meta: Record<string, string>) => ({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_1",
        amount_total: 20500,
        created: CREATED,
        metadata: meta,
      },
    },
  }),
  "payment_intent.succeeded": (meta: Record<string, string>) => ({
    id: "evt_1",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_1",
        amount_received: 20500,
        created: CREATED,
        metadata: meta,
      },
    },
  }),
} as const;

async function deliver(event: unknown) {
  vi.spyOn(stripe.webhooks, "constructEvent").mockReturnValue(event as any);
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  await handleStripeWebhook(
    { headers: { "stripe-signature": "sig" }, body: Buffer.from("") } as any,
    res as any
  );
  return res;
}

describe.each([
  ["checkout.session.completed", "cs_1"],
  ["payment_intent.succeeded", "pi_1"],
] as const)("deposit webhook — %s", (type, paymentId) => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture");
    forms.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("confirms only the paid proposal's sittings and verifies the lead", async () => {
    const { updates, inserts } = database({
      lead,
      message: proposal([1, 2]),
      sittings: [sitting(1), sitting(2), sitting(3)],
    });
    const res = await deliver(events[type](metadata()));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updates.map(update => update.table)).toEqual([
      schema.appointments,
      schema.messages,
      schema.leads,
    ]);
    expect(forms.mock.calls.map(call => call[0])).toEqual([1, 2]);
    expect(updates[2].values).toMatchObject({
      status: "deposit_verified",
      depositMethod: "stripe",
      stripeCheckoutSessionId: paymentId,
    });
    expect(updates[2].values.depositVerifiedAt).toBeTruthy();
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe(schema.paymentLedger);
    expect(inserts[0].values).toMatchObject({
      transactionType: "deposit",
      amountCents: 20000,
      stripePaymentId: "pi_1",
    });
    expect(JSON.parse(inserts[0].values.metadata)).toEqual({
      leadId: 5,
      conversationId: 9,
      messageId: 43,
      appointmentIds: [1, 2],
      paidCents: 20000,
      dueCents: 20000,
      basis: "proposal",
    });
  });

  it("holds a payment that does not cover the proposal: 200, ledger flagged, lead not verified", async () => {
    const { updates, inserts } = database({
      lead,
      message: proposal([1, 2, 3]),
      sittings: [sitting(1), sitting(2), sitting(3)],
    });
    const res = await deliver(events[type](metadata()));

    // Stripe must not retry: the payment is recorded, not rejected.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.status).not.toHaveBeenCalledWith(500);
    // No sitting and no proposal message was touched.
    expect(updates.map(update => update.table)).toEqual([schema.leads]);
    expect(forms).not.toHaveBeenCalled();
    expect(updates[0].values).toMatchObject({
      status: "deposit_pending",
      depositMethod: "stripe",
      stripeCheckoutSessionId: paymentId,
    });
    expect(updates[0].values.depositClaimedAt).toBeTruthy();
    expect(updates[0].values).not.toHaveProperty("depositVerifiedAt");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe(schema.paymentLedger);
    expect(inserts[0].values).toMatchObject({
      transactionType: "deposit",
      amountCents: 20000,
      stripePaymentId: "pi_1",
    });
    expect(JSON.parse(inserts[0].values.metadata)).toEqual({
      leadId: 5,
      conversationId: 9,
      messageId: 43,
      appointmentIds: [1, 2, 3],
      paidCents: 20000,
      dueCents: 30000,
      needsReview: true,
      reviewReason: "amount_short",
    });
  });

  it("confirms exactly the sittings recorded on the payment when there is no proposal id", async () => {
    const { updates, inserts } = database({
      lead,
      message: null,
      sittings: [sitting(1), sitting(2), sitting(3, { depositAmount: 0 })],
    });
    const res = await deliver(
      events[type](metadata({ messageId: "", appointmentIds: "1,2" }))
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updates.map(update => update.table)).toEqual([
      schema.appointments,
      schema.leads,
    ]);
    expect(forms.mock.calls.map(call => call[0])).toEqual([1, 2]);
    expect(JSON.parse(inserts[0].values.metadata)).toMatchObject({
      appointmentIds: [1, 2],
      basis: "recorded_sittings",
    });
  });

  it("holds a legacy payment when a sitting was added after it and the amount is not exact", async () => {
    const { updates, inserts } = database({
      lead,
      message: null,
      sittings: [
        sitting(1),
        sitting(2),
        sitting(3, { createdAtUnix: CREATED + 60, depositAmount: 0 }),
      ],
    });
    const res = await deliver(events[type](metadata({ messageId: "" })));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updates.map(update => update.table)).toEqual([schema.leads]);
    expect(updates[0].values.status).toBe("deposit_pending");
    expect(JSON.parse(inserts[0].values.metadata)).toMatchObject({
      needsReview: true,
      reviewReason: "sittings_changed",
    });
  });

  it("does not pull an already verified lead back when a second payment is held", async () => {
    const { updates, inserts } = database({
      lead: {
        ...lead,
        status: "deposit_verified",
        depositVerifiedAt: "2026-01-01 00:00:00",
      },
      message: proposal([1]),
      sittings: [sitting(1, { status: "confirmed" })],
    });
    const res = await deliver(events[type](metadata()));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updates).toEqual([]);
    expect(JSON.parse(inserts[0].values.metadata)).toMatchObject({
      needsReview: true,
      reviewReason: "no_matching_sittings",
    });
  });
});
