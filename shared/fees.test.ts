import { describe, expect, it } from "vitest";
import { calculateTransactionFees } from "./fees";
import { publicServices } from "./publicServices";

describe("payment fee contract", () => {
  it.each(["free", "pro", "top"] as const)(
    "charges the client one platform fee and routes the %s seller share",
    tier => {
      const small = calculateTransactionFees(1000, tier);
      expect(small.platformFeeCents).toBe(500);
      expect(small.clientTotalCents).toBe(1500);
      const large = calculateTransactionFees(20000, tier);
      expect(large.platformFeeCents).toBe(680);
      expect(large.clientTotalCents).toBe(20680);
      expect(large.artistFeeCents).toBe(tier === "free" ? 400 : 0);
      expect(large.clientTotalCents - large.stripeApplicationFeeCents).toBe(
        large.artistPayoutCents
      );
    }
  );
  it("rounds fractional cents and charges separately for deposit and balance", () => {
    expect(calculateTransactionFees(15015, "pro").platformFeeCents).toBe(511);
    expect(calculateTransactionFees(5000, "free").platformFeeCents).toBe(500);
    expect(calculateTransactionFees(15000, "free").platformFeeCents).toBe(510);
  });
});
describe("public service visibility", () => {
  it("includes only visible service descriptions and excludes internal fields", () => {
    expect(
      publicServices(
        JSON.stringify([
          { name: "Full day", description: "Six hours", price: 1200 },
          { name: "Private", showInFunnel: false },
          { name: "" },
        ])
      )
    ).toEqual([{ name: "Full day", description: "Six hours" }]);
  });
  it("handles absent or malformed legacy settings", () => {
    for (const input of [null, "broken", "{}", 12])
      expect(publicServices(input)).toEqual([]);
  });
});
