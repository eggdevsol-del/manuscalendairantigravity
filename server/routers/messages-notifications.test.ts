// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  insert: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../services/core", () => ({
  withDatabaseTransaction: async (fn: any) => {
    m.transaction();
    return fn();
  },
}));
vi.mock("../db", () => ({
  getConversationById: async () => ({ artistId: "artist", clientId: "client" }),
  createMessage: m.create,
  getDb: async () => ({ insert: () => ({ values: m.insert }) }),
  getConsultationsForUser: async () => [],
}));
import { messagesRouter } from "./messages";
beforeEach(() => {
  vi.clearAllMocks();
  m.create.mockResolvedValue({ id: 123 });
  m.insert.mockResolvedValue([{ insertId: 1 }]);
});
for (const sender of ["artist", "client"])
  for (const message of [
    { messageType: "text", content: "Hello" },
    { messageType: "image", content: "https://example.com/image.webp" },
    {
      messageType: "system",
      content: JSON.stringify({
        type: "reference_grid",
        images: ["https://example.com/a.webp"],
      }),
    },
  ]) {
    it(`queues ${message.messageType} to the other participant when ${sender} sends`, async () => {
      await messagesRouter
        .createCaller({
          user: { id: sender, role: sender, name: "Person" },
        } as any)
        .send({ conversationId: 9, ...message } as any);
      const job = m.insert.mock.calls[0][0];
      const payload = JSON.parse(job.payloadJson);
      expect(payload.targetUserId).toBe(
        sender === "artist" ? "client" : "artist"
      );
      expect(payload.url).toBe("/chat/9");
      expect(payload.data.messageId).toBe(123);
      expect(m.transaction).toHaveBeenCalledOnce();
    });
  }
it("fails the send transaction if the durable push queue fails", async () => {
  m.insert.mockRejectedValueOnce(new Error("queue unavailable"));
  await expect(
    messagesRouter
      .createCaller({ user: { id: "client", role: "client" } } as any)
      .send({ conversationId: 9, content: "Hello", messageType: "text" })
  ).rejects.toThrow("queue unavailable");
});
