import { describe, it, expect } from "vitest";
import { selectConsecutiveSlots, scheduleGapDays } from "./projectSchedule";
const dates = (days: number[]) =>
  days.map(
    day => new Date(`2027-01-${String(day).padStart(2, "0")}T00:00:00Z`)
  );
describe("consecutive project scheduling", () => {
  it("prefers a later complete run over earlier split dates", () =>
    expect(
      selectConsecutiveSlots(
        dates([1, 3, 6, 7, 8]),
        3,
        "Australia/Brisbane",
        true
      )
    ).toEqual(dates([6, 7, 8])));
  it("minimises breaks and gap length before choosing earliest finish", () =>
    expect(
      selectConsecutiveSlots(
        dates([1, 3, 5, 8, 9, 10, 12]),
        4,
        "Australia/Brisbane",
        true
      )
    ).toEqual(dates([8, 9, 10, 12])));
  it("does not silently split without a deadline", () =>
    expect(
      selectConsecutiveSlots(dates([1, 3, 5]), 3, "Australia/Brisbane", false)
    ).toEqual([]));
  it("rejects insufficient availability", () =>
    expect(selectConsecutiveSlots(dates([1, 2]), 3, "UTC", true)).toEqual([]));
  it("counts local calendar days across daylight saving, not elapsed hours", () =>
    expect(
      scheduleGapDays(
        "2027-03-13T15:00:00Z",
        "2027-03-14T14:00:00Z",
        "America/New_York"
      )
    ).toBe(0));
});
