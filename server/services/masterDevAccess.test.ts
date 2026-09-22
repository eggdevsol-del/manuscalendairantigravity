// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  accountEnabled,
  masterDevIdentity,
  masterDevSession,
} from "./masterDevAccess";
import { getAuthSecret } from "../_core/auth-secret";
afterEach(() => vi.unstubAllEnvs());
describe("private developer access", () => {
  it("requires both configured identity and exclusive role", () => {
    vi.stubEnv("MASTER_DEV_USER_ID", "owner");
    expect(masterDevIdentity({ id: "owner", role: "master_dev" })).toBe(true);
    for (const role of ["admin", "artist", "client", "merchant"])
      expect(masterDevIdentity({ id: "owner", role })).toBe(false);
    expect(masterDevIdentity({ id: "other", role: "master_dev" })).toBe(false);
    vi.stubEnv("MASTER_DEV_USER_ID", "");
    expect(masterDevIdentity({ id: "owner", role: "master_dev" })).toBe(false);
  });
  it("requires a fresh dedicated signed session, not an ordinary login", () => {
    vi.stubEnv("MASTER_DEV_USER_ID", "owner");
    const user = { id: "owner", role: "master_dev" };
    const token = (payload: object, expiresIn: number = 1800) =>
      "Bearer " + jwt.sign(payload, getAuthSecret(), { expiresIn });
    expect(
      masterDevSession(user, token({ userId: "owner", masterDev: true }))
    ).toBe(true);
    expect(masterDevSession(user, token({ userId: "owner" }))).toBe(false);
    expect(
      masterDevSession(user, token({ userId: "other", masterDev: true }))
    ).toBe(false);
    expect(
      masterDevSession(user, token({ userId: "owner", masterDev: true }, -1))
    ).toBe(false);
    expect(masterDevSession(user, "Bearer forged")).toBe(false);
  });
  it("blocks deactivated users regardless of their original role", () => {
    for (const role of ["artist", "client", "merchant", "studio"]) {
      expect(accountEnabled({ role })).toBe(true);
      expect(accountEnabled({ role: `disabled_${role}` })).toBe(false);
    }
    expect(accountEnabled(null)).toBe(false);
  });
});
