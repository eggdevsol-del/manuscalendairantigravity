import { describe, expect, it } from "vitest";
import { selectBookingProjects } from "./clientBookingGroups";
describe("Client booking project visibility", () => {
  const rows = [
    { id: 1, sessionPlanId: 10, status: "completed" },
    { id: 2, sessionPlanId: 10, status: "confirmed", startTime: "2020-01-01" },
    { id: 3, sessionPlanId: 10, status: "cancelled" },
    {
      id: 4,
      sessionPlanId: 20,
      status: "completed",
      remainingBalanceCents: 2000,
    },
    { id: 5, sessionPlanId: 30, status: "cancelled" },
    { id: 6, sessionPlanId: 30, status: "no-show" },
    { id: 7, status: "completed", remainingBalanceCents: 0 },
    { id: 8, status: "confirmed" },
  ];
  it("retains every sitting in an active project including started and historical sittings", () => {
    expect(selectBookingProjects(rows, "upcoming").map(r => r.id)).toEqual([
      1, 2, 3, 4, 8,
    ]);
  });
  it("keeps closed cancelled and no-show projects in history without overlapping active projects", () => {
    expect(selectBookingProjects(rows, "past").map(r => r.id)).toEqual([
      5, 6, 7,
    ]);
  });
  it("does not merge standalone imports with each other", () => {
    expect(
      selectBookingProjects(rows.slice(-2), "upcoming").map(r => r.id)
    ).toEqual([8]);
  });
  it("moves an entire settled project to history once its last sitting completes", () => {
    const completed = rows
      .slice(0, 3)
      .map(r => ({ ...r, status: "completed", remainingBalanceCents: 0 }));
    expect(selectBookingProjects(completed, "upcoming")).toEqual([]);
    expect(selectBookingProjects(completed, "past")).toHaveLength(3);
  });
});
