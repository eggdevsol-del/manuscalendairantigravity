// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./funnel.ts", import.meta.url), "utf8");

describe("public booking submit paths", () => {
  it("no longer has the unchecked submitFunnel procedure", () => {
    expect(source).not.toMatch(/\bsubmitFunnel\b/);
  });
});
