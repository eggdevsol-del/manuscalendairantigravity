// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  message: {} as any,
  appointment: {} as any,
  clientId: "client",
  writes: [] as any[],
}));
vi.mock("./core", () => ({
  withDatabaseTransaction: async (work: any) => {
    let read = 0;
    return work({
      select: () => ({
        from: () => ({
          where: () => ({
            for: async () =>
              ++read === 1 ? [fixture.message] : [fixture.appointment],
          }),
        }),
      }),
      query: {
        conversations: {
          findFirst: async () => ({
            clientId: fixture.clientId,
            artistId: "artist",
          }),
        },
      },
      update: () => ({
        set: (data: any) => ({ where: async () => fixture.writes.push(data) }),
      }),
    });
  },
}));
import { declineLegacyProposal } from "./declineLegacyProposal";
beforeEach(() => {
  fixture.clientId = "client";
  fixture.writes = [];
  fixture.message = {
    id: 71,
    conversationId: 12,
    metadata: JSON.stringify({
      type: "project_proposal",
      status: "pending",
      appointmentIds: [101],
    }),
  };
  fixture.appointment = {
    id: 101,
    conversationId: 12,
    artistId: "artist",
    clientId: "client",
    status: "pending",
    depositPaid: 0,
    totalPaidAmountCents: 0,
  };
});
describe("legacy proposal decline", () => {
  it("releases pending dates and records the decline", async () => {
    await declineLegacyProposal(71, "client");
    expect(fixture.writes[0]).toEqual({ status: "cancelled" });
    expect(JSON.parse(fixture.writes[1].metadata)).toMatchObject({
      status: "declined",
    });
  });
  it("does not let an unrelated user or artist decline for the client", async () => {
    await expect(declineLegacyProposal(71, "artist")).rejects.toThrow(
      "Only this client"
    );
    expect(fixture.writes).toEqual([]);
  });
  it.each([
    { depositPaid: 1 },
    { totalPaidAmountCents: 100 },
    { status: "confirmed" },
    { depositPaymentId: "pi_paid" },
  ])("does not cancel a progressed session: %j", async change => {
    Object.assign(fixture.appointment, change);
    await expect(declineLegacyProposal(71, "client")).rejects.toThrow(
      "already progressed"
    );
    expect(fixture.writes).toEqual([]);
  });
  it("rejects metadata referencing a different conversation", async () => {
    fixture.appointment.conversationId = 99;
    await expect(declineLegacyProposal(71, "client")).rejects.toThrow();
    expect(fixture.writes).toEqual([]);
  });
  it("makes a repeated decline harmless", async () => {
    fixture.message.metadata = JSON.stringify({
      type: "project_proposal",
      status: "declined",
    });
    await expect(declineLegacyProposal(71, "client")).resolves.toEqual({
      success: true,
    });
    expect(fixture.writes).toEqual([]);
  });
});
