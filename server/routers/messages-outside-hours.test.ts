// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ appointment: vi.fn() }));
vi.mock("../services/core", () => ({
  withDatabaseTransaction: async (fn: any) => fn(),
}));
vi.mock("../services/safety", () => ({
  messagingBlocked: async () => false,
}));
vi.mock("../db", () => ({
  getConversationById: async () => ({ artistId: "artist", clientId: "client" }),
  getArtistSettings: async () => ({
    timeZone: "Australia/Brisbane",
    workSchedule: JSON.stringify({
      monday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    }),
  }),
  getArtistCalendar: async () => [],
  createAppointment: m.appointment,
  createMessage: async () => ({ id: 1 }),
  getDb: async () => ({ insert: () => ({ values: async () => [] }) }),
  getConsultationsForUser: async () => [],
}));
import { messagesRouter } from "./messages";
import { outsideHoursFromError } from "../../shared/businessHours";
// Sunday 2027-02-07, 11:00 pm in Brisbane, three hours.
const start = "2027-02-07T13:00:00.000Z";
const key = `${start}/2027-02-07T16:00:00.000Z`;
const send = (user: string, confirmedOutsideHours?: string[]) =>
  messagesRouter
    .createCaller({ user: { id: user, role: user, name: "Person" } } as any)
    .send({
      conversationId: 9,
      content: "Proposal",
      messageType: "appointment_request",
      metadata: JSON.stringify({
        status: "pending",
        dates: [start],
        serviceDuration: 180,
      }),
      confirmedOutsideHours,
    });
beforeEach(() => m.appointment.mockReset().mockResolvedValue({ id: 3 }));

it("holds an artist's proposed dates outside hours until each is confirmed", async () => {
  const error = await send("artist").catch(e => e);
  expect(outsideHoursFromError(error)).toMatchObject([
    { key, reason: "closed", day: "Sunday", sessionIndex: 1 },
  ]);
  expect(m.appointment).not.toHaveBeenCalled();
  await send("artist", [key]);
  expect(m.appointment).toHaveBeenCalledOnce();
});
it("refuses a client who sends a proposal, and holds no dates", async () => {
  await expect(send("client")).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(send("client", [key])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(m.appointment).not.toHaveBeenCalled();
});
