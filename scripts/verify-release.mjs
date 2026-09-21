import { spawn, spawnSync } from "node:child_process";
import { build } from "esbuild";
const node = process.execPath;
function run(file, args = []) {
  console.log(`Release gate: ${file}`);
  const outputRoot = process.env.AUDIT_OUTPUT || "output/release-regressions";
  const group = /tour/.test(file)
    ? "tours"
    : file
        .split("/")
        .at(-1)
        .replace(/\.m?js$/, "");
  const result = spawnSync(node, [file, ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      AUDIT_OUTPUT: `${outputRoot}/${group}`,
      AUDIT_URL: process.env.AUDIT_URL || "http://127.0.0.1:5198",
      TOUR_CASE: "",
      TOUR_GROUP: "",
      TOUR_ROLE: "",
      TOUR_PATH: "",
    },
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
  run("scripts/ui-audit/project-cards-check.mjs");
  run("scripts/ui-audit/sheets-check.mjs");
  run("scripts/ui-audit/compact-cards-check.mjs");
  // Exercise contextual tours against the release build, including nested UI.
  run("scripts/ui-audit/complete-tours-check.mjs");
  run("scripts/ui-audit/tour-public-check.mjs");
  run("scripts/ui-audit/tour-features-check.mjs");
  run("scripts/check-tour-evidence.mjs");
  run("scripts/ui-audit/tour-interactions-check.mjs");
  run("scripts/ui-audit/contextual-tour-check.mjs");
  console.log(
    "Local release regressions passed. Physical-device and service acceptance is still required."
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  preview?.kill();
}
