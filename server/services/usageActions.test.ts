// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
const log = vi.hoisted(() => vi.fn());
vi.mock("./systemLogService", () => ({ createLog: log }));
import { protectedProcedure, router } from "../_core/trpc";
const testRouter = router({
  messages: router({
    send: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(({ input }) => {
        if (input.text === "fail") throw new Error("Rejected");
        return { success: true };
      }),
  }),
  system: router({
    addLog: protectedProcedure.mutation(() => ({ success: true })),
  }),
});
const caller = () =>
  testRouter.createCaller({
    user: { id: "client-1", role: "client" },
    req: {},
    res: {},
  } as any);
beforeEach(() => log.mockReset());
it("records only the approved action name and actor", async () => {
  await caller().messages.send({ text: "Private design content" });
  expect(log).toHaveBeenCalledWith({
    level: "info",
    category: "usage:action",
    message: "Send message",
    userId: "client-1",
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "Private design content"
  );
});
it("does not count rejected or untracked actions", async () => {
  await expect(caller().messages.send({ text: "fail" })).rejects.toThrow();
  await caller().system.addLog();
  expect(log).not.toHaveBeenCalled();
});
