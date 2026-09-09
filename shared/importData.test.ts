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
      ["09-10-26", "10:00"],
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
