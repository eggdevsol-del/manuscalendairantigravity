import { describe, expect, it } from "vitest";
import { telemetryRoute, telemetryFrames } from "./telemetryPrivacy";
describe("telemetry privacy", () => {
  it.each(["pay", "deposit", "invite", "reset-password", "chat"])(
    "omits all identifiers in %s routes",
    route => {
      expect(
        telemetryRoute(
          `https://tattoi.test/${route}/secret-token?password=hidden#private`
        )
      ).toBe(`/${route}`);
    }
  );
  it("does not log public artist slugs or malformed URLs", () => {
    expect(telemetryRoute("https://tattoi.test/private-person")).toBe("/other");
    expect(telemetryRoute("secret")).toBe("/unknown");
  });
  it("drops exception text and frame URLs while retaining source positions", () => {
    expect(
      telemetryFrames(
        "Error: bearer secret\n at send (https://host/pay/secret?token=private:42:5)\n arbitrary secret"
      )
    ).toBe("frame:42:5");
  });
});
