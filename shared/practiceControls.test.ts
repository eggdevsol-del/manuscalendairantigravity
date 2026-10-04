import { describe, it, expect, vi, afterEach } from "vitest";
import { seedPractice, startPractice, previousPractice } from "./practice";
import {
  mutatePracticeControl,
  queryPracticeControl,
  practiceSessions,
  PRACTICE_REFERENCE,
} from "./practiceControls";
import { conversationMedia } from "../client/src/app-v3/data/messagePresentation";
afterEach(() => vi.useRealTimers());
describe("production controls connected to private practice state", () => {
  it("fails closed for unregistered provider and production operations", () => {
    const s = seedPractice();
    for (const path of [
      "auth.logout",
      "supplierOrders.sendToProvider",
      "upload.realProviderUpload",
      "billing.liveCharge",
    ])
      expect(() => mutatePracticeControl(s, path, {})).toThrow(
        "No live request"
      );
    expect(() => queryPracticeControl(s, "admin.users", {})).toThrow(
      "No live request"
    );
    expect(s.revision).toBe(0);
  });
  it("does not change revision when marking a mock conversation read", () => {
    const s = seedPractice();
    expect(
      mutatePracticeControl(s, "conversations.markAsRead", {
        conversationId: 1,
      }).state
    ).toEqual(s);
  });
  it("keeps another practice copy unchanged after a message", () => {
    const a = seedPractice(),
      b = seedPractice();
    const next = mutatePracticeControl(a, "messages.send", {
      content: "Where on your forearm?",
    });
    expect(next.state.messages.at(-1)?.text).toBe("Where on your forearm?");
    expect(a).toEqual(b);
    expect(next.state.revision).toBe(1);
  });
  it("derives message references from the same bundled media fixture", () => {
    const s = mutatePracticeControl(seedPractice(), "messages.send", {
      content: "Fixture reference",
      messageType: "image",
    }).state;
    const messages = queryPracticeControl(s, "messages.list", {});
    expect(conversationMedia(messages)).toEqual([PRACTICE_REFERENCE]);
    expect(
      queryPracticeControl(s, "projects.summary", {}).references[0].url
    ).toBe(PRACTICE_REFERENCE);
  });
  it("preserves every cent when a project has uneven sitting allocations", () => {
    const s = seedPractice();
    s.booking.dates = ["2026-10-05", "2026-10-12", "2026-10-19"];
    s.booking.price = 100001;
    s.booking.paid = 25001;
    s.booking.deposit = 25001;
    const rows = practiceSessions(s);
    expect(rows.reduce((n, r) => n + r.estimateCents, 0)).toBe(100001);
    expect(rows.reduce((n, r) => n + r.paidCents, 0)).toBe(25001);
    expect(rows.reduce((n, r) => n + r.remainingCents, 0)).toBe(75000);
  });
  it("uses canonical work windows and avoids the occupied full-day slot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
    const s = seedPractice("2026-10-05");
    const result = queryPracticeControl(s, "booking.checkAvailability", {
      startDate: "2026-10-05T00:00:00Z",
      serviceDuration: 480,
      sittings: 2,
      frequency: "consecutive",
      timeZone: "Australia/Brisbane",
    });
    expect(result.dates).toEqual([
      "2026-10-05T23:00:00.000Z",
      "2026-10-06T23:00:00.000Z",
    ]);
  });
  it("rejects a proposed sitting outside work hours without changing state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const s = seedPractice();
    const before = structuredClone(s);
    expect(() =>
      mutatePracticeControl(s, "sessionPlans.create", {
        serviceName: "Full day",
        sessions: [
          {
            startsAt: "2026-10-05T12:00:00Z",
            durationMinutes: 480,
            estimateCents: 100000,
            depositCents: 25000,
          },
        ],
      })
    ).toThrow("closing");
    expect(s).toEqual(before);
  });
  it("creates a structured proposal using the real booking payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const s = startPractice(seedPractice(), "enquiry");
    const result = mutatePracticeControl(s, "sessionPlans.create", {
      conversationId: 1,
      serviceName: "Full-day tattoo",
      sessions: [
        {
          startsAt: "2026-10-04T23:00:00Z",
          durationMinutes: 480,
          estimateCents: 100000,
          depositCents: 25000,
        },
      ],
    });
    expect(result.data.sessionPlanId).toBe(1);
    expect(result.state.booking.status).toBe("proposal sent");
    const message = queryPracticeControl(result.state, "messages.list", {}).at(
      -1
    );
    expect(message.messageType).toBe("session_plan");
    expect(JSON.parse(message.metadata).sessionPlanId).toBe(1);
    expect(previousPractice(result.state).booking).toEqual(s.booking);
  });
  it("rejects an invalid campaign without mutating existing records", () => {
    const s = seedPractice();
    expect(() =>
      mutatePracticeControl(s, "offers.save", { rules: { value: -1 } })
    ).toThrow();
    expect(s.sandbox).toBeUndefined();
  });
  it("simulates bank verification, payout schedule and disconnection without credentials", () => {
    let s = seedPractice();
    expect(
      queryPracticeControl(s, "artistSettings.getStripeConnectStatus", {})
        .connected
    ).toBe(false);
    s = mutatePracticeControl(s, "artistSettings.connectStripe", {}).state;
    expect(
      queryPracticeControl(s, "artistSettings.getStripeConnectStatus", {})
        .pendingVerification
    ).toBe(true);
    s = mutatePracticeControl(
      s,
      "artistSettings.submitStripeOnboarding",
      {}
    ).state;
    expect(
      queryPracticeControl(s, "artistSettings.getStripeConnectStatus", {})
        .payoutsEnabled
    ).toBe(true);
    s = mutatePracticeControl(s, "artistSettings.updatePayoutSchedule", {
      interval: "weekly",
      weeklyAnchor: "friday",
    }).state;
    expect(
      queryPracticeControl(s, "artistSettings.getPayoutSchedule", {})
        .weeklyAnchor
    ).toBe("friday");
    s = mutatePracticeControl(s, "artistSettings.disconnectStripe", {}).state;
    expect(
      queryPracticeControl(s, "artistSettings.getStripeConnectStatus", {})
        .connected
    ).toBe(false);
  });
});
