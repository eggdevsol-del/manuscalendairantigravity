import { describe, expect, it } from "vitest";
import { CLIENT_PORTAL_ENTRY, isClientPortalPath } from "./clientPortalRoute";
describe("portal entry routing", () => {
  it("uses an entry excluded from old service-worker navigation caches", () => {
    expect(CLIENT_PORTAL_ENTRY.startsWith("/api/")).toBe(true);
  });
  it.each(["/client-portal", "/client-portal/", "/api/client-portal", "/api/client-portal/"])("recognizes %s as public portal", path => expect(isClientPortalPath(path)).toBe(true));
  it.each(["/client-portal-artist", "/api/client-portal/other", "/artist-name", "/clients"])("does not misroute %s", path => expect(isClientPortalPath(path)).toBe(false));
});
