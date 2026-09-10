import { describe, it, expect } from "vitest";
import { safeReturnPath } from "./auth-session";
describe("returning client destinations", () => {
  it("preserves a project or booking destination", () => {
    expect(safeReturnPath("/projects/42")).toBe("/projects/42");
    expect(safeReturnPath("/bookings")).toBe("/bookings");
  });
  it("rejects external redirects and unexpected paths", () => {
    for (const value of [
      null,
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/projects/42/../../login",
      "/login",
      "javascript:alert(1)",
      "/projects/42#token",
      "/unknown",
    ])
      expect(safeReturnPath(value)).toBeNull();
  });
});
