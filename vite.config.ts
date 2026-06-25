// import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { VitePWA } from "vite-plugin-pwa";

const plugins = [
  react(),
  tailwindcss(),
  // jsxLocPlugin(),
  vitePluginManusRuntime(),
  VitePWA({
    strategies: "injectManifest",
    srcDir: "src",
    filename: "sw.js",
    registerType: "autoUpdate",
    includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
    // manifest: false — each subdomain's HTML links its own manifest
    // (manifest-artist.json, manifest-client.json, manifest-merchant.json)
    // so we must not auto-generate a competing manifest.webmanifest
    manifest: false,
    devOptions: {
      enabled: true,
      type: "module",
    },
  }),
];

// Get version from package.json
const packageVersion = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
).version;

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, import.meta.dirname, "");

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion),
      "import.meta.env.VITE_ONESIGNAL_APP_ID": JSON.stringify(
        env.VITE_ONESIGNAL_APP_ID
      ),
      "import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_STRIPE_PUBLISHABLE_KEY
      ),
    },
    plugins: [
      ...plugins,
      {
        name: "html-transform",
        transformIndexHtml(html) {
          return html.replace(/%VITE_APP_VERSION%/g, packageVersion);
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    publicDir: path.resolve(import.meta.dirname, "client", "public"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname, "client/index.html"),
          artist: path.resolve(import.meta.dirname, "client/artist.html"),
          merchant: path.resolve(import.meta.dirname, "client/merchant.html"),
        },
      },
    },
    server: {
      host: true,
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
