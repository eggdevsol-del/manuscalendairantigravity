import { it, expect, vi, afterEach } from "vitest";
import { calculateProjectDates } from "./booking.service";
afterEach(() => vi.useRealTimers());
const schedule = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
].map(day => ({ day, enabled: true, start: "09:00", end: "17:00" }));
function input() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-01-01T00:00Z"));
  return {
    serviceDuration: 60,
    sittings: 3,
    frequency: "consecutive" as const,
    startDate: new Date("2027-01-04T09:00Z"),
    workSchedule: schedule,
    existingAppointments: [],
    timeZone: "UTC",
  };
}
it("uses a later full consecutive run instead of jumping between earlier free days", () => {
  const value = input();
  const result = calculateProjectDates({
    ...value,
    completedBy: new Date("2027-01-10T23:59Z"),
    existingAppointments: [
      {
        startTime: new Date("2027-01-05T00:00Z"),
        endTime: new Date("2027-01-06T00:00Z"),
      },
    ],
  });
  expect(result.map(d => d.toISOString().slice(0, 10))).toEqual([
    "2027-01-06",
    "2027-01-07",
    "2027-01-08",
  ]);
});
it("allows only deadline-bounded splits and never overruns the last sitting", () => {
  const value = input();
  const result = calculateProjectDates({
    ...value,
    completedBy: new Date("2027-01-07T10:00Z"),
    existingAppointments: [
      {
        startTime: new Date("2027-01-05T00:00Z"),
        endTime: new Date("2027-01-06T00:00Z"),
      },
    ],
  });
  expect(result.map(d => d.toISOString().slice(0, 10))).toEqual([
    "2027-01-04",
    "2027-01-06",
    "2027-01-07",
  ]);
  expect(() =>
    calculateProjectDates({
      ...value,
      completedBy: new Date("2027-01-06T09:30Z"),
    })
  ).toThrow(/deadline/i);
});
