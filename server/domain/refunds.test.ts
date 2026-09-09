// @vitest-environment node
import { describe, it, expect } from "vitest";
import { allocateRefund } from "./refunds";
describe("refund allocation", () => {
  it("preserves every cent in a deterministic session order", () => {
    expect(allocateRefund(10, [10, 10, 10])).toEqual([10, 0, 0]);
    expect(allocateRefund(300, [100, 200])).toEqual([100, 200]);
  });
  it("supports incremental cumulative refund updates without rounding drift", () => {
    const before = allocateRefund(1, [100, 200, 300]),
      after = allocateRefund(200, [100, 200, 300]);
    expect(after.map((v, i) => v - before[i]).reduce((a, b) => a + b, 0)).toBe(
      199
    );
  });
  it("rejects excessive, fractional and negative values", () => {
    for (const total of [301, -1, 1.5])
      expect(() => allocateRefund(total, [100, 200])).toThrow();
    expect(allocateRefund(0, [0, 0])).toEqual([0, 0]);
  });
});
