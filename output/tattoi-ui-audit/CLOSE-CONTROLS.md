# Close controls follow-up

The calendar booking sheet had two X buttons because its embedded inspector and the enclosing sheet both supplied dismissal. The iPhone sheet now owns the single close button; the standalone iPad inspector retains its own close control.

The client Home portfolio viewer also had two controls that dismissed the same view: a back chevron and an X. It now has one labelled, 44px Close artwork button. Previous/next artwork controls remain separate navigation actions. The viewer is portalled above the app, supports Escape and returns focus to the selected thumbnail after dismissal.

Browser testing also found that the Home header could intercept the artist map's close button. The map is now portalled above the page. Its close button respects the app's safe-area insets. The X inside the search field clears the query; it has a separate accessible label and does not dismiss the map.

The adjacent artist-card audit found nested action buttons and an invalid Chat destination for favourite-only artists. Chat and portfolio actions now have separate controls; artists without an existing conversation use the conversation creation flow with pending feedback and retry. The map's message action also retains its popup and explains failures so users can retry. Map marker colours now match their legend through shared Ivory tokens.

## Verification

- Full automated suite: **59 files, 229 tests passed**. TypeScript and production client build passed.

- `close-controls-results.json`: 47 scenarios passed, covering the existing 45 flow states plus the calendar inspector at 390px and 820px. The sweep inspected 29 rendered dialogs, verified one dismiss control per active dialog and clicked each to confirm dismissal. Flow states without a dialog were still checked for runtime failures.
- `screens/calendar-single-close-390.png` and `screens/calendar-single-close-820.png`: corrected calendar layouts.
- `screens/portfolio-single-close-390.png` and `screens/portfolio-single-close-820.png`: corrected portfolio viewer.
- `close-portfolio-results.json`: 30 browser checks passed across 390px and 820px, covering the single portfolio X, previous/next artwork, Escape, focus restoration, 44px targets, safe-area placement and distinct map close/clear actions. The map tiles are blank in the evidence because external tile requests were blocked.

The companion [portfolio and map findings](close-controls-findings.md) document the other reviewed surfaces and distinguish dismiss controls from field clearing and attachment removal.

The [artist-card report](ARTIST-CARD.md) covers existing conversation navigation, favourite-only Chat, portfolio Message, map Message and Discover consultation/Chat. It includes pending-state, failure/retry, request-payload and text-contrast checks.

These are isolated browser checks with mocked app data and external network requests blocked. They do not replace physical iOS device testing. The changes are in the application source on `codex/tattoi-ivory-design-system`. No deployment was performed as part of this audit.
