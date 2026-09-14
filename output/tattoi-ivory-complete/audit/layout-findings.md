# Tattoi layout and navigation audit

Audit date: 15 September 2026. Existing React/Capacitor app, local Chromium with isolated fixtures. External network requests were blocked; this review did not write to a live account.

## Findings addressed

| Finding | Change | Evidence |
| --- | --- | --- |
| Page toggles were inside the padded scroll container, preventing edge-to-edge layout. | Added the shared `Screen.subheader` slot and moved 13 page families to it. iPhone page toggles span the usable width; their sections divide that width equally. | `client/src/app-v3/design/primitives.tsx`; `client/src/app-v3/design/ivory.css` shared geometry section; `layout-geometry.json`. |
| Toggle vertical positions varied with preceding content. Supplies put an orders link above its navigation; Artist Profile put profile metadata and multiple actions above its tabs; Inbox put search above its tabs; Studio put invitation actions first. | Page-level tabs now sit directly after the shared header, outside scrolling content. Body actions and search remain below them. | Supplies, ArtistProfile, Inbox and Studio page source. |
| Header height varied between a 44 px avatar and action buttons whose actual height was 50.390625 px. | Shared masthead geometry and a 22 px action line height produce a 50 px action control; title and subtitle areas have shared dimensions. | Final 18-case geometry run: all six tested page families place the toggle at y=258 px with the same simulated top safe area. |
| Four-tab project navigation used `flex: 1 0 auto`, creating unequal tabs and potential narrow-screen overflow. | Shared segments use equal flexible columns with wrapping text when necessary. | Overview / Messages / Files / Payments tested at 320, 402 and 440 px widths. |
| Several repeated interactive elements had smaller-than-44 px touch targets. | Shared CSS enlarged the masthead wordmark, conversation “Open booking” link and native disclosure summaries. The seven-day strip uses available screen width at small iPhone sizes so its day targets can remain 44 px wide. | Shared geometry and touch-target rules in `ivory.css`. Initial measurements: wordmark 32 px tall, booking link 20 px, product summaries 24.6 px. |
| Calendar day buttons announced only abbreviated weekday and day number. | Calendar and Today week selectors now have full weekday, date, month and year accessible labels, plus explicit `type="button"`. | `client/src/app-v3/pages/Calendar.tsx:135`; `client/src/app-v3/design/WeekAgenda.tsx:31`. |
| Page tab roles lacked explicit relationships to the active content. | The shared primitive now gives page tabs and their content associated tab/tabpanel identities. | `Screen` and `Tabs` in `primitives.tsx`; root cohesion audit checks keyboard selection. |

## Page families using the shared subheader

Today, Clients, Supplies, Artist Profile / Portfolio, Forms, supplier or artist store Orders, administrator Error Reports, Tattoo Project, Working Hours / Services, Client Bookings, Money, Studio and artist Inbox.

Client detail’s Bookings / Forms / Notes control remains inside its detail sheet. It uses the same segmented control sizing within the sheet’s available width; it is not a second page-level header. Conditional page tabs still follow their existing role and data availability rules. Chat hides the page header and subheader in the existing focused mobile conversation view.

## Measured iPhone geometry

Final measurements in `layout-geometry.json` cover Today, Clients, Supplies, Tattoo Project, Working Hours and Inbox at each viewport width below. Top safe area was 54 px; bottom safe area was 34 px. This is browser geometry, not an iOS simulator capture.

| Viewport width | Toggle x | Toggle y | Toggle width | Toggle height | Cases |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 320 px | 0 px | 258 px | 320 px | 52 px | 6 |
| 402 px | 0 px | 258 px | 402 px | 52 px | 6 |
| 440 px | 0 px | 258 px | 440 px | 52 px | 6 |

All 18 cases had no document-level horizontal overflow. Images alongside this report show the captured layouts. The earlier 0.390625 px Clients offset was found during the audit and is resolved in the final measurement file.

The independent 90-route scan at 390 px found no uncaught page exceptions, error-boundary fallback or document horizontal overflow. `layout-scan.json` records that scan while work was in progress. Its raw `small` and `unlabelled` arrays are candidate findings, not a final accessibility verdict: native checkbox inputs can have larger associated label hit areas; clipped screen-reader-only controls and content inside closed details can have misleading DOM rectangles. Confirmed repeated-control issues are listed above and were corrected after that initial scan.

## Navigation review

Compared actual visible anchor destinations from the root cohesion scan with the active public router and artist, client and merchant shell route inventories. Eighty distinct local role/destination combinations matched an active route, public slug/store/event route, or an authenticated route that deliberately sends unauthenticated visitors to sign-in. No unresolved local destination was found in that captured set. Results: `navigation-findings.json`.

The role navigation definitions point to implemented destinations: artist Today / Messages / Calendar / Profile; client Discover / Messages / Bookings / Profile; merchant Home / Orders / Products / Messages. A separate browser check clicked all twelve main navigation destinations. All twelve reached the expected path and showed exactly one correct selected navigation item, with no error-boundary or missing-page fallback. Results: `navigation-check.json`.

This review does not prove every data-dependent link or external provider destination succeeds. Files, images, `mailto:` links and external URLs were excluded from app-route matching. Below-fold or conditional links absent from the captured set are outside that particular navigation check; the broader interaction audit covers additional flows.

## Scope limits

The layout review covers active application pages and repeated components, not unused historical implementations. It validates browser rendering and selected navigation behavior with sample data. Native VoiceOver, Dynamic Type, native keyboard behavior, provider redirects, live payments and account-specific backend responses still require release-device or integration validation. No claim is made that every possible runtime state has been exercised.

## Independent final change review

Reviewed the current product and order changes against `server/routers/storefront.ts`, plus shared tabs, chat mutation changes, profile/booking overlays and feed interactions.

- Found that clearing an existing product image URL would omit the field and keep the original image. The editor now sends explicit `null` on removal and the update API accepts that state.
- Found missing keyboard focus restoration in the new Radix modal wrappers without triggers. The feed owner added explicit restoration. Independent browser verification now passes: profile opens on Back, booking opens on Close, closing booking returns to Book Consult, and closing profile returns to the visible View Profile pill. Evidence: `overlay-focus-review.json`.
- Confirmed the artist profile header originally ignored the app’s computed safe-top variable: with `--app-safe-top: 54px`, its header still started at y=0 with height 61 px. A shared safe-area override is now applied. Recheck with the same 54 px safe area measured padding-top 62 px and a 44 × 44 px Back button at y=62 px. Evidence: `profile-safe-review.json`.
- Flagged the old booking confirmation’s fixed-position CSS transform conflicting with Framer Motion’s inline transform. The feed owner replaced it with confirmation content inside normal modal flow and verified its button remains reachable.
- Flagged long dynamic titles/subtitles as an exception to minimum-height header dimensions, so final header policy should explicitly preserve full content or apply a consistent visual limit without losing the accessible name.

No additional product/variant submission shape mismatch or order-fulfilment precondition mismatch was found in that review. Server order fulfilment only accepts paid orders, matching the newly exposed action. These findings and fixes supplement, rather than replace, the application’s integration and release validation.
