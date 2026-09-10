// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
const mocks = vi.hoisted(() => ({
  existing: vi.fn(),
  compare: vi.fn(),
  generate: vi.fn(),
  update: vi.fn(),
  lead: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../db", () => ({
  getUserByEmail: mocks.existing,
  getDb: async () => ({
    query: { leads: { findFirst: mocks.lead } },
    update: mocks.update,
  }),
  createUser: mocks.create,
}));
vi.mock("../_core/auth-new", () => ({
  comparePassword: mocks.compare,
  generateToken: mocks.generate,
  hashPassword: vi.fn(),
  generateMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
}));
import { authRouter } from "../_core/auth-router";
const caller = authRouter.createCaller({ user: null, req: {}, res: {} } as any);
const token = () =>
  jwt.sign(
    { leadId: 12, email: "client@example.test", conversationId: 9 },
    process.env.JWT_SECRET || "your-secret-key-change-in-production"
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lead.mockResolvedValue({
    id: 12,
    clientEmail: "client@example.test",
    conversationId: 9,
  });
  mocks.existing.mockResolvedValue({
    id: "client",
    role: "client",
    password: "stored-hash",
  });
  mocks.compare.mockResolvedValue(false);
});
afterEach(() => vi.unstubAllGlobals());
describe("public booking account claim", () => {
  it("does not create an account after a failed Google exchange", async () => {
    mocks.existing.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }))
    );
    await expect(
      caller.claimLead({ leadToken: token(), googleAuthCode: "invalid-code" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects a Google account that does not match the booking email", async () => {
    mocks.existing.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "test-google-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            email: "someone-else@example.test",
            email_verified: true,
          }),
        })
    );
    await expect(
      caller.claimLead({
        leadToken: token(),
        googleAuthCode: "different-account",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("cannot use a booking submission to log into an existing email", async () => {
    await expect(
      caller.claimLead({ leadToken: token(), password: "wrong-password" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects passwordless claims against an existing account", async () => {
    await expect(
      caller.claimLead({ leadToken: token() })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects a token whose conversation no longer matches", async () => {
    mocks.lead.mockResolvedValue({
      id: 12,
      clientEmail: "client@example.test",
      conversationId: 10,
    });
    await expect(
      caller.claimLead({ leadToken: token(), password: "right-password" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not attach a client request to an artist account", async () => {
    mocks.existing.mockResolvedValue({
      id: "artist",
      role: "artist",
      password: "stored-hash",
    });
    mocks.compare.mockResolvedValue(true);
    await expect(
      caller.claimLead({ leadToken: token(), password: "right-password" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("issues a session only after checking the existing password", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.update.mockReturnValue({
      set: () => ({ where: async () => undefined }),
    });
    mocks.generate.mockReturnValue("authenticated-session");
    const result = await caller.claimLead({
      leadToken: token(),
      password: "right-password",
    });
    expect(mocks.compare).toHaveBeenCalledWith("right-password", "stored-hash");
    expect(result.token).toBe("authenticated-session");
  });
});
