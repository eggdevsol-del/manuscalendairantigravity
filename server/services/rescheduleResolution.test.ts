// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import * as s from "../../drizzle/schema";
const m = vi.hoisted(() => ({
  request: {} as any,
  booking: {} as any,
  tx: {} as any,
  update: vi.fn(),
  message: vi.fn(),
  push: vi.fn(),
  overlap: vi.fn(),
  hours: vi.fn(),
  writes: [] as any[],
}));
vi.mock("./core", () => ({
  withDatabaseTransaction: async (fn: any) => {
    const saved = { ...m.request };
    try {
      return await fn(m.tx);
    } catch (e) {
      m.request = saved;
      throw e;
    }
  },
}));
vi.mock("./appointmentService", () => ({
  checkAppointmentOverlap: m.overlap,
  updateAppointment: m.update,
}));
vi.mock("./conversationService", () => ({ createMessage: m.message }));
vi.mock("./booking.service", () => ({
  parseWorkSchedule: () => [],
  validateAppointmentForWorkHours: m.hours,
}));
import { resolveReschedule } from "./rescheduleApproval";
beforeEach(() => {
  vi.clearAllMocks();
  m.writes = [];
  m.overlap.mockResolvedValue(false);
  m.hours.mockReturnValue({ valid: true });
  const terms = {
    oldStart: "2027-01-05T00:00:00Z",
    oldEnd: "2027-01-05T01:00:00Z",
    oldEstimateCents: 75000,
    paidCents: 20000,
    estimateCents: 100000,
    removedDiscountCents: 25000,
    itemId: 3,
    applicationId: 6,
    timeZone: "Australia/Brisbane",
  };
  m.request = {
    id: 1,
    artistId: "artist",
    clientId: "client",
    appointmentId: 4,
    conversationId: 9,
    status: "pending",
    expiresAt: "2027-01-01 00:00:00",
    startsAt: "2027-02-05 00:00:00",
    endsAt: "2027-02-05 01:00:00",
    termsJson: JSON.stringify(terms),
  };
  m.booking = {
    id: 4,
    sessionPlanId: 2,
    status: "confirmed",
    startTime: terms.oldStart,
    endTime: terms.oldEnd,
    totalExpectedAmountCents: 75000,
    totalPaidAmountCents: 20000,
  };
  m.tx = {
    query: {
      rescheduleRequests: { findFirst: async () => m.request },
      artistSettings: { findFirst: async () => ({ workSchedule: [] }) },
      paymentRequests: { findFirst: async () => null },
      offerApplications: {
        findFirst: async () => ({
          id: 6,
          status: "redeemed",
          quoteJson: JSON.stringify({
            items: [{ id: 3, estimateCents: 75000 }],
            totalEstimateCents: 75000,
            discountCents: 25000,
            amount: 25000,
          }),
        }),
      },
    },
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          for: async () =>
            table === s.rescheduleRequests
              ? [m.request]
              : table === s.appointments
                ? [m.booking]
                : [],
        }),
      }),
    }),
    update: (table: any) => ({
      set: (value: any) => ({
        where: async () => {
          m.writes.push({ table, value });
          if (table === s.rescheduleRequests) Object.assign(m.request, value);
        },
      }),
    }),
    insert: () => ({ values: m.push }),
  };
});
it("client acceptance changes the existing sitting and preserves credited payments", async () => {
  expect(await resolveReschedule(1, "client", "accept")).toEqual({
    status: "accepted",
  });
  expect(m.update).toHaveBeenCalledWith(
    4,
    expect.objectContaining({
      totalExpectedAmountCents: 100000,
      totalPaidAmountCents: 20000,
      remainingBalanceCents: 80000,
      startTime: "2027-02-05T00:00:00.000Z",
    }),
    "client"
  );
  expect(m.writes.some(w => w.table === s.sessionPlans)).toBe(true);
  expect(m.writes.some(w => w.table === s.offerApplications)).toBe(true);
  expect(JSON.parse(m.push.mock.calls[0][0].payloadJson).targetUserId).toBe(
    "artist"
  );
});
it("rejects acceptance from the artist or unrelated account", async () => {
  await expect(resolveReschedule(1, "artist", "accept")).rejects.toThrow();
  await expect(resolveReschedule(1, "other", "accept")).rejects.toThrow();
  expect(m.update).not.toHaveBeenCalled();
});
it("decline and expiry keep the original sitting unchanged", async () => {
  await resolveReschedule(1, "client", "decline");
  expect(m.update).not.toHaveBeenCalled();
  m.request.status = "pending";
  m.request.expiresAt = "2020-01-01 00:00:00";
  expect(await resolveReschedule(1, "client", "accept")).toEqual({
    status: "expired",
  });
  expect(m.update).not.toHaveBeenCalled();
});
it("repeated acceptance has no second price increase or notification", async () => {
  await resolveReschedule(1, "client", "accept");
  await resolveReschedule(1, "client", "accept");
  expect(m.update).toHaveBeenCalledOnce();
  expect(m.push).toHaveBeenCalledOnce();
});
it("rejects changed payments and unavailable dates", async () => {
  m.booking.totalPaidAmountCents = 30000;
  await expect(resolveReschedule(1, "client", "accept")).rejects.toThrow(
    "payments changed"
  );
  m.booking.totalPaidAmountCents = 20000;
  m.overlap.mockResolvedValue(true);
  await expect(resolveReschedule(1, "client", "accept")).rejects.toThrow(
    "no longer available"
  );
  expect(m.update).not.toHaveBeenCalled();
});
