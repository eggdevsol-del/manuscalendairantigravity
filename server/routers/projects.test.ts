// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("../services/core", () => ({
  getDb: async () => ({
    query: {
      conversations: {
        findFirst: async () => ({
          id: 1,
          artistId: "artist",
          clientId: "client",
        }),
      },
    },
    select: read,
  }),
}));
import { projectsRouter } from "./projects";
import type { TrpcContext } from "../_core/context";
describe("project history authorization", () => {
  it("denies an unrelated account before reading payments or forms", async () => {
    const caller = projectsRouter.createCaller({
      user: { id: "outsider", role: "client" },
      req: {},
      res: {},
    } as TrpcContext);
    await expect(caller.summary({ conversationId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(read).not.toHaveBeenCalled();
  });
});
