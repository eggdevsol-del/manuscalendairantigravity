import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("artist onboarding routing contract", () => {
  it("reserves the setup redirect destination before public artist slug routing", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    const gate = readFileSync(
      "client/src/features/onboarding/ArtistSetupGate.tsx",
      "utf8"
    );
    const routes = app.match(/const KNOWN_APP_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1];
    expect(routes).toBeDefined();
    const reserved = new Set(Array.from(routes!.matchAll(/"([^"]+)"/g), m => m[1]));
    const destinations = Array.from(gate.matchAll(/<Redirect to="([^"]+)"/g), m => m[1]);
    expect(destinations).toContain("/artist-setup");
    for (const destination of destinations)
      expect(reserved.has(destination.slice(1))).toBe(true);
    expect(reserved.has("bank-payouts")).toBe(true);
  });

  it("reserves every page the role shells serve, so none opens the public artist page", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    const routes = app.match(/const KNOWN_APP_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1];
    const reserved = new Set(Array.from(routes!.matchAll(/"([^"]+)"/g), m => m[1]));
    const missing: string[] = [];
    for (const shell of ["ArtistRoutes", "ClientShell", "MerchantShell"]) {
      const source = readFileSync(`client/src/shells/${shell}.tsx`, "utf8");
      for (const [, first] of source.matchAll(/path="\/([a-z0-9-]+)/g))
        if (!reserved.has(first)) missing.push(`${shell}: /${first}`);
    }
    expect(missing).toEqual([]);
  });
});
