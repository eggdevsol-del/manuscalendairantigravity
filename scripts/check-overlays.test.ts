// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { scanOverlays } from "./check-overlays.js";
it("rejects a lazy app-v3 feature importing a raw dialog and never silently passes a missing entry", () => {
  const root = mkdtempSync(join(tmpdir(), "overlay-test-"));
  try {
    mkdirSync(join(root, "client/src/app-v3"), { recursive: true });
    mkdirSync(join(root, "client/src/components/ui"), { recursive: true });
    writeFileSync(join(root, "client/src/App.tsx"), 'import("./app-v3/Bad")');
    writeFileSync(
      join(root, "client/src/app-v3/Bad.tsx"),
      'import { Dialog } from "../components/ui/dialog"'
    );
    writeFileSync(
      join(root, "client/src/components/ui/dialog.tsx"),
      "export const Dialog = 1"
    );
    expect(scanOverlays(root).violations).toHaveLength(1);
    expect(() => scanOverlays(root, "missing.tsx")).toThrow();
    writeFileSync(
      join(root, "client/src/app-v3/Bad.tsx"),
      "export const Bad = () => <details><summary>Details</summary>Extra</details>"
    );
    expect(scanOverlays(root).violations).toEqual([
      "client/src/app-v3/Bad.tsx: use DetailsSheet for secondary information",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
