# Main refresh — Ivory presentation

Branch: `main-refresh`. Base: `main` at `aca9ee8df96102f5b05fa2f0bdfa520576a50919`.
The existing Ivory branches were not modified or merged.

## What changed

The original app now uses the existing Ivory light/dark palette, serif display lettering, system body typography, warm surfaces and understated shadows. `client/src/ui/ivory-theme.css` owns the palette; existing semantic classes and exported tokens resolve to it. Original header sizes, control dimensions, spacing, navigation, content and workflows remain in place. Narrow-screen heading tracking was adjusted to avoid introducing a wrap.

Shared sheets, segments, booking cards, checkout, dashboard and studio surfaces previously contained dark-only neutral colours. Their presentation literals now reference theme tokens. Media scrims, provider branding and meaningful status/calendar colours retain their roles. The original login sequence keeps its animation and workflow with Ivory styling.

Stripe Elements and embedded Connect appearance receive resolved semantic colours because provider iframes cannot inherit the app stylesheet. A small theme observer updates appearance when the existing theme control changes. Payment intent creation, amounts, fees, submission and callbacks are unchanged.

No server, schema, route, authentication, theme-selection logic, calendar engine, messaging controller or tour changes. No migrations or production deployment.

## Validation and limits

- Frontend-only `vite build` passes; the migration-running package build was deliberately not used.
- The existing suite remains at **16 passing / 8 failing**. New theme checks add **11 passing**, for **27 passing / 8 pre-existing failures** overall.
- Existing failures: four BottomNav tests lack `TeaserProvider`; four chat-controller tests lack required tRPC query mocks. These are present on unchanged main.
- TypeScript reports **146 diagnostics on both main and main-refresh**, with no additional diagnostic signatures. Existing issues include server schema/type mismatches. This is not a clean TypeScript baseline.
- 44 main-versus-refresh route screenshots: 11 screens × 320, 390, 820 and 1440 pixels. Another 22 refresh screenshots cover dark mode at 390 and 820 pixels. Artist, client, merchant and public views are represented.
- All 44 comparisons preserve control labels, destinations and input types. There are zero new horizontal overflow cases and zero flagged header/control geometry changes. Three login text differences reflect the original animated sequence timing.
- Browser interactions: **16 passing scenarios**, plus **4 merchant scenarios with the pre-existing placeholder limitation**, across four widths. Passing checks cover dashboard tabs, booking tabs and reschedule-to-chat, the existing theme switch and calendar scrolling. The merchant search input retains focus and accepts text, but Add New opens no form.
- Static scope verification checks unchanged component/expression structure outside the reviewed theme import and provider appearance hooks, and checks protected business source remains unchanged.
- Core light/dark foreground/background, muted text, primary button and destructive colour pairs meet 4.5:1 contrast. A regression test verifies embedded-provider palette updates when themes change.

All browser API requests use isolated fixtures. External requests are blocked; expected “Failed to load Stripe.js” errors therefore appear in both capture sets. No real payments, messages or merchant writes were performed. Live provider rendering/settlement, physical iPhone keyboard behaviour, native momentum and safe-area behaviour still require device/service testing; viewport emulation does not certify these.

## Findings preserved from main

The merchant Products screen is a placeholder: **Add New** and **Setup Shopify Sync** have no handlers. Its search field accepts input but has no catalogue filtering implementation. Merchant Orders likewise renders a placeholder and its filter button has no handler. These were not repaired because this branch explicitly preserves main's functionality.

Reschedule in the original bookings view opens its message thread; it is not a date-picker flow. That original behaviour is preserved. Payment and booking fixture data may not model every backend state; screenshots are theme evidence, not production data validation.

## Preview and reproduction

Local comparison gallery: `output/main-refresh/index.html`. Evidence lives alongside it in `before`, `after`, `after-dark` and `interactions` directories.

Run unchanged main in an isolated snapshot on port 5202 and this branch on 5201. If local OAuth settings are missing, supply a local-only `VITE_OAUTH_PORTAL_URL` and `VITE_APP_ID` in the preview process environment. Do not change production configuration.

```sh
node scripts/main-refresh/capture.mjs before
node scripts/main-refresh/capture.mjs after
REFRESH_THEME=dark node scripts/main-refresh/capture.mjs after
node scripts/main-refresh/interactions.mjs
node scripts/main-refresh/gallery.mjs
node scripts/main-refresh/check-scope.mjs
```

`AUDIT_BROWSER` can select a local Chromium executable; `AUDIT_URL` can override a capture server. Screenshots and fixture evidence are local artifacts; source, theme tests and reproducible audit scripts are committed with this report.
