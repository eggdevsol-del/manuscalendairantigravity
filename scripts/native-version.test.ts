import { describe, expect, it } from "vitest";
// @ts-ignore plain .mjs script without type declarations
import { applyAndroidVersion, applyIosVersion } from "./native-version.mjs";

const pbx = `MARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\n`;

describe("native-version", () => {
  it("sets the iOS marketing version in every configuration and keeps the build number", () => {
    expect(applyIosVersion(pbx, "3.2.3")).toBe(
      `MARKETING_VERSION = 3.2.3;\nCURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 3.2.3;\nCURRENT_PROJECT_VERSION = 1;\n`
    );
  });
  it("sets an explicit iOS build number and rejects a non-integer one", () => {
    expect(applyIosVersion(pbx, "3.2.3", "7")).toContain(
      "CURRENT_PROJECT_VERSION = 7;"
    );
    expect(() => applyIosVersion(pbx, "3.2.3", "1.2")).toThrow();
  });
  it("is idempotent", () => {
    const once = applyIosVersion(pbx, "3.2.3");
    expect(applyIosVersion(once, "3.2.3")).toBe(once);
  });
  it("writes a literal Android versionName", () => {
    expect(
      applyAndroidVersion(`versionCode 1\nversionName "1.0"\n`, "3.2.3")
    ).toBe(`versionCode 1\nversionName "3.2.3"\n`);
  });
  it("leaves a build.gradle that reads package.json alone", () => {
    const g = `def p = parse(file('../../package.json'))\nversionName p.version\n`;
    expect(applyAndroidVersion(g, "3.2.3")).toBe(g);
  });
});
