# Simple Ivory implementation

Implemented on `codex/tattoi-ivory-design-system`, starting at `1d3321482bab6d69fffff4e6fa89dd1818f4c055`.

## App changes

- Artist home is Messages; navigation is Messages, Calendar, Clients, Business.
- Client home is My Tattoos; navigation is My Tattoos, Messages, Discover, Profile.
- Shared Simple Ivory tokens control colours, surfaces, geometry, buttons and bottom-navigation blur/clearance, including dark mode.
- Client home displays next sitting, outstanding forms, project progress and sitting dates without a disclosure. Rescheduled sittings remain in their original project.
- Project routes show the selected project, with other projects accessible through named rows. Sitting details open directly, without the former project disclosure sheet.
- Sitting action availability is shared between shortcuts and the existing review sheet. Returning from reschedule/cancellation restores a working page and the review can reopen.
- Conversations retain the chat controller and structured messages; booking context is pinned and infrequent tools moved into Conversation tools.
- Business and Profile provide compact navigation to existing capabilities. Artist Shopfront has its own route linking products, orders, events and profile.
- Provider checkout, financial calculations, message mutations, calendar virtualization, forms and backend contracts remain in place. No backend files or database migrations were changed.

## Evidence

The review gallery is `output/tattoi-simple-implementation/index.html`. It compares four approved references with screenshots rendered by the actual app and indexes route and interaction captures.

- 346 tests / 80 files passed, including new shared session-action eligibility tests.
- TypeScript `--noEmit` passed.
- Vite production frontend build passed.
- 90 route smoke checks: no page errors, horizontal document overflow or invalid displayed amounts.
- 45 interaction scenarios passed, including direct sitting action reviews and close/reopen paths.
- 12 critical routes checked at 320px; five representative dark screens checked.
- Visual review corrected duplicated message-bubble styling, an unnecessary project wrapper, repeated artist names and narrow-screen time wrapping.

Tests use isolated fictional API responses. They establish rendering and local interaction behaviour, not live Stripe settlement, message delivery, uploads or external-provider health. Physical iPhone/iPad, VoiceOver and real keyboard testing remain required before release. This is not a claim of pixel-for-pixel equivalence across every state; content, media availability and operating-system font metrics differ from the fixed design fixtures.

No production deployment, remote push or production-data mutation was performed.

## Reproduction

Use the installed Node runtime to run `node_modules/typescript/bin/tsc --noEmit`, `node_modules/vitest/vitest.mjs run`, and `node_modules/vite/bin/vite.js build`.

Start Vite on localhost port 5220. Run `scripts/ui-audit/simple-ivory-capture.mjs` with `AUDIT_BROWSER` set to an installed Chromium executable. Set `IVORY_MODE=flows` for interactions, `AUDIT_WIDTH=320` for narrow checks, or `AUDIT_THEME=dark` for dark mode. Set `AUDIT_OUT` to a separate directory for each capture variant. All non-local requests are blocked and tRPC calls are fulfilled from fixtures.
