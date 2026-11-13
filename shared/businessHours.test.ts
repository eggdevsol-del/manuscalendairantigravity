// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import {
  OutsideHoursError,
  checkBusinessHours,
  describeOutsideHours,
  outsideHoursFromError,
  outsideHoursKey,
  outsideHoursWhen,
  unconfirmedOutsideHours,
} from "./businessHours";

const BNE = "Australia/Brisbane";
const names = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
/** The shape the Working hours page saves: Monday to Friday, 9:00 am to 5:30 pm. */
const week = (patch: Record<string, object> = {}) =>
  JSON.stringify(
    Object.fromEntries(
      names.map((day, i) => [
        day,
        {
          day,
          enabled: i < 5,
          start: "09:00",
          end: "17:30",
          startTime: "09:00",
          endTime: "17:30",
          type: "work",
          breaks: [],
          ...patch[day],
        },
      ])
    )
  );
const at = (local: string, zone = BNE) => fromZonedTime(local, zone);
const check = (
  from: string,
  to: string,
  schedule: unknown = week(),
  zone = BNE
) => checkBusinessHours(schedule, zone, at(from, zone), at(to, zone));

describe("checkBusinessHours", () => {
  it("accepts a sitting that fills the day and ends exactly at closing", () => {
    // 2026-09-14 is a Monday.
    expect(check("2026-09-14T09:00", "2026-09-14T17:30")).toBeNull();
  });
  it("measures how long a sitting runs past closing", () => {
    const issue = check("2026-09-14T16:00", "2026-09-14T19:00")!;
    expect(issue).toMatchObject({
      reason: "hours",
      day: "Monday",
      minutesBefore: 0,
      minutesAfter: 90,
      closesAt: 17 * 60 + 30,
      pastMidnight: false,
    });
    expect(describeOutsideHours(issue)).toBe(
      "Ends 1 h 30 min after you close at 5:30 pm"
    );
    expect(outsideHoursWhen(issue)).toBe("Mon 14 Sep, 4:00 pm – 7:00 pm");
  });
  it("measures how long before opening a sitting starts", () => {
    const issue = check("2026-09-14T08:15", "2026-09-14T10:00")!;
    expect(issue).toMatchObject({ minutesBefore: 45, minutesAfter: 0 });
    expect(describeOutsideHours(issue)).toBe(
      "Starts 45 min before you open at 9:00 am"
    );
  });
  it("reports both ends when a sitting is longer than the day", () => {
    expect(
      describeOutsideHours(check("2026-09-14T08:00", "2026-09-14T18:30")!)
    ).toBe(
      "Starts 1 h before you open at 9:00 am and ends 1 h after you close at 5:30 pm"
    );
  });
  it("flags a sitting that starts after closing", () => {
    expect(check("2026-09-14T18:00", "2026-09-14T19:00")).toMatchObject({
      reason: "hours",
      minutesAfter: 90,
    });
  });
  it("flags closed days, missing days and non-tattooing days", () => {
    const sunday = check("2026-09-13T10:00", "2026-09-13T12:00")!;
    expect(sunday).toMatchObject({ reason: "closed", dayType: "off" });
    expect(describeOutsideHours(sunday)).toBe("You’re closed on Sundays");
    const partial = JSON.stringify({
      monday: { enabled: true, start: "09:00", end: "17:00" },
    });
    expect(
      check("2026-09-15T10:00", "2026-09-15T12:00", partial)
    ).toMatchObject({ reason: "closed", day: "Tuesday" });
    const design = check(
      "2026-09-16T10:00",
      "2026-09-16T12:00",
      week({ wednesday: { type: "design" } })
    )!;
    expect(design).toMatchObject({ reason: "closed", dayType: "design" });
    expect(describeOutsideHours(design)).toBe(
      "Wednesday is a design day, not a tattooing day"
    );
  });
  it("flags a sitting across a break but not one beside it", () => {
    const schedule = week({
      monday: { breaks: [{ startTime: "12:00", endTime: "13:00" }] },
    });
    const issue = check("2026-09-14T11:00", "2026-09-14T12:30", schedule)!;
    expect(issue).toMatchObject({ reason: "break", breakStart: 720 });
    expect(describeOutsideHours(issue)).toBe(
      "Overlaps your break from 12:00 pm to 1:00 pm"
    );
    expect(check("2026-09-14T13:00", "2026-09-14T15:00", schedule)).toBeNull();
    expect(check("2026-09-14T10:00", "2026-09-14T12:00", schedule)).toBeNull();
  });
  it("judges a sitting that runs past midnight against the day it starts on", () => {
    const issue = check("2026-09-14T22:00", "2026-09-15T01:00")!;
    expect(issue).toMatchObject({
      day: "Monday",
      minutesAfter: 450,
      pastMidnight: true,
    });
    expect(describeOutsideHours(issue)).toBe(
      "Ends 7 h 30 min after you close at 5:30 pm, running past midnight"
    );
  });
  it("understands hours that close after midnight", () => {
    const late = week({ friday: { start: "18:00", end: "02:00" } });
    // 2026-09-18 is a Friday; Saturday is closed.
    expect(check("2026-09-18T22:00", "2026-09-19T01:00", late)).toBeNull();
    expect(check("2026-09-19T00:30", "2026-09-19T02:00", late)).toBeNull();
    expect(check("2026-09-18T23:00", "2026-09-19T03:00", late)).toMatchObject({
      minutesAfter: 60,
      closesAt: 120,
      pastMidnight: true,
    });
    expect(check("2026-09-19T02:30", "2026-09-19T03:30", late)).toMatchObject({
      reason: "closed",
      day: "Saturday",
    });
  });
  it("measures an overrun of last night's after-midnight close against that close", () => {
    const late = week({ friday: { start: "18:00", end: "02:00" } });
    const issue = check("2026-09-19T00:30", "2026-09-19T02:30", late)!;
    expect(issue).toMatchObject({
      reason: "hours",
      minutesBefore: 0,
      minutesAfter: 30,
      closesAt: 120,
    });
    expect(describeOutsideHours(issue)).toBe(
      "Ends 30 min after you close at 2:00 am"
    );
    const nights = JSON.stringify(
      Object.fromEntries(
        names.map(day => [day, { enabled: true, start: "20:00", end: "04:00" }])
      )
    );
    expect(
      describeOutsideHours(
        check("2026-09-15T03:00", "2026-09-15T05:00", nights)!
      )
    ).toBe("Ends 1 h after you close at 4:00 am");
    expect(check("2026-09-15T03:00", "2026-09-15T04:00", nights)).toBeNull();
  });
  it("reads local time correctly on both sides of a daylight-saving change", () => {
    const nine = JSON.stringify(
      names.map(day => ({
        day: day[0].toUpperCase() + day.slice(1),
        enabled: true,
        start: "09:00",
        end: "17:00",
      }))
    );
    // New York: clocks go forward on Sunday 2026-03-08.
    const NY = "America/New_York";
    for (const day of ["2026-03-06", "2026-03-09"]) {
      expect(check(`${day}T09:00`, `${day}T17:00`, nine, NY)).toBeNull();
      expect(check(`${day}T08:30`, `${day}T10:00`, nine, NY)).toMatchObject({
        minutesBefore: 30,
      });
    }
    // The same UTC instant is 9:00 am before the change and 10:00 am after it.
    expect(
      checkBusinessHours(
        nine,
        NY,
        new Date("2026-03-06T13:00:00Z"),
        new Date("2026-03-06T15:00:00Z")
      )
    ).toMatchObject({ minutesBefore: 60 });
    expect(
      checkBusinessHours(
        nine,
        NY,
        new Date("2026-03-09T13:00:00Z"),
        new Date("2026-03-09T15:00:00Z")
      )
    ).toBeNull();
    // Sydney: clocks go forward on Sunday 2026-10-04 and back on Sunday 2026-04-05.
    const SYD = "Australia/Sydney";
    for (const day of [
      "2026-10-02",
      "2026-10-05",
      "2026-04-03",
      "2026-04-06",
    ]) {
      expect(check(`${day}T09:00`, `${day}T17:00`, nine, SYD)).toBeNull();
      expect(check(`${day}T15:00`, `${day}T17:45`, nine, SYD)).toMatchObject({
        minutesAfter: 45,
      });
    }
  });
  it("reads the end from the wall clock for a sitting that spans the daylight-saving change itself", () => {
    const early = JSON.stringify({
      sunday: { enabled: true, start: "01:00", end: "09:00" },
    });
    const sydney = (from: string, to: string) =>
      checkBusinessHours(
        early,
        "Australia/Sydney",
        new Date(from),
        new Date(to)
      );
    // Clocks go back: 1:00 am to 9:00 am on the wall is nine real hours, and still ends at closing.
    expect(sydney("2026-04-04T14:00:00Z", "2026-04-04T23:00:00Z")).toBeNull();
    // Clocks go forward: 1:00 am to 10:00 am on the wall is eight real hours, and ends after closing.
    expect(
      describeOutsideHours(
        sydney("2026-10-03T15:00:00Z", "2026-10-03T23:00:00Z")!
      )
    ).toBe("Ends 1 h after you close at 9:00 am");
  });
  it("judges the weekday in the artist's zone, not UTC", () => {
    // 23:00 UTC on Sunday is 9:00 am on Monday in Brisbane.
    expect(
      checkBusinessHours(
        week(),
        BNE,
        new Date("2026-09-13T23:00:00Z"),
        new Date("2026-09-14T01:00:00Z")
      )
    ).toBeNull();
    expect(
      checkBusinessHours(
        week(),
        "UTC",
        new Date("2026-09-13T23:00:00Z"),
        new Date("2026-09-14T01:00:00Z")
      )
    ).toMatchObject({ reason: "closed", day: "Sunday" });
  });
  it("reads every stored schedule shape", () => {
    const late = ["2026-09-16T16:00", "2026-09-16T18:00"] as const;
    const shapes = [
      [{ day: "Wednesday", enabled: true, start: "09:00", end: "17:00" }],
      [
        {
          day: "Wednesday",
          enabled: true,
          startTime: "09:00",
          endTime: "17:00",
        },
      ],
      { wednesday: { enabled: true, startTime: "09:00", endTime: "17:00" } },
      {
        wed: { day: "Wednesday", enabled: true, start: "09:00", end: "17:00" },
      },
      { Wed: { enabled: true, start: "09:00 AM", end: "05:00 PM" } },
    ];
    for (const shape of shapes) {
      expect(check(...late, shape)).toMatchObject({ minutesAfter: 60 });
      expect(check(...late, JSON.stringify(shape))).toMatchObject({
        minutesAfter: 60,
      });
      expect(check("2026-09-16T09:00", "2026-09-16T17:00", shape)).toBeNull();
    }
  });
  it("never asks when hours are missing, unreadable or not set up", () => {
    const sunday = ["2026-09-13T03:00", "2026-09-13T23:00"] as const;
    for (const schedule of [
      undefined,
      null,
      "",
      "{}",
      "[]",
      "not json",
      42,
      '{"mon":true,"tue":true}',
      JSON.stringify({
        monday: { enabled: true, start: "soon", end: "later" },
      }),
      JSON.stringify([null, "monday", { enabled: true }]),
    ])
      expect(
        checkBusinessHours(schedule, BNE, at(sunday[0]), at(sunday[1]))
      ).toBeNull();
    expect(
      checkBusinessHours(
        week(),
        "Not/AZone",
        new Date(),
        new Date(Date.now() + 1)
      )
    ).toBeNull();
    expect(
      checkBusinessHours(week(), BNE, new Date("nope"), new Date())
    ).toBeNull();
  });
  it("asks on every day when hours were set up with no tattooing day", () => {
    const monday = ["2026-09-14T10:00", "2026-09-14T12:00"] as const;
    const off = JSON.stringify({
      monday: { enabled: false, start: "09:00", end: "17:00" },
    });
    expect(check(...monday, off)).toMatchObject({
      reason: "closed",
      dayType: "off",
    });
    const design = JSON.stringify(
      Object.fromEntries(
        names
          .slice(0, 5)
          .map(day => [
            day,
            { enabled: true, start: "09:00", end: "17:00", type: "design" },
          ])
      )
    );
    expect(check(...monday, design)).toMatchObject({
      reason: "closed",
      dayType: "design",
    });
  });
  it("reads loosely stored days the way the calendar does", () => {
    const loose = (enabled: unknown, type: unknown) =>
      JSON.stringify(
        Object.fromEntries(
          names
            .slice(0, 5)
            .map(day => [day, { enabled, start: "09:00", end: "17:00", type }])
        )
      );
    for (const schedule of [
      loose(1, "work"),
      loose("true", ""),
      loose(true, null),
    ]) {
      expect(
        check("2026-09-13T10:00", "2026-09-13T12:00", schedule)
      ).toMatchObject({ reason: "closed" });
      expect(
        check("2026-09-14T16:00", "2026-09-14T18:00", schedule)
      ).toMatchObject({ minutesAfter: 60 });
      expect(
        check("2026-09-14T10:00", "2026-09-14T12:00", schedule)
      ).toBeNull();
    }
  });
  it("does not judge an open day whose own hours cannot be read", () => {
    const schedule = week({
      tuesday: { start: "", end: "", startTime: "", endTime: "" },
    });
    expect(check("2026-09-15T03:00", "2026-09-15T04:00", schedule)).toBeNull();
    expect(
      check("2026-09-14T03:00", "2026-09-14T04:00", schedule)
    ).not.toBeNull();
  });
});

describe("confirmations", () => {
  const sittings = [
    {
      start: at("2026-09-14T16:00"),
      end: at("2026-09-14T19:00"),
      sessionIndex: 1,
    },
    {
      start: at("2026-09-15T10:00"),
      end: at("2026-09-15T12:00"),
      sessionIndex: 2,
    },
    {
      start: at("2026-09-20T10:00"),
      end: at("2026-09-20T12:00"),
      sessionIndex: 3,
    },
  ];
  it("lists only the sittings outside hours, with their index", () => {
    expect(
      unconfirmedOutsideHours(week(), BNE, sittings).map(i => i.sessionIndex)
    ).toEqual([1, 3]);
  });
  it("lets a confirmation cover only the sitting it was given for", () => {
    const [first, third] = unconfirmedOutsideHours(week(), BNE, sittings);
    expect(
      unconfirmedOutsideHours(week(), BNE, sittings, [first.key]).map(
        i => i.sessionIndex
      )
    ).toEqual([3]);
    expect(
      unconfirmedOutsideHours(week(), BNE, sittings, [first.key, third.key])
    ).toEqual([]);
  });
  it("does not carry a confirmation to a different time or length", () => {
    const key = outsideHoursKey(sittings[0].start, sittings[0].end);
    const moved = [
      { start: at("2026-09-14T16:30"), end: at("2026-09-14T19:30") },
      { start: at("2026-09-14T16:00"), end: at("2026-09-14T20:00") },
      { start: at("2026-09-21T16:00"), end: at("2026-09-21T19:00") },
    ];
    expect(unconfirmedOutsideHours(week(), BNE, moved, [key])).toHaveLength(3);
  });
  it("travels as an error and is recognised however it arrives", () => {
    const issues = unconfirmedOutsideHours(week(), BNE, sittings);
    const error = new OutsideHoursError(issues);
    expect(error.message).toContain("outside your business hours");
    expect(error.message).toContain("You’re closed on Sundays");
    const wire = JSON.parse(JSON.stringify(issues));
    expect(outsideHoursFromError(error)).toEqual(issues);
    expect(outsideHoursFromError({ data: { outsideHours: wire } })).toEqual(
      wire
    );
    expect(outsideHoursFromError({ cause: error })).toEqual(issues);
    expect(
      outsideHoursFromError(new Error("This time is already booked."))
    ).toBeNull();
    expect(
      outsideHoursFromError({ data: { outsideHours: [{ key: 1 }] } })
    ).toBeNull();
    expect(outsideHoursFromError(null)).toBeNull();
  });
});
