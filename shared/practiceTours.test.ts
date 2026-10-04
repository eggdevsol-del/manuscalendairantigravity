import { describe, it, expect } from "vitest";
import { PRACTICE_CHAPTERS, seedPractice, startPractice } from "./practice";
import { PRACTICE_TOURS } from "./practiceTours";
import {
  mutatePracticeControl,
  queryPracticeControl,
} from "./practiceControls";
describe("real app guided practice contracts", () => {
  it("covers every artist workflow with real routes and actionable steps", () => {
    for (const chapter of PRACTICE_CHAPTERS) {
      const tour = PRACTICE_TOURS[chapter.id];
      expect(tour, chapter.id).toBeDefined();
      expect(tour.route).toMatch(/^\//);
      expect(tour.steps.length).toBeGreaterThan(1);
      for (const step of tour.steps) {
        expect(step.target || step.simulation).toBeTruthy();
        if (step.target) expect(() => new RegExp(step.target!)).not.toThrow();
      }
    }
  });
  it("persists guide progress without changing bookings and resets on replay", () => {
    const seed = startPractice(seedPractice(), "enquiry");
    const result = mutatePracticeControl(seed, "practice.guideProgress", {
      chapterId: "enquiry",
      cursor: 2,
    });
    expect(result.state.booking).toEqual(seed.booking);
    expect(result.state.sandbox?.guide.cursor).toBe(2);
    expect(
      startPractice(result.state, "enquiry").sandbox?.guide
    ).toBeUndefined();
    expect(() =>
      mutatePracticeControl(seed, "practice.guideProgress", {
        chapterId: "bank",
        cursor: 2,
      })
    ).toThrow();
  });
  it("shares incoming mock references between real Messages and project records", () => {
    const seed = startPractice(seedPractice(), "enquiry");
    const result = mutatePracticeControl(seed, "practice.clientOutcome", {
      outcome: "reference",
    }).state;
    expect(
      queryPracticeControl(result, "messages.list", { conversationId: 1 }).some(
        (m: any) => m.messageType === "image"
      )
    ).toBe(true);
    expect(result.client.reference).toBe(true);
  });
});
