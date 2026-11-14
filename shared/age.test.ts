import { describe, expect, it } from "vitest";
import {
  ageInYears,
  calendarDateInTimeZone,
  isAdult,
  parseDateOfBirth,
} from "./age";

const today = new Date(2026, 10, 14);

describe("date of birth", () => {
  it("accepts only real calendar dates", () => {
    expect(parseDateOfBirth("2000-02-29")).toEqual({
      year: 2000,
      month: 2,
      day: 29,
    });
    for (const bad of [
      "2001-02-29",
      "2000-13-01",
      "2000-00-10",
      "2000-1-1",
      "01/02/2000",
      "1899-12-31",
      "",
      "yesterday",
      undefined,
      null,
      20000101,
    ])
      expect(parseDateOfBirth(bad)).toBeNull();
  });
  it("counts whole years up to the birthday", () => {
    expect(ageInYears("2008-11-14", today)).toBe(18);
    expect(ageInYears("2008-11-15", today)).toBe(17);
    expect(ageInYears("2027-01-01", today)).toBeNull();
  });
  it("requires 18 on the day", () => {
    expect(isAdult("2008-11-14", today)).toBe(true);
    expect(isAdult("1990-01-01", today)).toBe(true);
    expect(isAdult("2008-11-15", today)).toBe(false);
    expect(isAdult("2020-01-01", today)).toBe(false);
    expect(isAdult("not a date", today)).toBe(false);
    expect(isAdult(undefined, today)).toBe(false);
  });
  it("treats a 29 February birthday as reached on 1 March in a non-leap year", () => {
    expect(isAdult("2008-02-29", new Date(2026, 1, 28))).toBe(false);
    expect(isAdult("2008-02-29", new Date(2026, 2, 1))).toBe(true);
  });
  it("reads today's date in the given time zone, not the runtime's", () => {
    // 14:30 UTC on 13 Nov is already 14 Nov in Brisbane and still 13 Nov in New York.
    const now = new Date("2026-11-13T14:30:00Z");
    const brisbane = calendarDateInTimeZone("Australia/Brisbane", now);
    expect(brisbane).toEqual({ year: 2026, month: 11, day: 14 });
    expect(calendarDateInTimeZone("America/New_York", now)).toEqual({
      year: 2026,
      month: 11,
      day: 13,
    });
    expect(isAdult("2008-11-14", brisbane)).toBe(true);
    expect(
      isAdult("2008-11-14", calendarDateInTimeZone("America/New_York", now))
    ).toBe(false);
    for (const unknown of ["Not/AZone", "", null, undefined])
      expect(calendarDateInTimeZone(unknown, now)).toEqual(brisbane);
  });
});
