// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
const retrieve = vi.hoisted(() => vi.fn());
vi.mock("./stripe", () => ({ stripe: { paymentIntents: { retrieve } } }));
import { readPresentedPlans } from "./sessionPlanPresentation";
const db = { select: () => ({ from: () => ({ where: async () => [] }) }) };
const plan = {
  id: 1,
  artistId: "a",
  clientId: "c",
  status: "pending",
  depositTotalCents: 100,
  totalEstimateCents: 100,
};
describe("pending payment verification", () => {
  it("does not invite payment again while the webhook is outstanding", async () => {
    retrieve.mockResolvedValue({ status: "succeeded" });
    const [result] = await readPresentedPlans(db, [
      { ...plan, stripeSessionId: "pi_paid" },
    ]);
    expect(result.requiresDeposit).toBe(false);
    expect(result.paymentState).toBe("succeeded");
  });
  it("does not invite repayment when Stripe cannot be verified", async () => {
    retrieve.mockRejectedValue(new Error("offline"));
    const [result] = await readPresentedPlans(db, [
      { ...plan, stripeSessionId: "pi_unknown" },
    ]);
    expect(result.requiresDeposit).toBe(false);
    expect(result.paymentState).toBe("unverified");
  });
  it("allows an existing unpaid checkout to resume", async () => {
    retrieve.mockResolvedValue({ status: "requires_payment_method" });
    const [result] = await readPresentedPlans(db, [
      { ...plan, stripeSessionId: "pi_unpaid" },
    ]);
    expect(result.requiresDeposit).toBe(true);
    expect(result.paymentState).toBeNull();
  });
});
