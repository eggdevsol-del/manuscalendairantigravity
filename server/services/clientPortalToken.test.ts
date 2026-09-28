// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { issuePortalToken, verifyPortalToken } from "./clientPortalToken";
const secret = "portal-test-secret-that-is-long-enough-123456";
afterEach(() => vi.unstubAllEnvs());
describe("private client portal links", () => {
  it("binds a link to one conversation and client", async () => {
    vi.stubEnv("JWT_SECRET", secret);
    expect(await verifyPortalToken(await issuePortalToken(42, "client-a"))).toEqual({ conversationId: 42, clientId: "client-a" });
  });
  it("rejects tampering and tokens intended for another audience", async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const token = await issuePortalToken(42, "client-a");
    await expect(verifyPortalToken(token + "tampered")).rejects.toThrow();
    const other = await new SignJWT({ conversationId: 42 }).setProtectedHeader({ alg: "HS256" }).setSubject("client-a").setIssuer("tattoi").setAudience("login").setExpirationTime("1h").sign(new TextEncoder().encode(secret));
    await expect(verifyPortalToken(other)).rejects.toThrow();
  });
  it("rejects expired links and missing signing secrets", async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const expired = await new SignJWT({ conversationId: 42 }).setProtectedHeader({ alg: "HS256" }).setSubject("client-a").setIssuer("tattoi").setAudience("tattoi-client-portal").setExpirationTime(1).sign(new TextEncoder().encode(secret));
    await expect(verifyPortalToken(expired)).rejects.toThrow();
    vi.stubEnv("JWT_SECRET", "");
    await expect(issuePortalToken(42, "client-a")).rejects.toThrow();
  });
});
