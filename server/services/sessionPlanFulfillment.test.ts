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
function database(status = "pending", conflict = false) {
  const state = {
    plan: {
      id: 8,
      artistId: "artist",
      clientId: "client",
      conversationId: 10,
      messageId: null,
      stripeSessionId: "pi_plan",
      status,
      depositTotalCents: 20000,
      platformFeeCents: 400,
    },
    writes: [] as string[],
  };
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: async () =>
            table === schema.sessionPlans ? [state.plan] : [{ id: "artist" }],
          limit: async () => (conflict ? [{ id: 91 }] : []),
        }),
      }),
    }),
    query: {
      sessionPlanItems: {
        findMany: async () =>
          [1, 2].map(i => ({
            id: i,
            sessionIndex: i,
            startsAt: `2026-10-0${i} 01:00:00`,
            durationMinutes: 90,
            depositCents: 10000,
            estimateCents: 40000,
          })),
      },
      artistSettings: {
        findFirst: async () => ({ stripeConnectAccountId: "acct_artist" }),
      },
    },
    insert: (table: unknown) => ({
      values: async () => {
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
