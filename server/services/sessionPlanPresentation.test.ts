import { describe, expect, it } from "vitest";
import { presentSessionPlans } from "./sessionPlanPresentation";
const plan = {
  id: 1,
  artistId: "artist",
  clientId: "client",
  status: "pending",
  depositTotalCents: 10000,
  totalEstimateCents: 50000,
  items: [
    {
      startsAt: "2026-10-01 01:00:00",
      durationMinutes: 180,
      estimateCents: 50000,
      depositCents: 10000,
    },
  ],
};
describe("deposit actions", () => {
  it("hides stale pending records with paid linked sessions", () =>
    expect(
      presentSessionPlans(
        [plan],
        [{ sessionPlanId: 1, depositPaid: 1, paymentStatus: "deposit_paid" }]
      )[0].requiresDeposit
    ).toBe(false));
  it("shows only one identical pending proposal", () =>
    expect(
      presentSessionPlans([plan, { ...plan, id: 2 }], []).filter(
        p => p.requiresDeposit
      )
    ).toHaveLength(1));
  it("suppresses a duplicate of an accepted plan", () =>
    expect(
      presentSessionPlans(
        [plan, { ...plan, id: 2, status: "accepted" }],
        []
      ).filter(p => p.requiresDeposit)
    ).toHaveLength(0));
  it("does not hide a different tattoo with the same artist and price", () =>
    expect(
      presentSessionPlans(
        [
          plan,
          {
            ...plan,
            id: 2,
            items: [{ ...plan.items[0], startsAt: "2026-11-01 01:00:00" }],
          },
        ],
        []
      ).filter(p => p.requiresDeposit)
    ).toHaveLength(2));
  it("keeps the existing checkout rather than inviting a second one", () =>
    expect(
      presentSessionPlans(
        [
          { ...plan, stripeSessionId: "pi_existing" },
          { ...plan, id: 2 },
        ],
        []
      ).find(p => p.requiresDeposit)?.id
    ).toBe(1));
  it("matches a shared paid intent even when dates were changed", () =>
    expect(
      presentSessionPlans(
        [
          { ...plan, stripeSessionId: "pi_same" },
          {
            ...plan,
            id: 2,
            status: "accepted",
            stripeSessionId: "pi_same",
            items: [],
          },
        ],
        []
      ).filter(p => p.requiresDeposit)
    ).toHaveLength(0));
});
