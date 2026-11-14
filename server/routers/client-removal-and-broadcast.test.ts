// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  conversation: null as any,
  conversations: {} as Record<string, { id: number }>,
  preferences: [] as { userId: string; sms: number; push: number }[],
  related: [] as string[],
  relationships: vi.fn(),
  createAppointment: vi.fn(),
  createMessage: vi.fn(),
  createConversation: vi.fn(),
  overlap: vi.fn(),
  wipeAppointments: vi.fn(),
  wipeClients: vi.fn(),
  rawDelete: vi.fn(),
}));
const database = {
  select: () => ({ from: () => ({ where: async () => m.preferences }) }),
  delete: m.rawDelete,
  insert: () => ({ values: vi.fn() }),
};
vi.mock("../db", () => ({
  getDb: async () => database,
  getConversationById: async () => m.conversation,
  getConversation: async (_artistId: string, clientId: string) =>
    m.conversations[clientId],
  getArtistSettings: async () => null,
  checkAppointmentOverlap: m.overlap,
  createAppointment: m.createAppointment,
  generateRequiredForms: vi.fn(),
  createMessage: m.createMessage,
  createConversation: m.createConversation,
  deleteAllAppointmentsForArtist: m.wipeAppointments,
  deleteAllClientsForArtist: m.wipeClients,
}));
vi.mock("../services/core", () => ({
  getDb: async () => database,
  withDatabaseTransaction: async (work: (db: any) => unknown) => work(database),
}));
vi.mock("../services/pushService", () => ({ hasActiveSubscription: vi.fn() }));
vi.mock("../services/userService", () => ({
  getClientRelationships: m.relationships,
  shareStudio: vi.fn(),
}));
vi.mock("../services/artistTimezone", () => ({
  artistTimezone: async () => "Australia/Brisbane",
}));

import { appointmentsRouter } from "./appointments";
import { conversationsRouter } from "./conversations";

const as = (id: string, role: string) =>
  ({ user: { id, role }, req: {}, res: {} }) as any;
const sitting = {
  startTime: new Date("2030-03-04T00:00:00Z"),
  endTime: new Date("2030-03-04T02:00:00Z"),
  title: "Sleeve",
  serviceName: "Sleeve",
  price: 1,
  depositAmount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.conversation = { id: 4, artistId: "artist", clientId: "client" };
  m.conversations = {};
  m.preferences = [];
  m.overlap.mockResolvedValue(false);
  m.createAppointment.mockResolvedValue(undefined);
  m.relationships.mockImplementation(async () => ({
    related: new Set(m.related),
    unclaimed: new Set(),
  }));
});

describe("appointments.bookProject", () => {
  it("refuses the conversation's client, who would be naming their own price", async () => {
    await expect(
      appointmentsRouter
        .createCaller(as("client", "client"))
        .bookProject({ conversationId: 4, appointments: [sitting] })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Only the artist"),
    });
    expect(m.createAppointment).not.toHaveBeenCalled();
  });

  it("refuses an artist who is not the conversation's artist", async () => {
    await expect(
      appointmentsRouter
        .createCaller(as("other-artist", "artist"))
        .bookProject({ conversationId: 4, appointments: [sitting] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.createAppointment).not.toHaveBeenCalled();
  });

  it("rejects a negative price", async () => {
    await expect(
      appointmentsRouter.createCaller(as("artist", "artist")).bookProject({
        conversationId: 4,
        appointments: [{ ...sitting, price: -5 }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.createAppointment).not.toHaveBeenCalled();
  });

  it("still books for the conversation's artist", async () => {
    await appointmentsRouter.createCaller(as("artist", "artist")).bookProject({
      conversationId: 4,
      appointments: [sitting],
    });
    expect(m.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: "artist",
        clientId: "client",
        price: 1,
        status: "pending",
      })
    );
  });
});

describe("danger-zone wipes", () => {
  it("hands both wipes to the guarded service and deletes nothing itself", async () => {
    m.wipeAppointments.mockRejectedValue(new Error("Nothing was deleted"));
    m.wipeClients.mockResolvedValue({ success: true });
    await expect(
      appointmentsRouter
        .createCaller(as("artist", "artist"))
        .deleteAllForArtist()
    ).rejects.toThrow("Nothing was deleted");
    await conversationsRouter
      .createCaller(as("artist", "artist"))
      .deleteAllClientsForArtist();
    expect(m.wipeAppointments).toHaveBeenCalledWith("artist");
    expect(m.wipeClients).toHaveBeenCalledWith("artist");
    expect(m.rawDelete).not.toHaveBeenCalled();
  });

  it("is not open to clients", async () => {
    await expect(
      conversationsRouter
        .createCaller(as("client", "client"))
        .deleteAllClientsForArtist()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appointmentsRouter
        .createCaller(as("client", "client"))
        .deleteAllForArtist()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.wipeClients).not.toHaveBeenCalled();
    expect(m.wipeAppointments).not.toHaveBeenCalled();
  });
});

describe("conversations.bulkMessageClients", () => {
  const send = (clientIds: string[]) =>
    conversationsRouter
      .createCaller(as("artist", "artist"))
      .bulkMessageClients({ clientIds, messageContent: "Flash day Friday" });

  it("skips people who have a conversation with the artist but are not their client", async () => {
    m.related = ["mia"];
    m.conversations = { mia: { id: 1 }, stranger: { id: 2 } };
    const result = await send(["mia", "stranger", "mia"]);
    expect(m.relationships).toHaveBeenCalledWith(database, "artist", [
      "mia",
      "stranger",
    ]);
    expect(result).toMatchObject({
      count: 1,
      skipped: 1,
      optedOut: 0,
      notClients: 1,
    });
    expect(m.createConversation).not.toHaveBeenCalled();
    expect(m.createMessage).toHaveBeenCalledTimes(1);
    expect(m.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 1, senderId: "artist" })
    );
  });

  it("skips clients who have promotions switched off", async () => {
    m.related = ["mia", "unsubscribed", "push-on"];
    m.conversations = {
      mia: { id: 1 },
      unsubscribed: { id: 2 },
      "push-on": { id: 3 },
    };
    m.preferences = [
      { userId: "unsubscribed", sms: 0, push: 0 },
      { userId: "push-on", sms: 0, push: 1 },
    ];
    const result = await send(["mia", "unsubscribed", "push-on"]);
    expect(result).toMatchObject({
      count: 2,
      skipped: 1,
      optedOut: 1,
      notClients: 0,
    });
    expect(
      m.createMessage.mock.calls.map(([message]) => message.conversationId)
    ).toEqual([1, 3]);
  });

  it("opens a chat for a client who has none yet, and never for a stranger", async () => {
    // Related through a lead, consultation or plan, with no conversation row.
    m.related = ["lead-only"];
    m.createConversation.mockResolvedValue({ id: 9 });
    const result = await send(["lead-only", "stranger"]);
    expect(m.createConversation).toHaveBeenCalledTimes(1);
    expect(m.createConversation).toHaveBeenCalledWith({
      artistId: "artist",
      clientId: "lead-only",
    });
    expect(m.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 9, senderId: "artist" })
    );
    expect(result).toMatchObject({ count: 1, skipped: 1, notClients: 1 });
  });

  it("does not open a chat for a client who has promotions switched off", async () => {
    m.related = ["unsubscribed"];
    m.preferences = [{ userId: "unsubscribed", sms: 0, push: 0 }];
    const result = await send(["unsubscribed"]);
    expect(m.createConversation).not.toHaveBeenCalled();
    expect(result).toMatchObject({ count: 0, optedOut: 1, notClients: 0 });
  });
});
