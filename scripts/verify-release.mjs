import { spawn, spawnSync } from "node:child_process";
import { build } from "esbuild";
const node = process.execPath;
function run(file, args = []) {
  const result = spawnSync(node, [file, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw Error(`${file} failed (${result.status})`);
}
let preview;
try {
  run("scripts/check-overlays.js");
  run("scripts/check-production-data.mjs");
  run("node_modules/typescript/bin/tsc", ["--noEmit"]);
  run("node_modules/vitest/vitest.mjs", ["run"]);
  run("node_modules/vite/bin/vite.js", ["build"]);
  await build({
    entryPoints: ["server/_core/index.ts"],
    platform: "node",
    packages: "external",
    bundle: true,
    format: "esm",
    outdir: "dist",
  });
  run("node_modules/tsx/dist/cli.mjs", ["server/scripts/copy-drizzle.ts"]);
  if (!process.env.AUDIT_URL) {
    preview = spawn(
      node,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "5198",
        "--strictPort",
      ],
      { stdio: "inherit" }
    );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1500);
      preview.once("exit", code => {
        clearTimeout(timer);
        reject(
          Error(
            `Local preview failed (${code}); set AUDIT_URL only for a known candidate preview.`
          )
        );
      });
    });
  }
  run("scripts/ui-audit/release-regressions.mjs");
  run("scripts/ui-audit/sitting-regressions.mjs");
  console.log(
    "Local release regressions passed. Physical-device and service acceptance is still required."
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  preview?.kill();
}
