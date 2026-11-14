// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  conversation: null as any,
  tagInsert: vi.fn(),
  getPending: vi.fn(),
  confirm: vi.fn(),
  getMessageById: vi.fn(),
  getAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  logAction: vi.fn(),
  updateMetadata: vi.fn(),
  createMessage: vi.fn(),
  getArtistSettings: vi.fn(),
  getPolicies: vi.fn(),
  deletePolicy: vi.fn(),
  getButtons: vi.fn(),
  updateButton: vi.fn(),
  deleteButton: vi.fn(),
  sendTestPush: vi.fn(),
  clientConversations: [] as any[],
  clientAppointments: [] as any[],
  clientLeads: [] as any[],
  deleteForClient: vi.fn(),
  conversationDelete: vi.fn(),
}));
vi.mock("../db", () => ({
  getDb: async () => ({
    query: {
      conversations: {
        findFirst: async () => m.conversation,
        findMany: async () => m.clientConversations,
      },
      appointments: { findMany: async () => m.clientAppointments },
      leads: { findMany: async () => m.clientLeads },
      messageTags: { findFirst: async () => undefined },
    },
    insert: () => ({ values: m.tagInsert }),
    delete: () => ({ where: m.conversationDelete }),
  }),
  deleteAppointmentsForClient: m.deleteForClient,
  getPendingAppointmentsByConversation: m.getPending,
  confirmAppointments: m.confirm,
  getMessageById: m.getMessageById,
  getAppointment: m.getAppointment,
  updateAppointment: m.updateAppointment,
  logAppointmentAction: m.logAction,
  updateMessageMetadata: m.updateMetadata,
  createMessage: m.createMessage,
  getArtistSettings: m.getArtistSettings,
  getPolicies: m.getPolicies,
  deletePolicy: m.deletePolicy,
  getQuickActionButtons: m.getButtons,
  updateQuickActionButton: m.updateButton,
  deleteQuickActionButton: m.deleteButton,
}));
vi.mock("../services/pushService", () => ({
  sendTestPush: m.sendTestPush,
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

import { appointmentsRouter } from "./appointments";
import { policiesRouter } from "./policies";
import { quickActionsRouter } from "./quickActions";
import { messageTagsRouter } from "./messageTags";
import { pushRouter } from "./push";

const ctx = { user: { id: "artist", role: "artist" }, req: {}, res: {} } as any;
const theirs = { id: 3, artistId: "other-artist", clientId: "client" };
const mine = { id: 4, artistId: "artist", clientId: "client" };

beforeEach(() => {
  vi.clearAllMocks();
  m.conversation = theirs;
  m.clientConversations = [];
  m.clientAppointments = [];
  m.clientLeads = [];
  m.deleteForClient.mockResolvedValue(true);
  m.getPending.mockResolvedValue([{ id: 11, artistId: "other-artist" }]);
  m.getPolicies.mockResolvedValue([{ id: 7 }]);
  m.getButtons.mockResolvedValue([{ id: 7 }]);
  m.sendTestPush.mockResolvedValue({ success: true, results: [{}] });
});

describe("appointments ownership", () => {
  const caller = () => appointmentsRouter.createCaller(ctx);

  it("refuses to confirm a deposit in another artist's conversation", async () => {
    await expect(
      caller().confirmDeposit({ conversationId: 3 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.confirm).not.toHaveBeenCalled();
  });

  it("confirms a deposit in the caller's own conversation", async () => {
    m.conversation = mine;
    m.getPending.mockResolvedValue([{ id: 12, artistId: "artist" }]);
    await expect(
      caller().confirmDeposit({ conversationId: 4 })
    ).resolves.toEqual({ success: true, count: 1 });
    expect(m.confirm).toHaveBeenCalledWith(4, undefined);
  });

  it("refuses to confirm when a pending row in the caller's conversation is another artist's", async () => {
    m.conversation = mine;
    m.getPending.mockResolvedValue([
      { id: 12, artistId: "artist" },
      { id: 13, artistId: "other-artist" },
    ]);
    await expect(
      caller().confirmDeposit({ conversationId: 4 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.confirm).not.toHaveBeenCalled();
  });

  it("refuses availability for another artist's conversation", async () => {
    await expect(
      caller().findProjectAvailability({
        conversationId: 3,
        serviceName: "Sleeve",
        serviceDuration: 60,
        sittings: 1,
        price: 100,
        frequency: "weekly",
        startDate: new Date(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.getArtistSettings).not.toHaveBeenCalled();
  });

  it("refuses to revoke a proposal in another artist's conversation", async () => {
    m.getMessageById.mockResolvedValue({
      id: 9,
      conversationId: 3,
      senderId: "other-artist",
      messageType: "appointment_request",
      metadata: JSON.stringify({ appointmentIds: [11] }),
    });
    await expect(
      caller().deleteProposal({ messageId: 9 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.updateAppointment).not.toHaveBeenCalled();
    expect(m.updateMetadata).not.toHaveBeenCalled();
    expect(m.createMessage).not.toHaveBeenCalled();
  });

  it("only cancels the caller's sittings that belong to the proposal's conversation", async () => {
    m.conversation = mine;
    m.getMessageById.mockResolvedValue({
      id: 9,
      conversationId: 4,
      senderId: "artist",
      messageType: "appointment_request",
      metadata: JSON.stringify({ appointmentIds: [20, 21, 22, 23] }),
    });
    const rows: Record<number, any> = {
      20: { id: 20, artistId: "artist", conversationId: 4 },
      21: { id: 21, artistId: "other-artist", conversationId: 4 },
      22: { id: 22, artistId: "artist", conversationId: 99 },
    };
    m.getAppointment.mockImplementation(async (id: number) => rows[id]);
    await expect(caller().deleteProposal({ messageId: 9 })).resolves.toEqual({
      success: true,
      cancelledCount: 1,
    });
    expect(m.updateAppointment.mock.calls.map(call => call[0])).toEqual([20]);
    expect(m.logAction.mock.calls.map(call => call[0].appointmentId)).toEqual([
      20,
    ]);
    expect(m.updateMetadata).toHaveBeenCalledTimes(1);
  });

  it("cancels sittings whose ids were stored as strings", async () => {
    m.conversation = mine;
    m.getMessageById.mockResolvedValue({
      id: 9,
      conversationId: 4,
      senderId: "artist",
      messageType: "text",
      metadata: JSON.stringify({
        type: "project_proposal",
        appointmentIds: ["20", "abc", 1.5],
      }),
    });
    m.getAppointment.mockResolvedValue({
      id: 20,
      artistId: "artist",
      conversationId: 4,
    });
    await expect(caller().deleteProposal({ messageId: 9 })).resolves.toEqual({
      success: true,
      cancelledCount: 1,
    });
    expect(m.getAppointment.mock.calls).toEqual([[20]]);
    expect(m.updateAppointment.mock.calls.map(call => call[0])).toEqual([20]);
  });

  it.each([
    ["a client's message", { senderId: "client", messageType: "text" }],
    [
      "a client's message dressed up as a proposal",
      { senderId: "client", messageType: "appointment_request" },
    ],
    [
      "the artist's ordinary message",
      { senderId: "artist", messageType: "text" },
    ],
  ])("refuses to revoke %s", async (_label, fields) => {
    m.conversation = mine;
    m.getMessageById.mockResolvedValue({
      id: 9,
      conversationId: 4,
      metadata: JSON.stringify({ appointmentId: 20 }),
      ...fields,
    });
    await expect(
      caller().deleteProposal({ messageId: 9 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.updateAppointment).not.toHaveBeenCalled();
    expect(m.updateMetadata).not.toHaveBeenCalled();
    expect(m.createMessage).not.toHaveBeenCalled();
  });
});

describe("appointments.deleteAllForClient", () => {
  const caller = () => appointmentsRouter.createCaller(ctx);

  it("refuses a client who only belongs to another artist", async () => {
    m.clientConversations = [{ artistId: "other-artist" }];
    m.clientAppointments = [{ artistId: "other-artist" }];
    for (const deleteProfile of [true, false])
      await expect(
        caller().deleteAllForClient({ clientId: "client", deleteProfile })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.deleteForClient).not.toHaveBeenCalled();
    expect(m.conversationDelete).not.toHaveBeenCalled();
  });

  it("refuses a client id with no records at all", async () => {
    await expect(
      caller().deleteAllForClient({ clientId: "nobody", deleteProfile: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.deleteForClient).not.toHaveBeenCalled();
  });

  it("deletes the profile of a client only the caller deals with", async () => {
    m.clientConversations = [{ artistId: "artist" }];
    m.clientLeads = [{ artistId: "artist" }];
    await caller().deleteAllForClient({
      clientId: "client",
      deleteProfile: true,
    });
    expect(m.deleteForClient).toHaveBeenCalledWith("artist", "client", true);
    expect(m.conversationDelete).not.toHaveBeenCalled();
  });

  it.each([
    ["conversation", "clientConversations"],
    ["appointment", "clientAppointments"],
    ["lead", "clientLeads"],
  ] as const)(
    "only ever removes the caller's own link when the client has a %s with another artist",
    async (_label, key) => {
      m.clientAppointments = [{ artistId: "artist" }];
      m[key] = [...m[key], { artistId: "other-artist" }];
      await caller().deleteAllForClient({
        clientId: "client",
        deleteProfile: true,
      });
      // The service is scoped to the caller and never deletes an account, so
      // the router deletes nothing itself: a conversation delete here would
      // cascade into paid bookings.
      expect(m.deleteForClient).toHaveBeenCalledWith("artist", "client", true);
      expect(m.conversationDelete).not.toHaveBeenCalled();
    }
  );

  it("deletes only bookings when the profile is not asked for", async () => {
    m.clientAppointments = [{ artistId: "artist" }];
    await caller().deleteAllForClient({ clientId: "client" });
    expect(m.deleteForClient).toHaveBeenCalledWith("artist", "client", false);
    expect(m.conversationDelete).not.toHaveBeenCalled();
  });
});

describe("settings rows ownership", () => {
  it("refuses to delete another artist's policy", async () => {
    await expect(
      policiesRouter.createCaller(ctx).delete(8)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.getPolicies).toHaveBeenCalledWith("artist");
    expect(m.deletePolicy).not.toHaveBeenCalled();
  });

  it("deletes the caller's own policy", async () => {
    await policiesRouter.createCaller(ctx).delete(7);
    expect(m.deletePolicy).toHaveBeenCalledWith(7);
  });

  it("refuses to edit or delete another artist's quick action", async () => {
    const caller = quickActionsRouter.createCaller(ctx);
    await expect(caller.update({ id: 8, label: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.delete(8)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.updateButton).not.toHaveBeenCalled();
    expect(m.deleteButton).not.toHaveBeenCalled();
  });

  it("lets the owner edit and delete their quick action", async () => {
    const caller = quickActionsRouter.createCaller(ctx);
    await caller.update({ id: 7, enabled: false });
    await caller.delete(7);
    expect(m.updateButton).toHaveBeenCalledWith(7, { enabled: 0 });
    expect(m.deleteButton).toHaveBeenCalledWith(7);
  });
});

describe("message tags", () => {
  const caller = () => messageTagsRouter.createCaller(ctx);

  it("refuses to tag in a conversation the caller is not part of", async () => {
    await expect(
      caller().toggle({ messageId: 1, conversationId: 3, tag: "design" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.tagInsert).not.toHaveBeenCalled();
  });

  it("refuses a message from a different conversation", async () => {
    m.conversation = mine;
    m.getMessageById.mockResolvedValue({ id: 1, conversationId: 3 });
    await expect(
      caller().toggle({ messageId: 1, conversationId: 4, tag: "design" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.tagInsert).not.toHaveBeenCalled();
  });

  it("tags a message in the caller's own conversation", async () => {
    m.conversation = mine;
    m.getMessageById.mockResolvedValue({ id: 1, conversationId: 4 });
    await expect(
      caller().toggle({ messageId: 1, conversationId: 4, tag: "design" })
    ).resolves.toEqual({ tagged: true, tag: "design" });
  });
});

describe("push.test", () => {
  const caller = () => pushRouter.createCaller(ctx);

  it("refuses to push to another user", async () => {
    await expect(
      caller().test({ targetUserId: "client", title: "Hi", body: "Pay now" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.sendTestPush).not.toHaveBeenCalled();
  });

  it("accepts the caller's own id as the target", async () => {
    await expect(
      caller().test({ targetUserId: "artist", title: "Hi", body: "Yo" })
    ).resolves.toMatchObject({ success: true });
    expect(m.sendTestPush).toHaveBeenCalledWith("artist", "Hi", "Yo");
  });

  it("sends the test to the caller", async () => {
    await caller().test({ title: "Hi" });
    expect(m.sendTestPush).toHaveBeenCalledWith("artist", "Hi", undefined);
  });
});
