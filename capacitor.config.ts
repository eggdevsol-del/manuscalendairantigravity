import type { CapacitorConfig } from "@capacitor/cli";

// DEVELOPMENT ONLY. When CAPACITOR_SERVER_URL is set, the native shell loads the
// app from that remote URL instead of the web assets bundled in the binary.
// Store builds (App Store / Google Play) MUST leave CAPACITOR_SERVER_URL unset
// when running "cap sync": a shipped app that only wraps a remote website is
// rejected in review, and the generated native config would point at staging.
const stagingUrl = process.env.CAPACITOR_SERVER_URL;
if (stagingUrl && new URL(stagingUrl).protocol !== "https:")
  throw new Error("Native server URL must use HTTPS");

const config: CapacitorConfig = {
  appId: "com.manus.calendair",
  appName: "Tattoi",
  webDir: "dist/public",
  ...(stagingUrl ? { server: { url: stagingUrl, cleartext: false } } : {}),
  ios: {
    // The web app is edge to edge (viewport-fit=cover) and handles safe areas
    // itself with env(safe-area-inset-*).
    contentInset: "never",
    // Base colour of the default "Midnight" wallpaper (--wall-base), shown
    // behind the web view until the first paint so launch does not flash white.
    backgroundColor: "#1b1840",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "LIGHT",
      backgroundColor: "#00000000",
    },
  },
};

export default config;
