import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
export async function checkNativeAssets(
  web = "dist/public",
  native = "ios/App/App/public"
) {
  const errors = [];
  let count = 0;
  async function walk(dir = "") {
    for (const e of await readdir(join(web, dir), { withFileTypes: true })) {
      const file = join(dir, e.name);
      if (e.isDirectory()) await walk(file);
      else {
        count++;
        try {
          if (
            !(await readFile(join(web, file))).equals(
              await readFile(join(native, file))
            )
          )
            errors.push(file + " differs");
        } catch {
          errors.push(file + " missing from native package");
        }
      }
    }
  }
  await walk();
  if (!count) throw Error("No web assets found");
  if (errors.length)
    throw Error(
      "Native assets are stale; build and run ios:sync before packaging.\n" +
        errors.join("\n")
    );
  return count;
}
if (process.argv[1]?.endsWith("check-native-assets.mjs")) {
  try {
    console.log(
      `Native asset parity passed: ${await checkNativeAssets()} files.`
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
