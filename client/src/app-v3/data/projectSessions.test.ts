import { describe, expect, it } from "vitest";
import { projectSessions } from "./projectSessions";
describe("booking workspace projects", () => {
  const sessions = [
    { id: 1, sessionPlanId: 10 },
    { id: 2, sessionPlanId: 20 },
    { id: 3, sessionPlanId: 10 },
    { id: 4, sessionPlanId: null },
    { id: 5, sessionPlanId: null },
  ];
  it("keeps separate tattoo plans for a returning client apart", () =>
    expect(projectSessions(sessions, sessions[0]).map(s => s.id)).toEqual([
      1, 3,
    ]));
  it("does not merge unrelated imported appointments", () =>
    expect(projectSessions(sessions, sessions[3]).map(s => s.id)).toEqual([4]));
  it("has no implicit project without a selected session", () =>
    expect(projectSessions(sessions)).toEqual([]));
});
