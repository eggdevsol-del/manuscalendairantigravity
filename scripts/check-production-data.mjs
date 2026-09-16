import { scanOverlays } from "./check-overlays.js";
// Scope is intentionally narrow: block fixture/demo modules from the live import graph.
// This is not a claim that arbitrary numeric literals or business defaults are invalid.
const graph = scanOverlays(process.cwd());
const forbidden = graph.files.filter(file =>
  /(?:demoData|dashboardDemoData|[/.](?:fixtures?|mocks?)(?:[/.]|$)|\.(?:test|spec)\.)/i.test(
    file
  )
);
if (forbidden.length) {
  console.error("Production imports test/demo data:\n" + forbidden.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Production data guard passed: ${graph.modules} reachable modules; no fixture/demo modules.`
  );
