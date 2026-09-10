// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ appointment: vi.fn(), messages: vi.fn() }));
vi.mock("../db", () => ({
  getAppointment: mocks.appointment,
  getMessages: mocks.messages,
  getDb: async () => null,
}));
import { appointmentsRouter } from "../routers/appointments";
const caller = (id: string) =>
  appointmentsRouter.createCaller({
    user: { id, role: "artist" },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.appointment.mockResolvedValue({
    id: 1,
    artistId: "artist",
    clientId: "client",
    conversationId: 12,
  });
  mocks.messages.mockResolvedValue([]);
});
describe("calendar proposal access", () => {
  it("rejects unrelated users before loading private conversation messages", async () => {
    await expect(
      caller("other").getProposalForAppointment(1)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.messages).not.toHaveBeenCalled();
  });
  it("allows the booking artist", async () => {
    await expect(
      caller("artist").getProposalForAppointment(1)
    ).resolves.toBeNull();
    expect(mocks.messages).toHaveBeenCalledWith(12);
  });
  it("handles a standalone appointment without querying a null conversation", async () => {
    mocks.appointment.mockResolvedValue({
      id: 1,
      artistId: "artist",
      clientId: "client",
      conversationId: null,
    });
    await expect(
      caller("artist").getProposalForAppointment(1)
    ).resolves.toBeNull();
    expect(mocks.messages).not.toHaveBeenCalled();
  });
});
