import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = process.cwd(),
  source = path.join(root, "client/src");
const visited = new Set();
const records = [];
function resolve(spec, parent) {
  const base = spec.startsWith("@/")
    ? path.join(source, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(parent), spec)
      : null;
  if (!base) return null;
  return [
    base,
    base + ".tsx",
    base + ".ts",
    base + "/index.tsx",
    base + "/index.ts",
  ].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
}
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const text = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  for (const node of ast.statements) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const next = resolve(node.moduleSpecifier.text, file);
      if (next && /\.tsx?$/.test(next)) visit(next);
    }
  }
  if (!file.endsWith(".tsx")) return;
  const primitives = [
    ...new Set(
      [
        ...text.matchAll(
          /<(PageShell|PageWrapper|PageHeader|FullScreenSheet|HalfSheet|BottomSheet|ActionSheet|ModalShell|SheetShell|DialogContent|SheetContent|WizardShell)\b/g
        ),
      ].map(m => m[1])
    ),
  ];
  const headers = (text.match(/<header\b/g) || []).length;
  const fixed = /fixed[^\n"']*(?:inset-0|top-0)|position:\s*["']fixed/.test(
    text
  );
  records.push({
    file: path.relative(root, file),
    primitives,
    headers,
    fixed,
    localSafe:
      /app-viewport|app-document|app-safe|safe-area|mobile-header/.test(text),
    palette: /tokens|surfaces|colors|commerceTokens|DT\./.test(text),
    routes: [...text.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)].map(m => m[1]),
  });
}
visit(path.join(source, "App.tsx"));
// Associate route declarations in routers with their imported page modules.
for (const file of visited) {
  const text = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imports = new Map();
  for (const n of ast.statements)
    if (
      ts.isImportDeclaration(n) &&
      n.importClause?.name &&
      ts.isStringLiteral(n.moduleSpecifier)
    )
      imports.set(
        n.importClause.name.text,
        resolve(n.moduleSpecifier.text, file)
      );
  for (const match of text.matchAll(
    /<Route\b[^>]*?path="([^"]+)"[^>]*?(?:component=\{(\w+)\}|>\s*<(\w+))/g
  )) {
    const target = imports.get(match[2] || match[3]);
    const record = records.find(r => path.join(root, r.file) === target);
    if (record && !record.routes.includes(match[1]))
      record.routes.push(match[1]);
  }
}
records.sort((a, b) => a.file.localeCompare(b.file));
const rows = records.filter(
  r =>
    r.file.includes("/pages/") ||
    r.file.includes("/settings/") ||
    r.headers ||
    r.fixed ||
    r.primitives.length
);
let report =
  "# Navigable UI SSOT inventory\n\nGenerated from the App import closure (including nested settings, dialogs and re-exported shared components). Static review coverage is distinct from runtime scenario coverage; shared viewport fixtures exercise geometry, not business data or provider authentication.\n\n";
report += `Scanned ${records.length} imported JSX files; ${rows.length} page/layout/overlay records below.\n\n| Source | Route(s) | Shared UI boundary | Safe-area ownership |\n|---|---|---|---|\n`;
for (const r of rows)
  report += `| ${r.file} | ${r.routes.join(", ") || "Nested/component"} | ${r.primitives.join(", ") || "Specialised layout"} | ${r.localSafe ? "Explicit safe-area contract" : r.primitives.some(p => /Shell|Wrapper/.test(p)) ? "Inherited shared shell" : r.primitives.includes("PageHeader") ? "Header fallback / parent viewport" : "Parent layout; inspect local controls"} |\n`;
fs.mkdirSync("docs/ui-audit", { recursive: true });
fs.writeFileSync("docs/ui-audit/INVENTORY.md", report);
fs.writeFileSync(
  "docs/ui-audit/inventory.json",
  JSON.stringify(records, null, 2)
);
console.log(
  JSON.stringify(
    {
      jsxFiles: records.length,
      layoutRecords: rows.length,
      customBoundaries: records
        .filter(
          r =>
            (r.fixed || r.headers) &&
            !r.localSafe &&
            !r.primitives.some(p => /Shell|Wrapper/.test(p))
        )
        .map(r => r.file),
    },
    null,
    2
  )
);
