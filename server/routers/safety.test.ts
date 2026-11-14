// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, MySqlTable } from "drizzle-orm/mysql-core";
const m = vi.hoisted(() => ({
  conversation: null as any,
  message: null as any,
  recent: 0,
  exists: true,
  blocked: false,
  blockedByMe: false,
  createReport: vi.fn(),
  addBlock: vi.fn(),
  removeBlock: vi.fn(),
  listBlocks: vi.fn(),
  sendEmail: vi.fn(),
  createMessage: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("../services/core", () => ({
  getDb: async () => ({}),
  withDatabaseTransaction: async (work: any) => work(),
}));
vi.mock("../db", () => ({
  getConversationById: async () => m.conversation,
  getMessageById: async () => m.message,
  createMessage: m.createMessage,
  getDb: async () => ({ insert: () => ({ values: m.queue }) }),
  getConsultationsForUser: async () => [],
}));
vi.mock("../services/email", () => ({ sendEmail: m.sendEmail }));
vi.mock("../services/safety", () => ({
  userExists: async () => m.exists,
  reportsInLastDay: async () => m.recent,
  createReport: m.createReport,
  addBlock: m.addBlock,
  removeBlock: m.removeBlock,
  listBlocks: m.listBlocks,
  messagingBlocked: async () => m.blocked,
  hasBlocked: async () => m.blockedByMe,
}));
import { safetyRouter } from "./safety";
import { messagesRouter } from "./messages";
import * as schema from "../../drizzle/schema";
import { REPORTS_PER_DAY, SAFETY_CONTACT } from "../../shared/safety";

const as = (id: string | null, role = "client") =>
  safetyRouter.createCaller({
    user: id ? { id, role, name: "Person" } : null,
    req: {},
    res: {},
  } as any);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  m.conversation = { id: 9, artistId: "artist", clientId: "client" };
  m.message = { id: 44, conversationId: 9, senderId: "artist" };
  m.recent = 0;
  m.exists = true;
  m.blocked = false;
  m.blockedByMe = false;
  m.createReport.mockResolvedValue(71);
  m.sendEmail.mockResolvedValue(undefined);
  m.listBlocks.mockResolvedValue([]);
});

describe("report", () => {
  it("requires sign-in", async () => {
    await expect(
      as(null).report({ reportedUserId: "artist", reason: "hate" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(m.createReport).not.toHaveBeenCalled();
  });

  it("stores a conversation report against the other participant and alerts support", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "support@example.test");
    const result = await as("client").report({
      conversationId: 9,
      // A caller cannot point a conversation report at someone else.
      reportedUserId: "somebody-else",
      reason: "harassment",
      details: "  Keeps sending abuse.  ",
    });
    expect(result).toEqual({ received: true });
    expect(m.createReport.mock.calls[0][1]).toEqual({
      reporterId: "client",
      reportedUserId: "artist",
      conversationId: 9,
      messageId: null,
      artistSlug: null,
      reason: "harassment",
      details: "Keeps sending abuse.",
    });
    const [email, key] = m.sendEmail.mock.calls[0];
    expect(email.to).toBe("support@example.test");
    expect(email.subject).toContain("#71");
    expect(email.body).toContain("Conversation: 9");
    expect(key).toBe("user-report-71");
  });

  it("falls back to the published contact address when SUPPORT_EMAIL is not set", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    await as("client").report({ reportedUserId: "artist", reason: "scam" });
    expect(m.sendEmail.mock.calls[0][0].to).toBe(SAFETY_CONTACT);
  });

  it("takes the conversation from a reported message", async () => {
    await as("client").report({ messageId: 44, reason: "sexual_content" });
    expect(m.createReport.mock.calls[0][1]).toMatchObject({
      conversationId: 9,
      messageId: 44,
      reportedUserId: "artist",
    });
  });

  it("refuses a conversation the reporter is not part of", async () => {
    await expect(
      as("stranger").report({ conversationId: 9, reason: "hate" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.createReport).not.toHaveBeenCalled();
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a message from a conversation the reporter is not part of", async () => {
    await expect(
      as("stranger").report({ messageId: 44, reason: "hate" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.createReport).not.toHaveBeenCalled();
  });

  it("refuses a message that does not belong to the named conversation", async () => {
    m.message = { id: 44, conversationId: 10, senderId: "artist" };
    await expect(
      as("client").report({ conversationId: 9, messageId: 44, reason: "hate" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.createReport).not.toHaveBeenCalled();
  });

  it("stores a public profile report with the slug", async () => {
    await as("client").report({
      reportedUserId: "artist",
      artistSlug: "inkbyjo",
      reason: "underage",
    });
    expect(m.createReport.mock.calls[0][1]).toMatchObject({
      reportedUserId: "artist",
      artistSlug: "inkbyjo",
      conversationId: null,
    });
  });

  it("needs something to report, and not yourself", async () => {
    await expect(
      as("client").report({ reason: "other" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as("client").report({ reportedUserId: "client", reason: "other" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.createReport).not.toHaveBeenCalled();
  });

  it("refuses details over 1000 characters and unknown reasons", async () => {
    await expect(
      as("client").report({
        reportedUserId: "artist",
        reason: "other",
        details: "x".repeat(1001),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as("client").report({ reportedUserId: "artist", reason: "rude" as any })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("limits reports per person per day with a readable message", async () => {
    m.recent = REPORTS_PER_DAY - 1;
    await as("client").report({ reportedUserId: "artist", reason: "scam" });
    expect(m.createReport).toHaveBeenCalledOnce();
    m.recent = REPORTS_PER_DAY;
    await expect(
      as("client").report({ reportedUserId: "artist", reason: "scam" })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("24 hours"),
    });
    expect(m.createReport).toHaveBeenCalledOnce();
  });

  it("still succeeds when the alert email fails or cannot be sent", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.sendEmail.mockRejectedValueOnce(new Error("resend down"));
    await expect(
      as("client").report({ reportedUserId: "artist", reason: "scam" })
    ).resolves.toEqual({ received: true });
    m.sendEmail.mockImplementationOnce(() => {
      throw new Error("Email delivery is unavailable.");
    });
    await expect(
      as("client").report({ reportedUserId: "artist", reason: "scam" })
    ).resolves.toEqual({ received: true });
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    error.mockRestore();
  });
});

describe("block and unblock", () => {
  it("blocks another person", async () => {
    await expect(
      as("artist", "artist").block({ userId: "client" })
    ).resolves.toEqual({
      blocked: true,
    });
    expect(m.addBlock.mock.calls[0].slice(1)).toEqual(["artist", "client"]);
  });
  it("cannot block yourself", async () => {
    await expect(
      as("client").block({ userId: "client" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You can’t block yourself.",
    });
    expect(m.addBlock).not.toHaveBeenCalled();
  });
  it("answers the same for an id that is not a person, and stores nothing", async () => {
    m.exists = false;
    await expect(as("client").block({ userId: "ghost" })).resolves.toEqual({
      blocked: true,
    });
    expect(m.addBlock).not.toHaveBeenCalled();
    await expect(
      as("client").report({ reportedUserId: "ghost", reason: "scam" })
    ).resolves.toEqual({ received: true });
    expect(m.createReport).not.toHaveBeenCalled();
    expect(m.sendEmail).not.toHaveBeenCalled();
  });
  it("unblocks only the caller's own block", async () => {
    await as("client").unblock({ userId: "artist" });
    expect(m.removeBlock.mock.calls[0].slice(1)).toEqual(["client", "artist"]);
  });
  it("lists only the caller's own blocks", async () => {
    m.listBlocks.mockResolvedValue([{ userId: "artist", name: "Jo" }]);
    await expect(as("client").myBlocks()).resolves.toEqual([
      { userId: "artist", name: "Jo" },
    ]);
    expect(m.listBlocks.mock.calls[0][1]).toBe("client");
  });
  it("requires sign-in", async () => {
    await expect(as(null).block({ userId: "client" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(as(null).myBlocks()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("conversationStatus", () => {
  it("tells the blocked person only that messaging is off", async () => {
    m.blocked = true;
    m.blockedByMe = false;
    await expect(
      as("client").conversationStatus({ conversationId: 9 })
    ).resolves.toEqual({
      otherUserId: "artist",
      blockedByMe: false,
      messagingBlocked: true,
      message: "You can’t message this person.",
    });
  });
  it("is closed to people outside the conversation", async () => {
    await expect(
      as("stranger").conversationStatus({ conversationId: 9 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("messages.send when blocked", () => {
  const send = (id: string) =>
    messagesRouter
      .createCaller({ user: { id, role: id, name: "Person" } } as any)
      .send({ conversationId: 9, content: "Hello", messageType: "text" });

  for (const sender of ["artist", "client"])
    it(`refuses the ${sender} with the same neutral message and queues no notification`, async () => {
      m.blocked = true;
      await expect(send(sender)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "You can’t message this person.",
      });
      expect(m.createMessage).not.toHaveBeenCalled();
      expect(m.queue).not.toHaveBeenCalled();
    });
});

describe("messages.send when nobody is blocked", () => {
  it("sends and queues the notification as before", async () => {
    m.createMessage.mockResolvedValue({ id: 5 });
    await messagesRouter
      .createCaller({ user: { id: "client", role: "client" } } as any)
      .send({ conversationId: 9, content: "Hello", messageType: "text" });
    expect(m.createMessage).toHaveBeenCalledOnce();
    expect(JSON.parse(m.queue.mock.calls[0][0].payloadJson).targetUserId).toBe(
      "artist"
    );
  });
});

describe("schema", () => {
  it("never cascades a user deletion into reports", () => {
    const keys = getTableConfig(schema.userReports).foreignKeys;
    expect(keys.length).toBe(2);
    for (const key of keys) {
      expect(key.reference().foreignTable).toBe(schema.users);
      expect(key.onDelete).toBe("set null");
    }
    expect(is(schema.userBlocks, MySqlTable)).toBe(true);
    expect(
      getTableConfig(schema.userBlocks).primaryKeys[0].columns.map(c => c.name)
    ).toEqual(["blockerId", "blockedId"]);
  });
});
