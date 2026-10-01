// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import * as schema from "../../drizzle/schema";
const forms = vi.hoisted(() => vi.fn());
vi.mock("./appointmentService", () => ({ generateRequiredForms: forms }));
import { fulfillSessionPlan } from "./sessionPlanFulfillment";
const payment = {
  id: "pi_plan",
  status: "succeeded",
  currency: "aud",
  amount_received: 20400,
  transfer_data: { destination: "acct_artist" },
  metadata: { artistFeeCents: "0", tier: "free" },
} as unknown as Stripe.PaymentIntent;
function database(status = "pending", conflict = false, credit = false) {
  const state = {
    plan: {
      id: 8,
      artistId: "artist",
      clientId: "client",
      conversationId: 10,
      messageId: null,
      stripeSessionId: credit ? null : "pi_plan",
      status,
      depositTotalCents: credit ? 0 : 20000,
      platformFeeCents: credit ? 0 : 400,
    },
    writes: [] as string[],
    appointments: [] as any[],
  };
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: async () =>
            table === schema.sessionPlans
              ? [state.plan]
              : table === schema.clientOffers
                ? [
                    {
                      id: 1,
                      remainingValue: 80000,
                      reservedPlanId: 8,
                      transferTo: null,
                      rulesJson: JSON.stringify({
                        name: "Gift",
                        kind: "voucher",
                        valueType: "fixed",
                        value: 80000,
                        currency: "AUD",
                        eligibility: "unpaid",
                        expiresAt: null,
                        sittingFrom: null,
                        sittingUntil: null,
                      }),
                    },
                  ]
                : [{ id: "artist" }],
          limit: async () => (conflict ? [{ id: 91 }] : []),
        }),
      }),
    }),
    query: {
      offerApplications: {
        findFirst: async () =>
          credit
            ? {
                id: 1,
                offerId: 1,
                quoteJson: JSON.stringify({
                  amount: 80000,
                  creditCents: 80000,
                  items: [
                    { id: 1, creditCents: 40000 },
                    { id: 2, creditCents: 40000 },
                  ],
                }),
              }
            : null,
      },
      studioMembers: { findFirst: async () => null },
      sessionPlanItems: {
        findMany: async () =>
          [1, 2].map(i => ({
            id: i,
            sessionIndex: i,
            startsAt: `2026-10-0${i} 01:00:00`,
            durationMinutes: 90,
            depositCents: credit ? 0 : 10000,
            estimateCents: 40000,
          })),
      },
      artistSettings: {
        findFirst: async () => ({ stripeConnectAccountId: "acct_artist" }),
      },
    },
    insert: (table: unknown) => ({
      values: async (values: any) => {
        if (table === schema.appointments) state.appointments.push(values);
        state.writes.push(
          table === schema.appointments ? "appointment" : "ledger"
        );
        return [{ insertId: state.writes.length }];
      },
    }),
    update: (table: unknown) => ({
      set: (value: any) => ({
        where: async () => {
          if (table === schema.sessionPlans) state.plan.status = value.status;
          state.writes.push("update");
        },
      }),
    }),
  };
  return {
    state,
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await work(tx);
      } catch (e) {
        state.plan = snapshot.plan;
        state.writes = snapshot.writes;
        state.appointments = snapshot.appointments;
        throw e;
      }
    }),
  };
}
beforeEach(() => forms.mockReset());
describe("session plan fulfilment", () => {
  it("creates every session and its forms before accepting, then ignores replay", async () => {
    const db = database();
    await fulfillSessionPlan(db, 8, payment);
    expect(db.state.plan.status).toBe("accepted");
    expect(forms).toHaveBeenCalledTimes(2);
    expect(db.state.writes.filter(x => x === "appointment")).toHaveLength(2);
    const before = [...db.state.writes];
    await expect(fulfillSessionPlan(db, 8, payment)).resolves.toEqual({
      alreadyProcessed: true,
    });
    expect(db.state.writes).toEqual(before);
  });
  it("rolls back all writes if a later form fails; a retry can finish", async () => {
    const db = database();
    forms
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("form insert failed"));
    await expect(fulfillSessionPlan(db, 8, payment)).rejects.toThrow(
      "form insert failed"
    );
    expect(db.state.writes).toEqual([]);
    expect(db.state.plan.status).toBe("pending");
    await fulfillSessionPlan(db, 8, payment);
    expect(db.state.plan.status).toBe("accepted");
  });
  it("rejects wrong amounts, recipients, withdrawn plans and occupied dates", async () => {
    for (const [db, pi] of [
      [database(), { ...payment, amount_received: 1 }],
      [
        database(),
        { ...payment, transfer_data: { destination: "acct_other" } },
      ],
      [database("withdrawn"), payment],
      [database("pending", true), payment],
    ] as const) {
      await expect(
        fulfillSessionPlan(db, 8, pi as Stripe.PaymentIntent)
      ).rejects.toThrow();
      expect(db.state.writes).toEqual([]);
    }
  });
});

it("rejects zero-payment confirmation without an authenticated matching client", async () => {
  const db = database();
  await expect(
    fulfillSessionPlan(db, 8, null, "another-client")
  ).rejects.toThrow("does not match");
  expect(db.state.writes).toHaveLength(0);
});

it("confirms a fully covered voucher booking without a fictitious Stripe payment or cash ledger entry", async () => {
  const db = database("pending", false, true);
  await fulfillSessionPlan(db, 8, null, "client");
  expect(db.state.plan.status).toBe("accepted");
  expect(db.state.writes.filter(x => x === "ledger")).toHaveLength(0);
  expect(db.state.appointments).toHaveLength(2);
  for (const appointment of db.state.appointments) {
    expect(appointment.remainingBalanceCents).toBe(0);
    expect(appointment.paymentStatus).toBe("fully_paid");
    expect(appointment.depositPaymentId).toBeNull();
  }
  const writes = db.state.writes.length;
  await fulfillSessionPlan(db, 8, null, "client");
  expect(db.state.writes).toHaveLength(writes);
});
