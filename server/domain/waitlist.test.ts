// @vitest-environment node
import { describe, it, expect } from "vitest";
import { assertOfferAvailable } from "./waitlist";
const now = new Date("2026-09-09T00:00:00Z");
const valid = {
  status: "offered",
  startsAt: "2026-09-10 00:00:00",
  expiresAt: "2026-09-09 12:00:00",
};
describe("waitlist offer deadlines", () => {
  it("accepts an unexpired offered time", () =>
    expect(() => assertOfferAvailable(valid, now)).not.toThrow());
  it("rejects the exact expiry boundary and expired or missing deadlines", () => {
    for (const expiresAt of [
      "2026-09-09 00:00:00",
      "2026-09-08 23:59:59",
      null,
    ])
      expect(() =>
        assertOfferAvailable({ ...valid, expiresAt }, now)
      ).toThrow();
  });
  it("rejects withdrawn, accepted and already-started offers", () => {
    for (const status of ["cancelled", "accepted", "waiting"])
      expect(() => assertOfferAvailable({ ...valid, status }, now)).toThrow();
    expect(() =>
      assertOfferAvailable({ ...valid, startsAt: "2026-09-08 00:00:00" }, now)
    ).toThrow();
  });
});
