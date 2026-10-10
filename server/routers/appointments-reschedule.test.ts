// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  appointment: {} as any,
  update: vi.fn(),
  message: vi.fn(),
  overlap: vi.fn(),
  insert: vi.fn(),
  hours: vi.fn(),
  offer: {} as any,
}));
vi.mock("../db", () => ({
  getAppointment: async () => m.appointment,
  getArtistSettings: async () => ({ workSchedule: [] }),
  updateAppointment: m.update,
  createMessage: m.message,
  checkAppointmentOverlap: m.overlap,
}));
vi.mock("../services/booking.service", () => ({
  parseWorkSchedule: () => [],
  validateAppointmentForWorkHours: m.hours,
}));
vi.mock("../services/core", () => ({
  withDatabaseTransaction: async (fn: any) =>
    fn({
      select: () => ({
        from: () => ({ where: () => ({ for: async () => [] }) }),
      }),
      query: {
        offerApplications: {
          findFirst: async () => ({
            id: 1,
            offerId: 7,
            originalJson: JSON.stringify({
              items: [{ id: 2, estimateCents: 100000 }],
            }),
            quoteJson: JSON.stringify({
              items: [{ id: 2, estimateCents: 75000 }],
            }),
          }),
        },
        sessionPlanItems: { findFirst: async () => ({ id: 2 }) },
        clientOffers: { findFirst: async () => m.offer },
      },
      insert: () => ({ values: m.insert }),
    }),
}));
import { appointmentsRouter } from "./appointments";
const input = {
  appointmentId: 4,
  newStartTime: "2027-02-02T23:00:00Z",
  newEndTime: "2027-02-03T00:00:00Z",
};
const caller = () =>
  appointmentsRouter.createCaller({
    user: { id: "artist", role: "artist" },
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  m.appointment = {
    id: 4,
    artistId: "artist",
    clientId: "client",
    conversationId: 9,
    sessionPlanId: 3,
    sessionIndex: 2,
    status: "confirmed",
    totalExpectedAmountCents: 75000,
    totalPaidAmountCents: 20000,
    timeZone: "Australia/Brisbane",
    startTime: "2027-01-04T23:00:00Z",
    endTime: "2027-01-05T00:00:00Z",
  };
  m.overlap.mockResolvedValue(false);
  m.hours.mockReturnValue({ valid: true });
  m.offer = {
    rulesJson: JSON.stringify({
      name: "January",
      kind: "discount",
      valueType: "percentage",
      value: 10,
      currency: "AUD",
      expiresAt: "2026-01-01T00:00:00Z",
      sittingMonths: ["2027-01"],
      sittingFrom: null,
      sittingUntil: null,
    }),
  };
});
it("previews revised terms without changing the appointment or sending messages", async () => {
  expect(await caller().reschedule(input)).toMatchObject({
    requiresApproval: true,
    success: false,
    terms: { removedDiscountCents: 25000 },
  });
  expect(m.update).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});
it("keeps confirmed pricing with explicit override and queues a client push", async () => {
  await caller().reschedule({ ...input, allowOutsideOfferDates: true });
  expect(m.update).toHaveBeenCalledWith(
    4,
    { startTime: input.newStartTime, endTime: input.newEndTime },
    "artist"
  );
  expect(m.message.mock.calls[0][0].content).toContain("Sitting 2");
  const job = m.insert.mock.calls[0][0];
  expect(job.eventType).toBe("push_message");
  expect(JSON.parse(job.payloadJson)).toMatchObject({
    targetUserId: "client",
    data: { appointmentId: 4 },
  });
});
it("rejects an occupied slot before any write", async () => {
  m.overlap.mockResolvedValue(true);
  await expect(caller().reschedule(input)).rejects.toThrow("already booked");
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects disabled work hours even with a promotion override", async () => {
  m.hours.mockReturnValue({ valid: false, reason: "Work day disabled" });
  await expect(
    caller().reschedule({ ...input, allowOutsideOfferDates: true })
  ).rejects.toThrow("disabled");
  expect(m.update).not.toHaveBeenCalled();
});
it("allows a confirmed sitting within eligible months after campaign expiry", async () => {
  m.offer.rulesJson = JSON.stringify({
    ...JSON.parse(m.offer.rulesJson),
    sittingMonths: ["2027-02"],
  });
  await caller().reschedule(input);
  expect(m.update).toHaveBeenCalledOnce();
  expect(m.insert).toHaveBeenCalledOnce();
});
it("does not queue notification when saving the conversation message fails", async () => {
  m.message.mockRejectedValueOnce(new Error("message failed"));
  await expect(
    caller().reschedule({ ...input, allowOutsideOfferDates: true })
  ).rejects.toThrow("message failed");
  expect(m.insert).not.toHaveBeenCalled();
});

it("rejects an unchanged sitting without recording or notifying a reschedule", async () => {
  await expect(caller().reschedule({ appointmentId: 4, newStartTime: new Date(m.appointment.startTime).toISOString(), newEndTime: new Date(m.appointment.endTime).toISOString() })).rejects.toThrow("Choose a different date or time");
  expect(m.update).not.toHaveBeenCalled();
  expect(m.message).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});
