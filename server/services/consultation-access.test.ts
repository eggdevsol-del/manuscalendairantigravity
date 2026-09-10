// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ conversation: {} as any, update: vi.fn() }));
vi.mock("../db", () => ({
  getConsultationsForUser: async () => [
    { id: 1, artistId: "artist", clientId: "client" },
  ],
  getConsultation: async () => ({
    id: 1,
    artistId: "artist",
    clientId: "client",
  }),
  getUser: async (id: string) => ({
    id,
    name: id,
    role: id,
    password: "secret-hash",
    email: "private@example.test",
    signature: "private-signature",
  }),
  getConversationById: async () => mocks.conversation,
  updateConsultation: mocks.update,
}));
import { consultationsRouter } from "../routers/consultations";
const caller = () =>
  consultationsRouter.createCaller({
    user: { id: "artist", role: "artist" },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.conversation = { id: 3, artistId: "artist", clientId: "client" };
});
describe("consultation data boundaries", () => {
  it("returns only public participant fields", async () => {
    const result = await caller().list();
    for (const person of [result[0].artist, result[0].client]) {
      expect(person).not.toHaveProperty("password");
      expect(person).not.toHaveProperty("signature");
      expect(person).not.toHaveProperty("email");
    }
  });
  it("cannot attach an unrelated conversation", async () => {
    mocks.conversation.clientId = "another-client";
    await expect(
      caller().update({ id: 1, conversationId: 3 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("allows the consultation’s own conversation", async () => {
    await caller().update({ id: 1, conversationId: 3 });
    expect(mocks.update).toHaveBeenCalledWith(1, { conversationId: 3 });
  });
});
