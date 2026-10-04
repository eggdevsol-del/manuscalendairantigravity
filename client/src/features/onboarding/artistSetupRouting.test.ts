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
});
