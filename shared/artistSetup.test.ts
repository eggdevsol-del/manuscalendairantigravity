import { describe, it, expect } from "vitest";
import { artistSetupProgress } from "./artistSetup";
const user = {
  name: "Alex",
  avatar: "https://example.test/photo.webp",
  phone: "0400000000",
  city: "Brisbane",
  country: "Australia",
};
const settings = {
  businessAddress: "1 Example St",
  businessCountry: "AU",
  workSchedule: JSON.stringify({
    monday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  }),
  services: JSON.stringify([
    { name: "Day", duration: 480, price: 1000, sittings: 1 },
  ]),
  stripeConnectAccountId: "acct_demo",
};
const stripe = {
  statusAvailable: true,
  detailsSubmitted: true,
  hasBankAccount: true,
  currentlyDue: [],
  chargesEnabled: false,
  payoutsEnabled: false,
};
describe("required artist setup", () => {
  it("orders saved requirements and requires city and country", () => {
    expect(
      artistSetupProgress({ ...user, city: " " }, settings, stripe).nextStep
    ).toBe("profile");
    expect(
      artistSetupProgress(user, { ...settings, businessAddress: "" }, stripe)
        .nextStep
    ).toBe("business");
    expect(
      artistSetupProgress(user, { ...settings, workSchedule: "{}" }, stripe)
        .nextStep
    ).toBe("hours");
    expect(
      artistSetupProgress(user, { ...settings, services: "[]" }, stripe)
        .nextStep
    ).toBe("services");
    expect(artistSetupProgress(user, settings, null).nextStep).toBe("bank");
  });
  it("rejects a schedule with no working day or invalid times", () => {
    for (const workSchedule of [
      "bad",
      JSON.stringify({
        monday: { enabled: false, start: "09:00", end: "17:00" },
      }),
      JSON.stringify({
        monday: { enabled: true, start: "17:00", end: "09:00" },
      }),
    ])
      expect(
        artistSetupProgress(user, { ...settings, workSchedule }, stripe)
          .nextStep
      ).toBe("hours");
  });
  it("does not accept unusable services", () => {
    for (const services of [
      "{}",
      JSON.stringify([{ name: "", duration: 480, price: 10 }]),
      JSON.stringify([{ name: "Day", duration: 0, price: 10 }]),
    ])
      expect(
        artistSetupProgress(user, { ...settings, services }, stripe).nextStep
      ).toBe("services");
  });
  it("allows submitted verification while keeping payments disabled", () => {
    expect(artistSetupProgress(user, settings, stripe)).toMatchObject({
      complete: true,
      nextStep: null,
      paymentsReady: false,
    });
  });
  it("requires a bank and no outstanding requirements, and fails closed on provider outage", () => {
    for (const status of [
      { ...stripe, hasBankAccount: false },
      { ...stripe, currentlyDue: ["external_account"] },
      { ...stripe, statusAvailable: false },
      { ...stripe, detailsSubmitted: false },
    ])
      expect(artistSetupProgress(user, settings, status).complete).toBe(false);
  });
});
