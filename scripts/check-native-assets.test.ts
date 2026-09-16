// @vitest-environment node
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { checkNativeAssets } from "./check-native-assets.mjs";
it("fails stale and missing assets, and accepts byte-identical assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-parity-"));
  const web = join(root, "web"),
    native = join(root, "native");
  try {
    await mkdir(web);
    await mkdir(native);
    await writeFile(join(web, "index.html"), "new");
    await expect(checkNativeAssets(web, native)).rejects.toThrow("missing");
    await writeFile(join(native, "index.html"), "old");
    await expect(checkNativeAssets(web, native)).rejects.toThrow("differs");
    await writeFile(join(native, "index.html"), "new");
    await expect(checkNativeAssets(web, native)).resolves.toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("Xcode shell gate rejects stale assets as well", async () => {
  const { spawnSync } = await import("node:child_process");
  const root = await mkdtemp(join(tmpdir(), "xcode-parity-"));
  const web = join(root, "web"),
    native = join(root, "native");
  try {
    await mkdir(web);
    await mkdir(native);
    for (const name of ["index.html", "build-info.json"]) {
      await writeFile(join(web, name), "current");
      await writeFile(join(native, name), "current");
    }
    expect(
      spawnSync("/bin/bash", ["scripts/check-native-assets.sh", web, native])
        .status
    ).toBe(0);
    await writeFile(join(native, "index.html"), "stale");
    expect(
      spawnSync("/bin/bash", ["scripts/check-native-assets.sh", web, native])
        .status
    ).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
