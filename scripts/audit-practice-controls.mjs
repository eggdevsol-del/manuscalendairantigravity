import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const starts = [
  "client/src/features/practice/PracticeControls.tsx",
  "client/src/shells/ArtistRoutes.tsx",
];
const visited = new Set(),
  calls = new Map(),
  controls = [];
function resolve(base, spec) {
  const full = spec.startsWith("@/")
    ? path.join(root, "client/src", spec.slice(2))
    : spec.startsWith("@shared/")
      ? path.join(root, "shared", spec.slice(8))
      : spec.startsWith(".")
        ? path.resolve(path.dirname(base), spec)
        : "";
  if (!full) return;
  for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"])
    if (fs.existsSync(full + suffix) && fs.statSync(full + suffix).isFile())
      return full + suffix;
}
function walk(file) {
  if (visited.has(file) || !file.includes("/client/")) return;
  visited.add(file);
  const text = fs.readFileSync(file, "utf8"),
    source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const dep = resolve(file, node.moduleSpecifier.text);
      if (dep) walk(dep);
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression.getText(source);
      const match = expr.match(
        /^trpc\.([\w]+)\.([\w]+)\.(useQuery|useMutation|useSuspenseQuery|useInfiniteQuery)$/
      );
      if (match) {
        const id = match[1] + "." + match[2];
        const loc = source.getLineAndCharacterOfPosition(node.getStart());
        calls.set(id, [
          ...(calls.get(id) || []),
          {
            source: path.relative(root, file),
            line: loc.line + 1,
            kind: match[3].includes("Mutation") ? "mutation" : "query",
          },
        ]);
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(source);
      if (
        [
          "button",
          "input",
          "select",
          "textarea",
          "a",
          "Action",
          "ActionLink",
          "Row",
          "SearchField",
          "NumericInput",
          "Tabs",
        ].includes(name)
      ) {
        const loc = source.getLineAndCharacterOfPosition(node.getStart());
        controls.push({
          source: path.relative(root, file),
          line: loc.line + 1,
          component: name,
          coverage: "runtime-highlight-guide",
          identity: "screen + surface + accessible label + control type",
          note: "Conditional controls are discovered when mounted. Mutations complete after adapter success; external actions are previews.",
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
starts.forEach(p => walk(path.join(root, p)));
const adapter =
  fs.readFileSync("shared/practiceControls.ts", "utf8") +
  fs.readFileSync("shared/practiceBusinessControls.ts", "utf8");
const supported = new Set(
  [...adapter.matchAll(/["']([a-zA-Z]+\.[a-zA-Z]+)["']/g)].map(m => m[1])
);
const other = new Set([
  "merchantAuth",
  "developer",
  "admin",
  "adminAnalytics",
  "operations",
  "errors",
  "reconciliation",
  "errorLog",
  "clientAuth",
  "publicFunnel",
  "publicPortal",
]);
const counterparts = new Set([
  "offers.use",
  "offers.transfer",
  "offers.resolveTransfer",
  "offers.preferences",
  "offers.setPreferences",
  "offers.requestSmsCode",
  "offers.verifySmsCode",
  "offers.purchase",
  "offers.balanceQuote",
  "offers.balanceCheckout",
  "offers.cancelBalanceCheckout",
  "reschedules.resolve",
  "sessionPlans.accept",
  "funnel.getBalanceInfo",
  "appointments.createBalancePaymentIntent",
  "waitlist.join",
  "promotions.redeemPromotion",
]);
const manual = new Set([
  "auth.logout",
  "auth.refreshToken",
  "push.subscribe",
  "push.unsubscribe",
  "push.test",
  "push.getPublicKey",
  "artistSettings.createStripeAccountSession",
  "artistSettings.getStripeOnboardingUrl",
  "artistSettings.createStripeAccountLink",
]);
const endpoints = [...calls].map(([id, locations]) => ({
  id,
  locations,
  coverage: supported.has(id)
    ? "isolated-mock-adapter"
    : manual.has(id)
      ? "provider-preview-guard"
      : counterparts.has(id)
        ? "client-counterpart-simulated-in-workflow"
        : other.has(id.split(".")[0])
          ? "other-role-excluded"
          : "unmapped",
}));
const baseline = JSON.parse(
  fs.readFileSync("docs/plans/practice-action-inventory.json", "utf8")
);
for (const action of baseline.routerActions) {
  const id = action.router + "." + action.action;
  action.coverage =
    endpoints.find(e => e.id === id)?.coverage ||
    (supported.has(id)
      ? "isolated-mock-adapter"
      : "not-in-current-artist-screen-graph");
}
baseline.artistScreenEndpoints = endpoints;
baseline.uiControls = controls;
baseline.generatedBy = "scripts/audit-practice-controls.mjs";
baseline.scope =
  "Artist route graph and conditional controls. Shared files also contain other-role exports; merchant operations are explicitly excluded. Query operations are internal read models, not separate user tutorials. Provider operations are guarded previews. No HTTP fallback.";
fs.writeFileSync(
  "docs/plans/practice-action-inventory.json",
  JSON.stringify(baseline, null, 2) + "\n"
);
console.log(
  JSON.stringify(
    {
      files: visited.size,
      controls: controls.length,
      endpoints: endpoints.length,
      unmapped: endpoints.filter(e => e.coverage === "unmapped").map(e => e.id),
    },
    null,
    2
  )
);

if (endpoints.some(e => e.coverage === "unmapped")) process.exitCode = 1;
