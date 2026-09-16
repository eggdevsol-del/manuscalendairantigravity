// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  getConversationById: vi.fn(),
  getMessages: vi.fn(),
}));
vi.mock("../db", () => mock);
import { messagesRouter } from "./messages";
const caller = (id: string) =>
  messagesRouter.createCaller({ user: { id }, req: {}, res: {} } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mock.getConversationById.mockResolvedValue({
    artistId: "artist",
    clientId: "client",
  });
  mock.getMessages.mockResolvedValue([{ id: 2 }, { id: 1 }]);
});
it("authorizes older pages before touching message data", async () => {
  await expect(
    caller("stranger").list({
      conversationId: 12,
      before: { id: 3, createdAt: "2026-09-16 00:00:00" },
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mock.getMessages).not.toHaveBeenCalled();
});
it("passes a validated cursor and returns chronological rows", async () => {
  const before = { id: 3, createdAt: "2026-09-16 00:00:00" };
  await expect(
    caller("client").list({ conversationId: 12, limit: 100, before })
  ).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  expect(mock.getMessages).toHaveBeenCalledWith(12, 100, before);
});
it("rejects unbounded page requests", async () => {
  await expect(
    caller("artist").list({ conversationId: 12, limit: 100000 })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
