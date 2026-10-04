import { describe, it, expect, vi, afterEach } from "vitest";
import {
  seedPractice,
  startPractice,
  advancePractice,
  PRACTICE_CHAPTERS,
} from "./practice";
import {
  mutatePracticeControl as mutate,
  queryPracticeControl as query,
} from "./practiceControls";
afterEach(() => vi.useRealTimers());
describe("connected artist practice outcomes", () => {
  it("keeps checkout pending until simulated payment and consumes stock once", () => {
    let state = seedPractice();
    const input = { items: [{ variantId: 1, quantity: 3 }] };
    const first = mutate(state, "supplierOrders.createSupplierCheckout", input);
    state = first.state;
    const repeated = mutate(
      state,
      "supplierOrders.createSupplierCheckout",
      input
    );
    state = repeated.state;
    expect(repeated.data.orderId).toBe(first.data.orderId);
    expect(query(state, "supplierOrders.getSupplierOrders", {})).toHaveLength(
      1
    );
    expect(first.data.totalCents).toBe(
      first.data.subtotalCents +
        first.data.shippingCents +
        first.data.platformFeeCents
    );
    expect(
      query(state, "supplierOrders.getSupplierOrderStatus", { orderId: 1 })
        .success
    ).toBe(false);
    expect(
      query(state, "suppliers.getSupplierProducts", {})[0].variants[0]
        .inventoryCount
    ).toBe(10);
    state = mutate(state, "practice.completeExternal", {}).state;
    state = mutate(state, "practice.completeExternal", {}).state;
    expect(
      query(state, "supplierOrders.getSupplierOrderStatus", { orderId: 1 })
        .success
    ).toBe(true);
    expect(
      query(state, "suppliers.getSupplierProducts", {})[0].variants[0]
        .inventoryCount
    ).toBe(7);
    expect(
      query(state, "supplierOrders.getReorderRecommendations", {})[0].items[0]
        .quantity
    ).toBe(3);
  });
  it("rejects stock overflow and duplicate variants without creating an order", () => {
    const state = seedPractice();
    expect(() =>
      mutate(state, "supplierOrders.createSupplierCheckout", {
        items: [{ variantId: 1, quantity: 11 }],
      })
    ).toThrow("stock");
    expect(() =>
      mutate(state, "supplierOrders.createSupplierCheckout", {
        items: [
          { variantId: 1, quantity: 6 },
          { variantId: 1, quantity: 6 },
        ],
      })
    ).toThrow("duplicate");
    expect(state.sandbox).toBeUndefined();
  });
  it("records a refund once and updates the shared booking balance", () => {
    let state = seedPractice();
    const preview = query(state, "payouts.refundPreview", { ledgerId: 1 });
    state = mutate(state, "payouts.refundTransaction", {
      ledgerId: 1,
      expectedAmountCents: preview.amountCents,
    }).state;
    expect(state.booking.paid).toBe(0);
    expect(query(state, "payouts.earningsBreakdown", {}).netCents).toBe(0);
    expect(query(state, "projects.summary", {}).sessions[0].paidCents).toBe(0);
    expect(() =>
      mutate(state, "payouts.refundTransaction", {
        ledgerId: 1,
        expectedAmountCents: preview.amountCents,
      })
    ).toThrow("Review");
  });
  it("enforces studio permission branches and keeps invitations fictional", () => {
    let state = mutate(seedPractice(), "studios.createStudio", {
      name: "Practice studio",
    }).state;
    state = mutate(state, "practice.setStudioRole", { role: "artist" }).state;
    expect(() =>
      mutate(state, "studios.inviteArtist", {
        artistEmail: "demo@example.test",
        role: "artist",
      })
    ).toThrow("owner or manager");
    state = mutate(state, "practice.setStudioRole", { role: "manager" }).state;
    state = mutate(state, "studios.inviteArtist", {
      artistEmail: "demo@example.test",
      role: "artist",
    }).state;
    expect(query(state, "studios.getStudioMembers", {})).toHaveLength(2);
    expect(state.notifications.at(-1)).toContain("No email sent");
    expect(() =>
      mutate(state, "studios.removeMember", { userId: "practice-artist" })
    ).toThrow("themselves");
  });
  it("only completes confirmed client outcomes after their prerequisite", () => {
    let state = seedPractice();
    expect(() =>
      mutate(state, "practice.clientOutcome", { outcome: "deposit" })
    ).toThrow("proposal");
    state = mutate(state, "dashboard.requestPayment", {}).state;
    state = mutate(state, "practice.clientOutcome", {
      outcome: "balance",
    }).state;
    expect(state.booking.status).toBe("completed");
    expect(state.booking.paid).toBe(state.booking.price);
    expect(
      query(state, "projects.summary", {}).sessions[0].remainingCents
    ).toBe(0);
  });
  it("uses the selected sitting duration and rejects collisions when rescheduling", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    let state = mutate(seedPractice(), "sessionPlans.create", {
      serviceName: "Half day",
      sessions: [
        {
          startsAt: "2026-10-05T03:00:00Z",
          durationMinutes: 240,
          estimateCents: 60000,
          depositCents: 15000,
        },
        {
          startsAt: "2026-10-06T03:00:00Z",
          durationMinutes: 240,
          estimateCents: 60000,
          depositCents: 15000,
        },
      ],
    }).state;
    state = mutate(state, "practice.clientOutcome", {
      outcome: "deposit",
    }).state;
    expect(
      query(state, "projects.summary", {}).sessions[0].durationMinutes
    ).toBe(240);
    expect(() =>
      mutate(state, "appointments.reschedule", {
        appointmentId: 2,
        newStartTime: "2026-10-05T03:00:00Z",
      })
    ).toThrow("booked");
    state = mutate(state, "appointments.reschedule", {
      appointmentId: 2,
      newStartTime: "2026-10-07T03:00:00Z",
    }).state;
    expect(state.booking.status).toBe("confirmed");
    expect(query(state, "projects.summary", {}).sessions[1].startsAt).toBe(
      "2026-10-07T03:00:00.000Z"
    );
    expect(state.booking.dates).toEqual(["2026-10-05", "2026-10-07"]);
  });
  it("projects guided service changes into the real booking controls", () => {
    let state = startPractice(seedPractice(), "availability");
    const chapter = PRACTICE_CHAPTERS.find(c => c.id === "availability")!;
    const step = chapter.steps.find(s => s.id === "service-add")!;
    state.cursor = chapter.steps.indexOf(step);
    state = advancePractice(state, step.id, {
      name: "Mock custom service",
      duration: "120",
      price: "333",
      sittings: "1",
    });
    const settings = query(state, "artistSettings.get", {});
    expect(JSON.parse(settings.services).at(-1)).toMatchObject({
      name: "Mock custom service",
      duration: 120,
      price: 333,
    });
  });
  it("retains completed control progress across workflow chapters", () => {
    let state = mutate(seedPractice(), "practice.recordAction", {
      id: "example",
      label: "Create offer",
      screen: "/dashboard",
      kind: "mutation",
    }).state;
    state = startPractice(state, "promotion");
    expect(state.sandbox?.actionProgress.example.label).toBe("Create offer");
  });
});
