import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Compare the actual HTTP policy with the script URL in the installed SDK.
// This detects loader domain changes as well as accidental policy regressions.
describe("Stripe Connect script policy", () => {
  it("allows the installed SDK loader without broadening script origins", () => {
    const require = createRequire(import.meta.url);
    const sdk = readFileSync(
      resolve(
        dirname(require.resolve("@stripe/connect-js")),
        "../src/shared.ts"
      ),
      "utf8"
    );
    const loader = sdk.match(/const V1_URL = "([^"]+)"/)?.[1];
    expect(loader).toBeTruthy();
    const source = readFileSync(
      resolve(process.cwd(), "server/_core/index.ts"),
      "utf8"
    );
    const directive = source.match(/"(script-src [^"]+)"/)?.[1];
    expect(directive).toBeTruthy();
    const origins = directive!.split(/\s+/);
    expect(origins).toContain(new URL(loader!).origin);
    expect(origins).not.toContain("https:");
    expect(origins).not.toContain("*");
    expect(origins).not.toContain("https://*.stripe.com");
  });
});
