import type { CapacitorConfig } from "@capacitor/cli";

const stagingUrl = process.env.CAPACITOR_SERVER_URL;
if (stagingUrl && new URL(stagingUrl).protocol !== "https:")
  throw new Error("Native server URL must use HTTPS");

const config: CapacitorConfig = {
  appId: "com.manus.calendair",
  appName: "Tattoi",
  webDir: "dist/public",
  ...(stagingUrl ? { server: { url: stagingUrl, cleartext: false } } : {}),
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "DEFAULT",
      backgroundColor: "#00000000",
    },
  },
};

export default config;
