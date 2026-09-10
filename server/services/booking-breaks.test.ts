// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  findNextAvailableSlot,
  getMaxDailyMinutes,
  validateAppointmentForWorkHours,
  workingWindows,
} from "./booking.service";
const day = {
  day: "Monday",
  enabled: true,
  start: "09:00",
  end: "17:00",
  breaks: [{ start: "12:00", end: "13:00" }],
};
describe("booking availability with breaks", () => {
  it("measures the longest continuous window rather than the whole day", () => {
    expect(getMaxDailyMinutes([day])).toBe(240);
  });
  it("finds a slot after lunch when a proposed sitting crosses it", () => {
    expect(
      findNextAvailableSlot(
        new Date("2026-09-14T01:30:00Z"),
        120,
        [day],
        [],
        "Australia/Brisbane"
      )?.toISOString()
    ).toBe("2026-09-14T03:00:00.000Z");
  });
  it("rejects a manual slot crossing a break while allowing it to end at the break", () => {
    expect(
      validateAppointmentForWorkHours(
        new Date("2026-09-14T01:00:00Z"),
        90,
        [day],
        "Australia/Brisbane"
      ).valid
    ).toBe(false);
    expect(
      validateAppointmentForWorkHours(
        new Date("2026-09-14T01:00:00Z"),
        60,
        [day],
        "Australia/Brisbane"
      ).valid
    ).toBe(true);
  });
  it("excludes design and personal time from tattoo availability", () => {
    expect(workingWindows({ ...day, type: "design" })).toEqual([]);
    expect(workingWindows({ ...day, type: "personal" })).toEqual([]);
    expect(getMaxDailyMinutes([{ ...day, type: "design" }])).toBe(0);
  });
  it("merges overlapping breaks and accepts old time aliases", () => {
    expect(
      workingWindows({
        ...day,
        breaks: [
          { startTime: "11:00", endTime: "13:00" },
          { start: "12:00", end: "14:00" },
        ],
      })
    ).toEqual([
      { start: 540, end: 660 },
      { start: 840, end: 1020 },
    ]);
  });
});
