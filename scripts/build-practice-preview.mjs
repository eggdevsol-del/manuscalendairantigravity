import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
const destination = "output/tattoi-artist-practice";
await mkdir(destination, { recursive: true });
await build({
  plugins: [
    {
      name: "offline-pwa",
      setup(build) {
        build.onResolve({ filter: /^virtual:pwa-register$/ }, () => ({
          path: "offline-pwa",
          namespace: "practice",
        }));
        build.onLoad({ filter: /.*/, namespace: "practice" }, () => ({
          contents: "export const registerSW = () => async () => {};",
          loader: "js",
        }));
      },
    },
  ],
  entryPoints: ["scripts/practice-preview.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  outfile: `${destination}/preview.js`,
  alias: { "@": "./client/src", "@shared": "./shared" },
  define: {
    __APP_VERSION__: '"practice-preview"',
    "import.meta.env": '{"DEV":true,"PROD":false}',
    "process.env.NODE_ENV": '"development"',
  },
  loader: {
    ".woff2": "dataurl",
    ".woff": "dataurl",
    ".ttf": "dataurl",
    ".svg": "dataurl",
    ".png": "dataurl",
  },
  logLevel: "warning",
});
await writeFile(
  `${destination}/index.html`,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data:; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:"><title>Tattoi · Artist practice preview</title><link rel="stylesheet" href="preview.css"><style>html,body{margin:0;background:var(--v3-paper);color:var(--v3-ink);font-family:Arial,sans-serif}button{cursor:pointer;font:inherit}*{box-sizing:border-box}.v3-screen{max-width:800px;margin:auto;height:auto;min-height:100dvh}.v3-scroll{overflow:visible}.practice-banner{color:var(--v3-paper)}.practice-guide{outline:2px solid var(--v3-line)}</style></head><body><div id="root"></div><script src="preview.js"></script></body></html>`
);
console.log(`${destination}/index.html`);
