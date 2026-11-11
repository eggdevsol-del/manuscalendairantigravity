// @vitest-environment node
import { describe, expect, it } from "vitest";
import { withoutSecrets } from "./dataExport";

describe("account data export", () => {
  it("never includes credentials or provider secrets", () => {
    expect(
      withoutSecrets({
        name: "Rory",
        password: "hash",
        googleCalendarToken: "{}",
        resetPasswordToken: "x",
        bsb: "123-456",
        accountNumber: "1234",
        businessName: "Vale Tattoo",
      })
    ).toEqual({ name: "Rory", businessName: "Vale Tattoo" });
  });
});
