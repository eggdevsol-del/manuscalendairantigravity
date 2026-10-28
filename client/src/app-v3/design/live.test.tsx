import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TouchSlider, clampStep } from "./live";
import {
  payoutDates,
  planKeep,
  sittingProgress,
  sittingSplit,
  weekWindows,
} from "./liveDisplays";

function Harness() {
  const [v, setV] = useState(60);
  return (
    <TouchSlider
      label="Length"
      value={v}
      min={0}
      max={600}
      step={15}
      format={x => `${x} min`}
      onChange={setV}
    />
  );
}

describe("touch fill slider", () => {
  it("sets the value from where you press on the bar, snapped to the step", () => {
    render(<Harness />);
    const bar = screen.getByRole("slider", { name: "Length" });
    bar.getBoundingClientRect = () =>
      ({ left: 0, width: 300, top: 0, height: 56 }) as DOMRect;
    fireEvent.pointerDown(bar, { clientX: 152, pointerId: 1 });
    expect(bar.getAttribute("aria-valuenow")).toBe("300");
    fireEvent.pointerMove(bar, { clientX: 400, pointerId: 1 });
    expect(bar.getAttribute("aria-valuetext")).toBe("600 min");
    fireEvent.pointerUp(bar, { pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 0, pointerId: 1 });
    expect(bar.getAttribute("aria-valuenow")).toBe("600");
  });

  it("steps with the arrow keys and jumps with Home and End", () => {
    render(<Harness />);
    const bar = screen.getByRole("slider", { name: "Length" });
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(bar.getAttribute("aria-valuenow")).toBe("75");
    fireEvent.keyDown(bar, { key: "Home" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    fireEvent.keyDown(bar, { key: "ArrowLeft" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(clampStep(1003, 0, 600, 15)).toBe(600);
  });
});

describe("live display maths", () => {
  it("lays the week down a day, with breaks cut out of tattooing hours", () => {
    const week = weekWindows([
      { day: "monday", enabled: true, start: "06:00", end: "18:00", type: "work", breaks: [{ start: "12:00", end: "13:00" }] },
      { day: "tuesday", enabled: true, start: "10:00", end: "14:00", type: "design" },
      { day: "wednesday", enabled: false, start: "10:00", end: "18:00", type: "work" },
    ]);
    expect(week.days[0]).toMatchObject({ on: true, top: 25, height: 50, hours: 11 });
    expect(week.days[0].breaks[0].top).toBe(50);
    expect(week.days[2]).toMatchObject({ on: false, hours: 0 });
    expect(week.tattooHours).toBe(11);
  });

  it("splits a sitting into deposit, balance and what the artist keeps", () => {
    const free = sittingSplit(100000, "free", 50);
    expect(free).toMatchObject({ percent: 25, deposit: 25000, balance: 75000, artistFee: 2000, keep: 98000 });
    expect(free.depositClient).toBe(25000 + 850);
    const pro = sittingSplit(100000, "pro", 40);
    expect(pro).toMatchObject({ percent: 40, deposit: 40000, keep: 100000, artistFee: 0 });
  });

  it("finds the plan that leaves the most and where Pro pays for itself", () => {
    expect(planKeep(300000).best).toBe("free");
    expect(planKeep(800000).best).toBe("pro");
    expect(planKeep(800000).plans.find(p => p.key === "pro")!.keep).toBe(790100);
    expect(planKeep(0).proBreakEven).toBe(495000);
  });

  it("measures how far through a sitting we are", () => {
    const a = "2026-11-05T10:00:00Z";
    const z = "2026-11-05T14:00:00Z";
    expect(sittingProgress(a, z, Date.parse("2026-11-05T09:00:00Z"))).toBe(0);
    expect(sittingProgress(a, z, Date.parse("2026-11-05T11:00:00Z"))).toBe(0.25);
    expect(sittingProgress(a, z, Date.parse("2026-11-05T15:00:00Z"))).toBe(1);
  });

  it("lists the next payout dates for each schedule", () => {
    const from = new Date(2026, 10, 4, 9).getTime(); // a Wednesday
    const label = (d: Date) => d.toLocaleDateString("en-CA");
    expect(payoutDates("daily", null, null, from, 3).map(label)).toEqual(["2026-11-05", "2026-11-06", "2026-11-09"]);
    expect(payoutDates("weekly", "monday", null, from, 2).map(label)).toEqual(["2026-11-09", "2026-11-16"]);
    expect(payoutDates("monthly", null, 31, from, 2).map(label)).toEqual(["2026-11-30", "2026-12-31"]);
    expect(payoutDates("manual", null, null, from)).toEqual([]);
  });
});
