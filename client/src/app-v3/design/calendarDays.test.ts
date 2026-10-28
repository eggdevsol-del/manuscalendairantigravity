import { beforeEach, describe, expect, it } from "vitest";
import {
  addDays,
  canFill,
  dayColumn,
  duration,
  freeMinutes,
  hoursFor,
  parseSchedule,
  savedDayIn,
  takeLocalSavedDays,
  savedKeys,
} from "./calendarDays";

// Wednesday 4 November 2026, local time.
const day = new Date(2026, 10, 4).getTime();
const at = (h: number, m = 0) => new Date(2026, 10, 4, h, m).getTime();
const schedule = parseSchedule(
  JSON.stringify([
    {
      day: "Wednesday",
      enabled: true,
      start: "10:00",
      end: "18:00",
      breaks: [{ start: "13:00", end: "13:30" }],
    },
    { day: "Thursday", enabled: false, start: "10:00", end: "18:00" },
  ])
);

describe("calendar days", () => {
  it("reads opening hours from array or keyed schedules", () => {
    expect(hoursFor(schedule, day)).toEqual({
      open: true,
      start: 600,
      end: 1080,
      breaks: 30,
    });
    const keyed = parseSchedule({ wed: { day: "Wednesday", enabled: true, startTime: "09:00", endTime: "17:00" } });
    expect(hoursFor(keyed, day)).toMatchObject({ open: true, start: 540, end: 1020 });
    // The format production stores: keyed by day name, with no day field inside.
    const byName = parseSchedule('{"wednesday":{"enabled":true,"start":"09:00","end":"17:00","type":"work"}}');
    expect(hoursFor(byName, day)).toMatchObject({ open: true, start: 540, end: 1020 });
    // A day off has no hours, so nothing to fill.
    expect(hoursFor(schedule, addDays(day, 1))).toMatchObject({ open: false, start: null, end: null });
    expect(freeMinutes(schedule, addDays(day, 1), [])).toBe(0);
  });

  it("counts free minutes after breaks and bookings, ignoring cancellations", () => {
    expect(freeMinutes(schedule, day, [])).toBe(450);
    const sittings = [
      { id: 1, startTime: new Date(at(10)), endTime: new Date(at(13)) },
      { id: 2, startTime: new Date(at(14)), endTime: new Date(at(16)), status: "cancelled" },
    ];
    expect(freeMinutes(schedule, day, sittings)).toBe(270);
  });

  it("offers filling only on today or later with two free hours", () => {
    expect(canFill(120, day, at(9))).toBe(true);
    expect(canFill(119, day, at(9))).toBe(false);
    expect(canFill(450, day, addDays(day, 1))).toBe(false);
  });

  it("sizes sittings by length and widens the column for late work", () => {
    const col = dayColumn(
      [
        { id: 2, startTime: new Date(at(18)), endTime: new Date(at(22)) },
        { id: 1, startTime: new Date(at(10)), endTime: new Date(at(10, 30)) },
      ],
      day,
      at(19),
      40
    );
    expect(col.cards.map(c => c.sitting.id)).toEqual([1, 2]);
    expect(col.cards[0]).toMatchObject({ top: 82, height: 54, short: true });
    expect(col.cards[1]).toMatchObject({ height: 156, live: true });
    expect(col.height).toBe(14 * 40 + 12);
    expect(col.nowLine).toBe(440);
    expect(duration(270)).toBe("4h 30m");
  });

  describe("saved days", () => {
    it("finds a day saved under either the client or the conversation", () => {
      const days = { "client:client-1": "2026-11-04", "conversation:7": "2026-11-04" };
      expect(savedDayIn(days, savedKeys(null, 7), at(9))).toBe("2026-11-04");
      expect(savedDayIn(days, savedKeys("client-1"), at(9))).toBe("2026-11-04");
      expect(savedDayIn(days, savedKeys("client-1"), addDays(day, 1))).toBeNull();
      expect(savedDayIn(undefined, savedKeys("client-1", 7), at(9))).toBeNull();
    });
    it("hands over days saved on this device once, then forgets them", () => {
      localStorage.setItem("tattoi:saved-days:v1", JSON.stringify({ "client:a": "2026-11-05" }));
      expect(takeLocalSavedDays()).toEqual({ "client:a": "2026-11-05" });
      expect(takeLocalSavedDays()).toEqual({});
    });
  });
});
