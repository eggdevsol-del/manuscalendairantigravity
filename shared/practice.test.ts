import { describe, it, expect } from "vitest";
import {
  PRACTICE_CHAPTERS,
  seedPractice,
  startPractice,
  advancePractice,
  type PracticeState,
} from "./practice";
function values(state: PracticeState) {
  const c = PRACTICE_CHAPTERS.find(c => c.id === state.chapterId)!;
  return Object.fromEntries(
    (c.steps[state.cursor].fields ?? []).map(f => [
      f.key,
      (f.key === "confirm" ? "true" : f.initial) ||
        (f.type === "date"
          ? "2026-10-05"
          : f.key === "month"
            ? "2026-10"
            : "test"),
    ])
  );
}
function complete(id: string) {
  let s = startPractice(seedPractice("2026-10-04"), id);
  const c = PRACTICE_CHAPTERS.find(c => c.id === id)!;
  while (s.cursor < c.steps.length) {
    let v = values(s);
    if (c.steps[s.cursor].id === "date") v.date = "2026-11-02";
    if (v.deadline) v.deadline = "2026-12-31";
    s = advancePractice(s, c.steps[s.cursor].id, v);
  }
  return s;
}
describe("artist practice isolation and lifecycle", () => {
  it("has unique chapters and step IDs", () => {
    expect(new Set(PRACTICE_CHAPTERS.map(c => c.id)).size).toBe(
      PRACTICE_CHAPTERS.length
    );
    for (const c of PRACTICE_CHAPTERS)
      expect(new Set(c.steps.map(s => s.id)).size).toBe(c.steps.length);
  });
  it("confirms only after deposit and keeps canonical cents", () => {
    const s = complete("enquiry");
    expect(s.booking.status).toBe("confirmed");
    expect(s.booking.paid).toBe(25000);
    expect(s.booking.price).toBe(100000);
    expect(s.client.reference).toBe(true);
  });
  it("completes a session after final payment", () => {
    const s = complete("session");
    expect(s.booking.status).toBe("completed");
    expect(s.booking.paid).toBe(s.booking.price);
    expect(s.booking.forms).toBe("signed");
  });
  it("records six weekly sittings and their full total", () => {
    const s = complete("project");
    expect(s.booking.dates).toHaveLength(6);
    expect(new Set(s.booking.dates).size).toBe(6);
    expect(s.booking.price).toBe(600000);
  });
  it("rejects deadline conflicts without changing the original state", () => {
    let s = startPractice(seedPractice(), "project");
    s = advancePractice(s, "client", values(s));
    s = advancePractice(s, "service", values(s));
    const original = structuredClone(s);
    expect(() =>
      advancePractice(s, "schedule", {
        date: "2026-10-05",
        deadline: "2026-10-06",
        frequency: "Weekly",
        sittings: "6",
      })
    ).toThrow("deadline");
    expect(s).toEqual(original);
  });
  it("rejects duplicate attempts at a completed action", () => {
    const s = startPractice(seedPractice(), "enquiry");
    const next = advancePractice(s, "request", {});
    expect(() => advancePractice(next, "request", {})).toThrow(
      "already changed"
    );
  });
  it("keeps original records when a simulated request fails", () => {
    const s = startPractice(seedPractice(), "enquiry");
    const original = structuredClone(s);
    expect(() => advancePractice(s, "request", {}, "failure")).toThrow(
      "nothing changed"
    );
    expect(s).toEqual(original);
  });
  it("reprices only following client approval, crediting the deposit", () => {
    let s = startPractice(seedPractice("2026-10-05"), "promo-reschedule");
    s = advancePractice(s, "select", {});
    s = advancePractice(s, "date", { date: "2026-11-02", keep: "false" });
    expect(s.booking.price).toBe(80000);
    expect(s.booking.dates).not.toEqual(["2026-11-02"]);
    s = advancePractice(s, "send", {});
    s = advancePractice(s, "approve", {});
    expect(s.booking.price).toBe(100000);
    expect(s.booking.paid).toBe(25000);
    expect(s.booking.dates).toEqual(["2026-11-02"]);
  });
  it("keeps the discount when explicitly retained", () => {
    let s = startPractice(seedPractice(), "promo-reschedule");
    s = advancePractice(s, "select", {});
    s = advancePractice(s, "date", { date: "2026-11-02", keep: "true" });
    s = advancePractice(s, "send", {});
    s = advancePractice(s, "approve", {});
    expect(s.booking.price).toBe(80000);
  });
  it("does not confirm or collect on decline", () => {
    let s = startPractice(seedPractice(), "enquiry");
    for (let i = 0; i < 8; i++) {
      const step = PRACTICE_CHAPTERS[0].steps[s.cursor];
      s = advancePractice(s, step.id, values(s));
    }
    const next = advancePractice(s, "accept", {}, "decline");
    expect(next.cursor).toBe(7);
    expect(next.booking.paid).toBe(0);
  });
  it("allows fractional percentages, rejects values over 100", () => {
    const s = startPractice(seedPractice(), "promotion");
    expect(() =>
      advancePractice(s, "create", {
        title: "Test",
        valueType: "Percent",
        value: "12.5",
        month: "2026-10",
      })
    ).not.toThrow();
    expect(() =>
      advancePractice(s, "create", {
        title: "Test",
        valueType: "Percent",
        value: "101",
        month: "2026-10",
      })
    ).toThrow("100%");
  });
  it("independent artists cannot share mutable fixtures", () => {
    const a = startPractice(seedPractice(), "enquiry");
    const b = startPractice(seedPractice(), "enquiry");
    const next = advancePractice(a, "request", {});
    expect(next.messages).toHaveLength(1);
    expect(b.messages).toHaveLength(0);
  });
  it.each(PRACTICE_CHAPTERS.map(c => c.id))(
    "can finish %s with mock inputs",
    id => {
      const s = complete(id);
      expect(s.completed).toContain(id);
    }
  );
});

describe("practice audiences and issued offers", () => {
  it("filters mock clients by city, birthday, loyalty and lifetime value", () => {
    let s = startPractice(seedPractice(), "calendar-fill");
    s = advancePractice(s, "create", {
      title: "Test",
      value: "15",
      month: "2026-10",
      expiry: "24 hours",
    });
    s = advancePractice(s, "audience", {
      loyalty: "3 or more",
      lifetime: "$2000+",
      recency: "Over 30 days",
      birthday: "October",
      city: "Brisbane",
    });
    expect(s.audience).toEqual(["Alex Taylor"]);
  });
  it("keeps a deposit-confirmed offer while expiring the other recipient", () => {
    const s = complete("calendar-fill");
    expect(s.offers.find(o => o.client === "Alex Taylor")?.status).toBe(
      "confirmed with deposit"
    );
    expect(s.offers.find(o => o.client === "Sam Chen")?.status).toBe("expired");
  });
});
