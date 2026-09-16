import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// These are the implementation layer, not feature-owned dialogs.
const foundations = new Set([
  "client/src/components/ui/index.ts", // primitive barrel
  "client/src/components/ui/input.tsx",
  "client/src/components/ui/textarea.tsx", // composition context only
  "client/src/components/ui/overlays/modal-shell.tsx",
  "client/src/components/ui/overlays/sheet-shell.tsx",
  "client/src/components/ui/command.tsx",
  "client/src/components/ui/sidebar.tsx",
  "client/src/components/ui/ssot/BottomSheet.tsx",
  "client/src/ui/wizard/WizardShell.tsx",
]);
export function scanOverlays(root, entry = "client/src/App.tsx") {
  const src = path.join(root, "client/src"),
    visited = new Set(),
    violations = [];
  function resolve(spec, file) {
    const base = spec.startsWith("@/")
      ? path.join(src, spec.slice(2))
      : spec.startsWith(".")
        ? path.resolve(path.dirname(file), spec)
        : null;
    return (
      base &&
      [
        base,
        ...[".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].map(
          ext => base + ext
        ),
      ].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    );
  }
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    );
    function walk(node) {
      let spec;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        !node.importClause?.isTypeOnly &&
        !node.isTypeOnly
      )
        spec = node.moduleSpecifier.text;
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(node.arguments[0])
      )
        spec = node.arguments[0].text;
      if (spec) {
        const target = resolve(spec, file);
        if (target) {
          if (
            /\/components\/ui\/(dialog|sheet)\.[jt]sx?$/.test(
              target.replaceAll("\\", "/")
            ) &&
            !foundations.has(relative)
          )
            violations.push(relative + ": " + spec);
          visit(target);
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
  const start = path.join(root, entry);
  if (!fs.existsSync(start))
    throw Error("Overlay scan entry is missing: " + start);
  visit(start);
  return { modules: visited.size, violations };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const result = scanOverlays(process.cwd());
  console.log(
    `Checked ${result.modules} reachable modules, including app-v3 and lazy imports.`
  );
  if (result.violations.length) {
    console.error(result.violations.join("\n"));
    process.exitCode = 1;
  } else console.log("Overlay architecture check passed.");
}
