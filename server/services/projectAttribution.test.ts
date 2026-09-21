import { describe, it, expect } from "vitest";
import {
  paymentProjectKeys,
  paymentSessions,
  briefProjectKeys,
} from "./projectAttribution";
const sessions = [
  {
    id: 1,
    sessionPlanId: 11,
    depositPaymentId: "pi_a",
    balancePaymentId: null,
  },
  {
    id: 2,
    sessionPlanId: 12,
    depositPaymentId: "pi_b",
    balancePaymentId: null,
  },
];
const plans = [
  { id: 11, stripeSessionId: "pi_a", message: { metadata: '{"leadId":4}' } },
  { id: 12, stripeSessionId: "pi_b", message: { metadata: "{}" } },
];
describe("Project attribution", () => {
  it("scopes a session transaction to its project", () => {
    expect(
      paymentProjectKeys(
        { bookingId: 1, stripePaymentId: null },
        sessions,
        plans
      )
    ).toEqual(["plan:11"]);
  });
  it("links a whole-plan deposit without duplicating it for each sitting", () => {
    expect(
      paymentProjectKeys(
        { bookingId: null, stripePaymentId: "pi_a" },
        sessions,
        plans
      )
    ).toEqual(["plan:11"]);
  });
  it("keeps unmatched historical payments unassigned", () => {
    expect(
      paymentProjectKeys(
        { bookingId: null, stripePaymentId: "pi_unknown" },
        sessions,
        plans
      )
    ).toEqual([]);
  });
  it("uses explicit intake or payment links for references", () => {
    expect(briefProjectKeys({ id: 4, paymentId: null }, plans)).toEqual([
      "plan:11",
    ]);
    expect(briefProjectKeys({ id: 7, paymentId: "pi_b" }, plans)).toEqual([
      "plan:12",
    ]);
  });
  it("does not attach old conversation-wide references to another tattoo", () => {
    expect(briefProjectKeys({ id: 9, paymentId: null }, plans)).toEqual([]);
  });
});

it("identifies all sittings in a shared deposit and only the linked balance sitting", () => {
  const rows = [
    {
      id: 1,
      sessionPlanId: 11,
      depositPaymentId: "shared",
      balancePaymentId: "balance_1",
    },
    {
      id: 2,
      sessionPlanId: 11,
      depositPaymentId: "shared",
      balancePaymentId: null,
    },
  ];
  expect(
    paymentSessions({ bookingId: null, stripePaymentId: "shared" }, rows).map(
      s => s.id
    )
  ).toEqual([1, 2]);
  expect(
    paymentSessions({ bookingId: 1, stripePaymentId: "balance_1" }, rows).map(
      s => s.id
    )
  ).toEqual([1]);
  expect(
    paymentSessions({ bookingId: null, stripePaymentId: "missing" }, rows)
  ).toEqual([]);
});
