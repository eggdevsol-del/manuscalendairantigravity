import { describe, it, expect } from "vitest";
import { feasibleOfferFrequencies } from "./offerFrequencies";
describe("offer schedule options", () => {
  it("offers only frequencies that fit the entire project", async () => {
    const result = await feasibleOfferFrequencies(6, async f => {
      if (f === "monthly") throw { data: { code: "PRECONDITION_FAILED" } };
      return { dates: Array.from({ length: f === "biweekly" ? 4 : 6 }) };
    });
    expect(result.feasible).toEqual(["consecutive", "weekly"]);
    expect(result.failure).toBeNull();
  });
  it("distinguishes network failure from verified unavailability", async () => {
    const error = new Error("offline");
    const result = await feasibleOfferFrequencies(6, async () => {
      throw error;
    });
    expect(result.feasible).toEqual([]);
    expect(result.failure).toBe(error);
  });
  it("does not invent a usable frequency when none fits", async () => {
    const result = await feasibleOfferFrequencies(6, async () => ({
      dates: [],
    }));
    expect(result.feasible).toEqual([]);
  });
});
