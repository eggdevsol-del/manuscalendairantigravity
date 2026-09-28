import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  conversation: vi.fn(),
  user: vi.fn(),
  verify: vi.fn(),
  issue: vi.fn(),
  select: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("../services/core", () => ({
  getDb: async () => ({
    query: {
      conversations: { findFirst: mock.conversation },
      users: { findFirst: mock.user },
      sessionPlans: { findFirst: mock.plan },
    },
    select: mock.select,
  }),
}));
vi.mock("../services/clientPortalToken", () => ({
  verifyPortalToken: mock.verify,
  issuePortalToken: mock.issue,
}));
vi.mock("./messages", () => ({ messagesRouter: { createCaller: vi.fn() } }));
vi.mock("../services/systemLogService", () => ({
  createLog: vi.fn(),
  sysLogger: {},
}));
import { clientPortalRouter } from "./clientPortal";
const caller = (role = "artist") =>
  clientPortalRouter.createCaller({
    user: { id: "artist-a", role } as any,
    req: {} as any,
    res: { setHeader: vi.fn() } as any,
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.verify.mockResolvedValue({ conversationId: 7, clientId: "client-a" });
});
describe("client portal access boundaries", () => {
  it("does not let clients issue access links", async () => {
    await expect(
      caller("client").createLink({ clientId: "client-a" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock.issue).not.toHaveBeenCalled();
  });
  it("requires an artist-owned client relationship before issuing", async () => {
    mock.conversation.mockResolvedValue(undefined);
    await expect(
      caller().createLink({ clientId: "other-client" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock.issue).not.toHaveBeenCalled();
  });
  it("rejects revoked relationships before reading records", async () => {
    mock.conversation.mockResolvedValue(undefined);
    await expect(
      caller().view({ token: "x".repeat(30) })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mock.select).not.toHaveBeenCalled();
  });
  it("rejects disabled accounts before reading records", async () => {
    mock.conversation.mockResolvedValue({
      id: 7,
      artistId: "artist-a",
      clientId: "client-a",
    });
    mock.user
      .mockResolvedValueOnce({ id: "client-a", role: "disabled_client" })
      .mockResolvedValueOnce({ id: "artist-a", role: "artist" });
    await expect(
      caller().view({ token: "x".repeat(30) })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mock.select).not.toHaveBeenCalled();
  });
});

describe("single-page portal permissions", () => {
  beforeEach(() => {
    mock.conversation.mockResolvedValue({
      id: 7,
      artistId: "artist-a",
      clientId: "client-a",
    });
    mock.user.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: "unused", role: "client" })
    );
    mock.user
      .mockResolvedValueOnce({ id: "client-a", role: "client" })
      .mockResolvedValueOnce({ id: "artist-a", role: "artist" });
    mock.plan.mockResolvedValue(undefined);
  });
  it("rejects a proposal outside the link's relationship", async () => {
    await expect(
      caller().plan({ token: "x".repeat(30), planId: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock.plan).toHaveBeenCalledOnce();
  });
  it("cannot accept a proposal outside the link's relationship", async () => {
    await expect(
      caller().acceptPlan({ token: "x".repeat(30), planId: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("cannot sign an unrelated form", async () => {
    mock.select.mockReturnValue({
      from: () => ({ innerJoin: () => ({ where: async () => [] }) }),
    });
    await expect(
      caller().signForm({
        token: "x".repeat(30),
        formId: 99,
        signature: "test",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
