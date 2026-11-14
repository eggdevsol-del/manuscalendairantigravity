import { Capacitor } from "@capacitor/core";

/**
 * True only inside the packaged iOS or Android app. Safe to call anywhere: a
 * browser, a test or a build without the Capacitor bridge reports false.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
