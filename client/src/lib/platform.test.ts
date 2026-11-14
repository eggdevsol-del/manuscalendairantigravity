import { afterEach, describe, expect, it, vi } from "vitest";

const capacitor = vi.hoisted(() => ({
  value: undefined as undefined | { isNativePlatform?: () => boolean },
}));
vi.mock("@capacitor/core", () => ({
  get Capacitor() {
    return capacitor.value;
  },
}));
import { isNativeApp } from "./platform";

afterEach(() => {
  capacitor.value = undefined;
});

describe("isNativeApp", () => {
  it("is true inside the native shell", () => {
    capacitor.value = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
  });
  it("is false in a browser", () => {
    capacitor.value = { isNativePlatform: () => false };
    expect(isNativeApp()).toBe(false);
  });
  it("is false when Capacitor is absent or broken", () => {
    capacitor.value = undefined;
    expect(isNativeApp()).toBe(false);
    capacitor.value = {};
    expect(isNativeApp()).toBe(false);
    capacitor.value = {
      isNativePlatform: () => {
        throw new Error("bridge missing");
      },
    };
    expect(isNativeApp()).toBe(false);
  });
});
