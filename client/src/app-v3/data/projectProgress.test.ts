import { describe, it, expect } from "vitest";
import {
  nextProjectSitting,
  orderedProjectGroups,
  projectProgress,
} from "./projectProgress";
const sitting = (id: number, patch = {}) => ({
  id,
  sessionPlanId: 11,
  sessionTotal: 5,
  status: "confirmed",
  startsAt: `2026-10-${10 + id}T00:00:00Z`,
  ...patch,
});
describe("saved project progress", () => {
  it("counts completed sittings, not paid sittings or elapsed dates", () => {
    expect(
      projectProgress([
        sitting(1, { status: "completed" }),
        sitting(2, { status: "completed" }),
        sitting(3),
        sitting(4),
        sitting(5),
      ])
    ).toMatchObject({ completed: 2, total: 5, remaining: 3 });
  });
  it("retains a saved planned total when not all sittings have dates", () =>
    expect(
      projectProgress([sitting(1, { status: "completed" }), sitting(2)])
    ).toMatchObject({ total: 5, completed: 1, remaining: 4 }));
  it("does not turn cancelled or missed sittings into completed work", () =>
    expect(
      projectProgress([
        sitting(1, { status: "completed" }),
        sitting(2, { status: "cancelled" }),
        sitting(3, { status: "no-show" }),
      ])
    ).toMatchObject({ completed: 1, cancelled: 1, missed: 1, total: 5 }));
  it("leaves unknown and contradictory totals unquantified", () => {
    expect(
      projectProgress([sitting(1, { sessionTotal: null })]).total
    ).toBeNull();
    expect(
      projectProgress([sitting(1), sitting(2, { sessionTotal: 7 })]).total
    ).toBeNull();
    expect(
      projectProgress([
        sitting(1, { sessionTotal: 1 }),
        sitting(2, { sessionTotal: 1 }),
      ]).total
    ).toBeNull();
  });
  it("does not count a duplicated response twice", () =>
    expect(
      projectProgress([
        sitting(1, { status: "completed" }),
        sitting(1, { status: "completed" }),
      ]).completed
    ).toBe(1));
  it("updates when the artist changes the saved plan total", () =>
    expect(
      projectProgress([sitting(1, { sessionTotal: 6, status: "completed" })])
    ).toMatchObject({ completed: 1, total: 6 }));
});
describe("project order and identity", () => {
  it("keeps two plans with the same artist and standalone appointments separate", () => {
    const groups = orderedProjectGroups([
      sitting(1),
      sitting(2, { sessionPlanId: 22 }),
      sitting(3, { sessionPlanId: null }),
      sitting(4, { sessionPlanId: null }),
      sitting(5),
    ]);
    expect(groups.map(g => g.map(s => s.id))).toEqual([[1, 5], [2], [3], [4]]);
  });
  it("orders projects by their next active appointment rather than first historical sitting", () => {
    const rows = [
      sitting(1, { status: "completed", startsAt: "2020-01-01T00:00:00Z" }),
      sitting(2, { startsAt: "2026-12-01T00:00:00Z" }),
      sitting(3, { sessionPlanId: 22, startsAt: "2026-10-01T00:00:00Z" }),
    ];
    expect(
      orderedProjectGroups(rows, Date.parse("2026-09-01"))[0][0].sessionPlanId
    ).toBe(22);
  });
  it("ignores completed, cancelled and missed sittings when choosing the next date", () =>
    expect(
      nextProjectSitting(
        [
          sitting(1, { status: "completed" }),
          sitting(2, { status: "cancelled" }),
          sitting(3, { status: "no-show" }),
          sitting(4),
        ],
        0
      )?.id
    ).toBe(4));
});

it("keeps a moved sitting in its original project and progress", () => {
  const rows = [
    sitting(1, { status: "completed" }),
    sitting(2, { startsAt: "2027-01-01T00:00:00Z", rescheduled: true }),
    sitting(3, { sessionPlanId: 22 }),
  ];
  const original = orderedProjectGroups(rows).find(
    group => group[0].sessionPlanId === 11
  )!;
  expect(original.map(s => s.id)).toEqual([1, 2]);
  expect(projectProgress(original)).toMatchObject({ completed: 1, total: 5 });
});
