import { it, expect } from "vitest";
import { dailyEarnings, earningsPeriodStart } from "./dailyEarnings";
it("reconciles sales, fees and refunds while excluding payouts and disputes", () => {
  const row = {
    createdAt: "2027-01-01 23:00:00",
    amountCents: 10000,
    artistFeeCents: 100,
    transactionType: "deposit",
  };
  const points = dailyEarnings(
    [
      row,
      {
        ...row,
        transactionType: "refund",
        amountCents: -2000,
        artistFeeCents: -20,
      },
      { ...row, transactionType: "payout" },
      { ...row, transactionType: "dispute" },
    ],
    new Date("2027-01-01T00:00Z"),
    new Date("2027-01-03T00:00Z"),
    "Australia/Brisbane"
  );
  expect(points.reduce((s, d) => s + d.netCents, 0)).toBe(7920);
  expect(points.find(d => d.date === "2027-01-02")?.netCents).toBe(7920);
  expect(points.find(d => d.date === "2027-01-01")?.netCents).toBe(0);
});

it("returns exactly 30 calendar days including today across timezone and DST boundaries", () => {
  for (const zone of ["Australia/Brisbane", "America/New_York"]) {
    const end = new Date("2026-11-05T12:00:00Z");
    const points = dailyEarnings(
      [],
      earningsPeriodStart(end, 30, zone),
      end,
      zone
    );
    expect(points).toHaveLength(30);
    expect(points[0].date).toBe("2026-10-07");
    expect(points[29].date).toBe("2026-11-05");
    expect(points.every(p => p.netCents === 0)).toBe(true);
  }
});
