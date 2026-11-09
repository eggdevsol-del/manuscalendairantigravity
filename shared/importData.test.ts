// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalEmail,
  normalPhone,
  importLocalTime,
  importInputSchema,
} from "./importData";
describe("import normalization", () => {
  it("matches common email and Australian mobile formatting", () => {
    expect(normalEmail(" Client@Example.COM ")).toBe("client@example.com");
    expect(normalPhone("0412 345 678")).toBe(normalPhone("+61 412 345 678"));
  });
  it("uses explicit Australian dates and handles noon and midnight", () => {
    expect(importLocalTime("09/10/2026", "12:30 AM")).toBe("2026-10-09T00:30");
    expect(importLocalTime("2026-10-09", "12:30 PM")).toBe("2026-10-09T12:30");
    expect(importLocalTime("2026-10-09", "9:05 PM")).toBe("2026-10-09T21:05");
  });
  it("rejects calendar rollovers, invalid clock values and ambiguous date syntax", () => {
    for (const [date, time] of [
      ["2026-02-30", "10:00"],
      ["2026-09-09", "24:00"],
      ["2026-09-09", "0:30 PM"],
    ])
      expect(() => importLocalTime(date, time)).toThrow();
  });
  it("converts the date and time formats calendar apps and spreadsheets export", () => {
    const cases: [string, string, string][] = [
      ["25/12/2026", "2:30 PM", "2026-12-25T14:30"],
      ["25-12-2026", "14:30", "2026-12-25T14:30"],
      ["25.12.26", "2.30pm", "2026-12-25T14:30"],
      ["2026/12/25", "14:30:00", "2026-12-25T14:30"],
      ["12/25/2026", "2pm", "2026-12-25T14:00"],
      ["25 Dec 2026", "1430", "2026-12-25T14:30"],
      ["Friday, 25th December 2026", "2:30 p.m.", "2026-12-25T14:30"],
      ["Dec 25, 2026", "noon", "2026-12-25T12:00"],
      ["25-Dec-26", "9am", "2026-12-25T09:00"],
      ["46016", "0.6041666667", "2025-12-25T14:30"],
      ["25/12/2026 2:30 PM", "", "2026-12-25T14:30"],
      ["2026-12-25T14:30:00Z", "", "2026-12-25T14:30"],
      ["", "25/12/2026 14:30", "2026-12-25T14:30"],
      ["25/12/2026 9:00 AM", "2:30 PM", "2026-12-25T14:30"],
    ];
    for (const [date, time, want] of cases)
      expect(importLocalTime(date, time), `${date} | ${time}`).toBe(want);
  });
  it("still rejects values that aren't dates", () => {
    for (const [date, time] of [
      ["soon", "10:00"],
      ["25/12/2026", "later"],
      ["31/02/2026", "10:00"],
      ["", ""],
    ])
      expect(() => importLocalTime(date, time)).toThrow();
  });
  it("bounds batch size and rejects negative or non-finite money", () => {
    expect(
      importInputSchema.safeParse({ mode: "clients", rows: [] }).success
    ).toBe(false);
    for (const price of [-1, NaN, Infinity])
      expect(
        importInputSchema.safeParse({
          mode: "appointments",
          rows: [{ name: "Client", price }],
        }).success
      ).toBe(false);
  });
});
