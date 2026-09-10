import { describe, it, expect } from "vitest";
import { readSchedule, writeSchedule } from "./schedule";
import { mediaUrls, messagePreview } from "./messagePresentation";
describe("fresh frontend compatibility boundaries", () => {
  it("preserves hours, design days and unknown break data in either historic schedule shape", () => {
    const object = readSchedule(
      JSON.stringify({
        monday: {
          enabled: true,
          start: "10:00",
          end: "16:00",
          type: "design",
          breaks: [{ start: "12:00", end: "13:00" }],
        },
      })
    );
    const array = readSchedule(
      JSON.stringify([
        {
          day: "Monday",
          enabled: true,
          startTime: "10:00",
          endTime: "16:00",
          type: "design",
          breaks: [{ start: "12:00", end: "13:00" }],
        },
      ])
    );
    expect(array[0]).toMatchObject(object[0]);
    const roundTrip = readSchedule(writeSchedule(object));
    expect(roundTrip[0]).toEqual(
      expect.objectContaining({
        start: "10:00",
        end: "16:00",
        type: "design",
        breaks: [{ start: "12:00", end: "13:00" }],
      })
    );
    expect(roundTrip[1].enabled).toBe(false);
  });
  it("does not turn a malformed schedule into enabled working days", () => {
    expect(readSchedule("broken").every(day => !day.enabled)).toBe(true);
  });
  it("never leaks serialized image grids into inbox previews", () => {
    expect(
      messagePreview(
        '{"type":"reference_grid","images":["https://example.com/a.jpg"]}'
      )
    ).toBe("Reference photos");
    expect(messagePreview("Hello")).toBe("Hello");
  });
  it("only renders HTTP media destinations from structured messages", () => {
    expect(
      mediaUrls({
        images: ["https://example.com/a.jpg", "javascript:alert(1)", null, 42],
      })
    ).toEqual(["https://example.com/a.jpg"]);
  });
});
