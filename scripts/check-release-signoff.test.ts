// @vitest-environment node
import { expect, it } from "vitest";
import { validateSignoff } from "./check-release-signoff.mjs";
it("fails closed for missing, stale or blocked release evidence", () => {
  const catalog = [{ checks: [{ id: "PAY-01", priority: "P0" }] }];
  expect(validateSignoff(catalog, {}, "v1").length).toBeGreaterThan(0);
  const run = {
    meta: { build: "v1" },
    matrixEvidence: "device-record",
    approvals: Object.fromEntries(
      ["qa", "security", "payments", "release"].map(role => [
        role,
        { name: "Reviewer", date: "2026-09-16" },
      ])
    ),
    checks: {
      "PAY-01": {
        status: "Blocked",
        owner: "Reviewer",
        evidence: "test",
        notes: "",
      },
    },
  };
  expect(validateSignoff(catalog, run, "v1")).toContain(
    "PAY-01: unresolved Blocked"
  );
  run.checks["PAY-01"].status = "Pass";
  expect(validateSignoff(catalog, run, "v1")).toEqual([]);
  expect(validateSignoff(catalog, run, "v2").length).toBeGreaterThan(0);
});
