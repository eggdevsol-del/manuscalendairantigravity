import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.manus.toi",
  appName: "TOI",
  webDir: "dist/public",
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "DEFAULT",
      backgroundColor: "#00000000",
    },
  },
};

export default config;
