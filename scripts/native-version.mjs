// Keeps the native app versions in step with package.json ("version").
//
//   node scripts/native-version.mjs            write iOS and Android
//   node scripts/native-version.mjs --check    exit 1 if either is out of step
//   node scripts/native-version.mjs --ios      only iOS (or --android)
//
// iOS: MARKETING_VERSION = package.json version. CURRENT_PROJECT_VERSION (the
// build number, a whole number) is kept as it is unless TATTOI_IOS_BUILD_NUMBER
// is set; raise it for every upload of the same version to App Store Connect.
// Android: versionName = package.json version. When android/app/build.gradle
// already reads package.json itself there is nothing to write.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const GRADLE = "android/app/build.gradle";

export function applyIosVersion(source, version, buildNumber) {
  if (!/MARKETING_VERSION = [^;]+;/.test(source))
    throw new Error("MARKETING_VERSION not found in " + PBXPROJ);
  let next = source.replace(
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${version};`
  );
  if (buildNumber !== undefined)
    next = next.replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};`
    );
  const builds = [...next.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)];
  if (!builds.length || builds.some(m => !/^[1-9]\d*$/.test(m[1])))
    throw new Error("CURRENT_PROJECT_VERSION must be a whole number");
  return next;
}

export function applyAndroidVersion(source, version) {
  // build.gradle derives versionName / versionCode from package.json itself.
  if (/package\.json/.test(source)) return source;
  if (!/versionName\s+"[^"]*"/.test(source))
    throw new Error("versionName not found in " + GRADLE);
  return source.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
}

async function run(args) {
  const check = args.includes("--check");
  const only = ["--ios", "--android"].filter(a => args.includes(a));
  const { version } = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8")
  );
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error(`package.json version "${version}" must be x.y.z`);
  const build = process.env.TATTOI_IOS_BUILD_NUMBER || undefined;
  const targets = [
    ["--ios", PBXPROJ, s => applyIosVersion(s, version, build)],
    ["--android", GRADLE, s => applyAndroidVersion(s, version)],
  ].filter(([flag]) => !only.length || only.includes(flag));
  const stale = [];
  for (const [, file, apply] of targets) {
    const full = path.join(root, file);
    const source = await readFile(full, "utf8");
    const next = apply(source);
    if (next === source) continue;
    stale.push(file);
    if (!check) await writeFile(full, next);
  }
  if (check && stale.length)
    throw new Error(
      `Native version is not ${version} in: ${stale.join(", ")}. Run node scripts/native-version.mjs`
    );
  console.log(
    `Native version ${version}: ` +
      (stale.length ? `updated ${stale.join(", ")}` : "already in step")
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await run(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
