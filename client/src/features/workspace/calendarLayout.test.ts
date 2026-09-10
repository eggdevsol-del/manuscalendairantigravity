import { describe, it, expect } from "vitest";
import { calendarLanes } from "./calendarLayout";
import { instant, bookingTime, money } from "./bookingPresentation";
const event = (id: number, start: number, end: number) => ({
  id,
  startTime: `2026-09-10 ${String(start).padStart(2, "0")}:00:00`,
  endTime: `2026-09-10 ${String(end).padStart(2, "0")}:00:00`,
});
describe("calendar placement and display", () => {
  it("keeps transitive overlaps in a consistent two-lane group", () => {
    const lanes = calendarLanes([
      event(1, 9, 11),
      event(2, 10, 12),
      event(3, 11, 13),
    ]);
    expect(lanes.get(1)).toEqual({ lane: 0, count: 2 });
    expect(lanes.get(2)).toEqual({ lane: 1, count: 2 });
    expect(lanes.get(3)).toEqual({ lane: 0, count: 2 });
  });
  it("resets lanes after a gap and permits back-to-back appointments", () => {
    const lanes = calendarLanes([event(2, 11, 12), event(1, 9, 11)]);
    expect(lanes.get(1)).toEqual({ lane: 0, count: 1 });
    expect(lanes.get(2)).toEqual({ lane: 0, count: 1 });
  });
  it("normalizes MySQL UTC timestamps without shifting ISO offsets", () => {
    expect(instant("2026-09-10 00:00:00").toISOString()).toBe(
      "2026-09-10T00:00:00.000Z"
    );
    expect(instant("2026-09-10T10:00:00+10:00").toISOString()).toBe(
      "2026-09-10T00:00:00.000Z"
    );
    expect(bookingTime("2026-09-10 00:00:00", "Australia/Brisbane")).toBe(
      "10:00"
    );
  });
  it("keeps minor currency units exact", () =>
    expect(money(15051)).toBe("$150.51"));
});
