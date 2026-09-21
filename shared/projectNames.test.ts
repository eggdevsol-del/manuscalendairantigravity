import { describe, it, expect } from "vitest";
import { isDesignProjectName } from "./projectNames";
describe("tattoo identity guard", () => {
  it.each([
    "Session rescheduling/pricing discussion",
    "Deposit paid",
    "Appointment confirmed",
    "Booking proposal",
    "Payment reminder",
    "Date change",
    "Resheduling discussion",
  ])("rejects operational title %s", name =>
    expect(isDesignProjectName(name)).toBe(false)
  );
  it.each([
    "Jesus/Angels full arm",
    "Botanical forearm sleeve",
    "Koi fish thigh piece",
    "Memorial portrait",
  ])("accepts design title %s", name =>
    expect(isDesignProjectName(name)).toBe(true)
  );
});
