import { describe, expect, it } from "vitest";
import { isBundledOrigin } from "./const";

describe("isBundledOrigin", () => {
  it("is true for the origins the native shells serve bundled assets from", () => {
    // capacitor://localhost (iOS) and https://localhost (Android)
    expect(isBundledOrigin({ hostname: "localhost", port: "" })).toBe(true);
  });

  it("is false when the shell or browser loads the page from a server", () => {
    expect(isBundledOrigin({ hostname: "staging.example.com", port: "" })).toBe(
      false
    );
    expect(isBundledOrigin({ hostname: "localhost", port: "3000" })).toBe(
      false
    );
    expect(isBundledOrigin({ hostname: "192.168.1.20", port: "5173" })).toBe(
      false
    );
  });
});
