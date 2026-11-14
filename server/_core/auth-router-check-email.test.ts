// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUserByEmail: vi.fn() }));
vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<any>()),
  getUserByEmail: mocks.getUserByEmail,
}));
import { authRouter } from "./auth-router";

const check = (email: string) =>
  authRouter
    .createCaller({ req: {}, res: {}, user: null } as any)
    .checkEmailExists({ email });
const holder = {
  id: "user_1",
  name: "Private Person",
  email: "taken@example.test",
  phone: "+61400000000",
  role: "artist",
  password: "hash",
};
beforeEach(() => vi.clearAllMocks());

describe("auth.checkEmailExists", () => {
  it("answers with two booleans and nothing about the account holder", async () => {
    mocks.getUserByEmail.mockResolvedValue(holder);
    expect(await check("taken@example.test")).toEqual({
      exists: true,
      isFunnelClient: false,
    });
    mocks.getUserByEmail.mockResolvedValue({ ...holder, password: null });
    expect(await check("taken@example.test")).toEqual({
      exists: true,
      isFunnelClient: true,
    });
  });
  it("has the same shape for an unknown email", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    expect(await check("nobody@example.test")).toEqual({
      exists: false,
      isFunnelClient: false,
    });
  });
});
