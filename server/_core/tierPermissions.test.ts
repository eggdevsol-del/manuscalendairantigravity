// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canAccessFeature } from "./tierPermissions";

describe("promotion access", () => {
  it.each(["free", "basic", "pro", "top", "elite", null, undefined])(
    "includes promotions on %s plans",
    tier => expect(canAccessFeature(tier, "canUsePromotions")).toBe(true)
  );
  it("does not unlock unrelated paid features", () => {
    expect(canAccessFeature("free", "canRemoveBranding")).toBe(false);
  });
});
