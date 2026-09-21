import { describe, expect, it } from "vitest";
import { availableSessionActions } from "./SessionActions";
const sitting = {
  id: 1,
  startsAt: "2026-09-10T00:00:00Z",
  endsAt: "2026-09-10T03:00:00Z",
  timeZone: "Australia/Brisbane",
  status: "confirmed",
  remainingCents: 45000,
};
describe("shared sitting action availability", () => {
  it("keeps completion and no-show unavailable before the sitting starts", () => {
    expect(
      availableSessionActions(sitting, new Date("2026-09-09T00:00:00Z"))
    ).toEqual(["reschedule", "cancel"]);
    expect(
      availableSessionActions(sitting, new Date("2026-09-10T01:00:00Z"))
    ).toEqual(["finish", "reschedule", "no-show", "cancel"]);
  });
  it("avoids duplicate payment requests and changes to settled or cancelled sittings", () => {
    expect(
      availableSessionActions({
        ...sitting,
        status: "completed",
        pendingRequest: { id: 2, amountCents: 45000, expiresAt: null },
      })
    ).toEqual([]);
    expect(
      availableSessionActions({
        ...sitting,
        status: "completed",
        remainingCents: 0,
      })
    ).toEqual([]);
    expect(
      availableSessionActions({ ...sitting, status: "cancelled" })
    ).toEqual([]);
    expect(
      availableSessionActions({ ...sitting, status: "completed" })
    ).toEqual(["finish"]);
  });
});
