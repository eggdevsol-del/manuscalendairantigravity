// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), persist: vi.fn() }));
vi.mock("./core", () => ({
  getDb: vi.fn(),
  withDatabaseTransaction: mocks.transaction,
}));
vi.mock("./projectNaming", () => ({ persistProjectName: mocks.persist }));
import { projectsRouter } from "../routers/projects";
const caller = (role = "artist") =>
  projectsRouter.createCaller({
    user: { id: "artist", role },
    req: {},
    res: {},
  } as any);
beforeEach(() => vi.clearAllMocks());
it("denies clients and merchants permission to rename projects", async () => {
  for (const role of ["client", "merchant"])
    await expect(
      caller(role).setProjectName({ sessionPlanId: 1, name: "Rose sleeve" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not update a project absent from the artist-owned query", async () => {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    for: async () => [],
  };
  mocks.transaction.mockImplementation(fn => fn({ select: () => chain }));
  await expect(
    caller().setProjectName({ sessionPlanId: 1, name: "Rose sleeve" })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.persist).not.toHaveBeenCalled();
});
