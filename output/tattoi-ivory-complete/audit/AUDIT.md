# Tattoi cohesion and interaction audit

This audit covers the current routed application and the shared components it uses. It fixes both visual inconsistencies and verified interaction defects. Browser checks use isolated data, with external network requests blocked.

## Layout and accessibility fixes

| Finding | Resolution |
|---|---|
| Today/Clients/Supplies shrank to content width because of a legacy align-self rule | Shared segments stretch to full available width with equal-width items |
| Page toggles appeared below different action rows or search fields | 13 page families now use the same Screen subheader slot |
| Four-label booking toggle could exceed small-screen width | Equal flexible segments with wrapping; no clipped labels |
| Masthead actions and avatars shifted the title/subheader position | Shared masthead dimensions and exact action line height |
| Missing/short subtitles changed page geometry | Consistent title and subtitle slots, retaining content and allowing text to grow when needed |
| Page tabs lacked their tab-panel association | Page sections now expose the active tab/panel relationship, keyboard navigation and focus |
| A tab inside a form could submit the form | Explicit button type prevents accidental submission |
| Wordmark, booking link, summaries and auth links had small targets | Enlarged interactive targets without changing destinations |
| Seven date cells became too narrow on 320px screens | Date strip uses the available small-screen width |
| Date controls omitted month/year from spoken labels | Full accessible date labels added |

At tested portrait iPhone sizes, workspace toggles span the safe-area width, have a 52px height and a common vertical position. Header typography, button sizes and spacing come from shared CSS tokens. Large or unusually long text can expand rather than being clipped. Focused conversations, discovery and dialogs retain their context-specific layouts.

## Functional fixes

| Finding | Resolution |
|---|---|
| Products view omitted existing product management operations | Restored create, edit, variant price/stock and publishing controls |
| Artist product view requested a merchant-only profile endpoint | Role-appropriate requests and settings destinations |
| Order view omitted fulfilment action | Restored Mark fulfilled with error feedback and retry |
| Product save failures could leave users without useful recovery | Draft-preserving save/retry flows verified |
| Clearing the image field preserved the saved product image | Explicit image removal is handled by the update contract |
| Earlier message send completion could erase a newer draft | Clear only the exact text that successfully sent |
| Failed optimistic message rollback could overwrite newly arrived messages | Remove only the failed optimistic message |
| Artist account role did not always represent its role in a booking | Provider/client controls follow the conversation relationship |
| Inbox request failures could look like an empty inbox | Show request errors and retry conversations, leads and consultations |
| Selecting the same failed photo upload again did not trigger input change | Reset the file input for retry |
| Artist profile feed like/share handlers were placeholders | Wired persistent actions and meaningful feedback |
| Failed likes remained visually selected | Roll back failed changes and prevent duplicate submissions |
| Sharing could report copied links when copying failed | Correct success, cancellation, fallback and failure handling |
| Empty filtered discovery offered no escape | Clear-filter and retry recovery controls |
| Discovery overlays could lose the underlying scroll reference | Separate stable base scroll ownership from animated overlays |
| Profile/booking overlays lacked consistent portal/focus handling | Portalled dialogs with focus management and reliable dismissal |
| Animated dialog exit could leave modal state active | Dialog open state follows motion presence |
| Inline booking retry/attachment and completion behaviour was inconsistent | Preserve failed drafts, clean preview resources and complete once |
| Clickable image/tag/description surfaces lacked button semantics | Keyboard-accessible controls with labels and consistent targets |
| Artist-card Chat was nested inside the portfolio button | Separate controls with independent actions and focus |
| Favourite-only artist Chat navigated to a synthetic conversation ID | Create or retrieve a real conversation, show pending state and recover from failure |
| Nearby map artist Message failures had no recovery feedback | Keep the popup open with a clear error and retry action |
| Map marker colours disagreed with the legend | Marker and legend share Ivory colour tokens |
| Legacy dark-card styling made recovery text and keyword chips hard to read | Contrasting Ivory surfaces and semantic text colours for retry panels and artist keywords |

## Verification evidence

- `cohesion-results.json`: route, viewport, segment geometry and keyboard checks.
- `layout-geometry.json`: independent measurements across 18 iPhone cases.
- `navigation-findings.json`: route matching for 80 local role/destination combinations.
- `navigation-check.json`: all 12 main navigation destinations clicked across roles.
- `screens/cohesion-interaction-report.json`: product and fulfilment browser checks for artist and supplier roles.
- `screens/`: revised layouts, restored commerce controls and feed success/recovery captures.
- `feed-browser-results.json`: eleven feed/dialog browser assertions.
- App review gallery: `../index.html`.

- Unit suite: **59 files, 229 tests passed**, including 41 new regression tests.
- Cohesion browser sweep: **123 checks passed** across 90 page/view scenarios and additional 320/440/820px layouts; includes dark mode.
- Page-level segments passed full-width, equal-width, height and keyboard checks.
- Nested flow capture: **45 flow states passed**.
- Feed and nested-dialog browser regression: **11 assertions passed**, including safe areas, focus restoration, failure recovery and successful acknowledgement.
- Commerce and conversation-role browser checks passed for artist and supplier; exact assertions and intercepted sample requests are in the JSON report.
- Existing failed-note retry, viewport-transition and three-sitting booking checks passed.
- TypeScript: **passed**. Production client build, server bundle and migration-copy build steps: **passed**.
- All 90 revised page screenshots completed without detected errors or horizontal overflow.

## Release validation scope

Local tests can verify handlers, route changes, request payloads, failure recovery and rendered layouts. They do not establish that a production account, payment provider, email/SMS provider or physical iPhone is configured correctly. Live Stripe payments, Google login, notification delivery, real persistence and native iOS/VoiceOver still require staging credentials and device verification. No live client messages, charges or external data changes were performed. These audit changes have not been deployed.

## Calendar momentum follow-up

Removed scroll-position feedback that could cancel iOS inertia. Appointment geometry and virtual-window recentering now wait until scrolling settles; native panning remains in control. Eight new regression tests and 32 Chromium browser checks passed. See [the detailed calendar report](CALENDAR-SCROLL.md).

## Close controls follow-up

Removed the second X from the iPhone calendar booking sheet and the redundant back-to-dismiss control from the client portfolio viewer. The map's close button now renders above the Home header and respects shared safe areas. A 47-scenario flow sweep and 30 portfolio/map browser checks passed. See [the close-controls report](CLOSE-CONTROLS.md) for findings, screenshots and coverage.

The adjacent artist-card audit corrected nested controls, favourite-only conversation creation and retry flows on Home and the artist map. See [artist-card verification](ARTIST-CARD.md) for request, navigation and contrast evidence.
