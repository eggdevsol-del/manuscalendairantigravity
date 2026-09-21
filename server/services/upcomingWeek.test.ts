import { describe, expect, it } from "vitest";
import { upcomingWeekWindow, upcomingSittings } from "./upcomingWeek";
describe("Today rolling week", () => {
  it("includes today and six following local dates across DST", () => {
    const window = upcomingWeekWindow(
      new Date("2026-10-02T20:00:00Z"),
      "Australia/Sydney"
    );
    expect(window.dates).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    expect(window.start).toBe("2026-10-02 14:00:00");
    expect(window.end).toBe("2026-10-09 13:00:00");
  });
  it("excludes unconfirmed/cancelled/completed, past and day-eight sittings; does not count deposits twice", () => {
    const base = {
      startTime: "2026-09-22 03:00:00",
      endTime: "2026-09-22 09:00:00",
      status: "confirmed",
      totalExpectedAmountCents: 200000,
      totalPaidAmountCents: 50000,
      remainingBalanceCents: 150000,
    };
    const result = upcomingSittings(
      [
        base,
        { ...base, status: "pending" },
        { ...base, status: "cancelled" },
        { ...base, status: "completed" },
        { ...base, endTime: "2026-09-21 00:00:00" },
        {
          ...base,
          startTime: "2026-09-28 14:00:00",
          endTime: "2026-09-29 00:00:00",
        },
      ],
      new Date("2026-09-22T00:00:00Z"),
      "Australia/Brisbane"
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      estimateCents: 200000,
      remainingCents: 150000,
      date: "2026-09-22",
    });
  });
});
