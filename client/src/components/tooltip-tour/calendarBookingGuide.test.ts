import { beforeEach, describe, expect, it } from "vitest";
import {
  CALENDAR_BOOKING_GUIDE,
  firstCalendarBookingVisit,
} from "./calendarBookingGuide";
beforeEach(() => localStorage.clear());
describe("first calendar booking guide", () => {
  it("plays once per account without affecting other users", () => {
    expect(firstCalendarBookingVisit("artist-a")).toBe(true);
    expect(firstCalendarBookingVisit("artist-a")).toBe(false);
    expect(firstCalendarBookingVisit("artist-b")).toBe(true);
  });
  it("explains message-based booking and deposit confirmation without sending anything", () => {
    expect(CALENDAR_BOOKING_GUIDE.steps).toHaveLength(3);
    expect(CALENDAR_BOOKING_GUIDE.steps[1].body).toContain("Book in");
    expect(CALENDAR_BOOKING_GUIDE.steps[2].body).toContain("deposit is paid");
    expect(CALENDAR_BOOKING_GUIDE.steps.every(step => !step.onNext)).toBe(true);
  });
});
