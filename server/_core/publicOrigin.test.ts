import { afterEach, expect, it, vi } from "vitest";
import { publicOrigin } from "./publicOrigin";
import { getSessionCookieOptions } from "./cookies";
afterEach(() => vi.unstubAllEnvs());
it("requires an explicit public origin and rejects insecure production links", () => {
  expect(() => publicOrigin({})).toThrow("APP_URL");
  expect(() => publicOrigin({ APP_URL: "http://example.com", NODE_ENV: "production" })).toThrow("HTTPS");
  expect(publicOrigin({ APP_URL: "https://staging.example.com/" })).toBe("https://staging.example.com");
});
it("uses host-only cookies unless an applicable domain is explicitly configured", () => {
  vi.stubEnv("COOKIE_DOMAIN", "");
  const request = { hostname: "app.example.co.uk", protocol: "https", headers: {} } as any;
  expect(getSessionCookieOptions(request).domain).toBeUndefined();
  vi.stubEnv("COOKIE_DOMAIN", ".example.co.uk");
  expect(getSessionCookieOptions(request).domain).toBe(".example.co.uk");
  expect(getSessionCookieOptions({ ...request, hostname: "notexample.co.uk" }).domain).toBeUndefined();
});
