import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
export function validateSignoff(catalog, run, build) {
  const errors = [];
  if (run?.meta?.build !== build)
    errors.push(
      "Acceptance evidence must identify the exact build-info.json build."
    );
  if (!run?.matrixEvidence)
    errors.push("Missing supported device/service matrix evidence.");
  for (const role of ["qa", "security", "payments", "release"]) {
    const approval = run?.approvals?.[role];
    if (!approval?.name || !approval?.date)
      errors.push(`Missing ${role} approval.`);
  }
  for (const check of catalog.flatMap(g => g.checks)) {
    const result = run?.checks?.[check.id];
    if (!result) {
      errors.push(check.id + ": missing result");
      continue;
    }
    if (!result.owner || !result.evidence)
      errors.push(check.id + ": missing owner/evidence");
    if (result.status === "N/A") {
      if (!result.notes) errors.push(check.id + ": N/A needs an explanation");
      continue;
    }
    if (result.status === "Pass") continue;
    const waiver = run?.waivers?.[check.id];
    if (
      check.priority !== "P2" ||
      !waiver?.owner ||
      !waiver?.reason ||
      !waiver?.date
    )
      errors.push(check.id + ": unresolved " + result.status);
  }
  return errors;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    if (!process.argv[2])
      throw Error(
        "Provide the reviewed acceptance JSON: pnpm release:signoff path/to/run.json"
      );
    const catalog = JSON.parse(
      await readFile("docs/release/checklist.json", "utf8")
    );
    const run = JSON.parse(await readFile(process.argv[2], "utf8"));
    const { build } = JSON.parse(
      await readFile("dist/public/build-info.json", "utf8")
    );
    const errors = validateSignoff(catalog, run, build);
    if (errors.length) throw Error(errors.join("\n"));
    console.log("Recorded release acceptance is complete for " + build);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
