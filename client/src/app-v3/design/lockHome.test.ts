import { describe, expect, it } from "vitest";
import {
  dayTimeline,
  firstImage,
  relativeStart,
  projectTitle,
} from "./lockHome";

const day = new Date("2026-10-29T00:00:00").getTime();
const at = (h: number, m = 0) => new Date(day + (h * 60 + m) * 60000);

describe("dayTimeline", () => {
  it("sizes each sitting to its length and marks finished and live ones", () => {
    const t = dayTimeline(
      [
        { id: 1, startTime: at(9), endTime: at(12), status: "confirmed" },
        { id: 2, startTime: at(13), endTime: at(18), status: "confirmed" },
      ],
      at(14).getTime(),
      day
    );
    expect(t.blocks[0]).toMatchObject({ done: true, live: false });
    expect(t.blocks[1]).toMatchObject({ done: false, live: true });
    expect(t.blocks[1].width).toBeCloseTo((5 / 3) * t.blocks[0].width);
    expect(t.done).toBe(1);
    expect(t.hoursLeft).toBeCloseTo(4);
    expect(t.now).not.toBeNull();
  });

  it("widens the window for sittings outside working hours", () => {
    const t = dayTimeline(
      [{ id: 1, startTime: at(19), endTime: at(23), status: "confirmed" }],
      at(8).getTime(),
      day
    );
    expect(t.blocks[0].left + t.blocks[0].width).toBeCloseTo(100);
    expect(t.now).toBeNull();
  });
});

describe("relativeStart", () => {
  it("speaks in minutes within the hour", () => {
    expect(relativeStart(at(10, 25), at(10).getTime())).toBe("in 25 min");
    expect(relativeStart(at(9), at(10).getTime())).toBe("now");
  });
});

describe("firstImage", () => {
  it("reads JSON text, arrays and objects", () => {
    expect(firstImage('["https://x/a.jpg"]')).toBe("https://x/a.jpg");
    expect(firstImage([{ url: "/b.jpg" }])).toBe("/b.jpg");
    expect(firstImage("not json")).toBeNull();
    expect(firstImage(null)).toBeNull();
  });
});

describe("project title", () => {
  it("skips placeholders such as N/A and takes the next real name", () => {
    expect(projectTitle("N/A", "Back piece")).toBe("Back piece");
    expect(projectTitle(" n/a ", "none", "-", null, "Sleeve")).toBe("Sleeve");
    expect(projectTitle("N/A", undefined)).toBeNull();
  });
});
