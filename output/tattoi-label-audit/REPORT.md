# Tattoi button and toggle label audit

Audited source: `b3762663f0402558b94fa1e7557a475725b20587` on `codex/tattoi-ivory-design-system`. Report produced 15 September 2026. Application source was not changed.

**I cannot confirm that every control does what its label promises.** This audit found two inactive proposal controls, an ineffective booking-page visibility setting, an acceptance hidden behind a review label, and five destination/copy mismatches. Additional scope and geographical edge cases are recorded below.

## Coverage and what the evidence means

- Scanned 455 client source modules and followed the App import graph through 219 modules.
- Catalogued 584 import-reachable control candidates after excluding four router Switch components. This includes generic primitives, repeated/dynamic definitions and legacy conditional branches; it is not a count of unique live buttons.
- Rendered 135 page/flow scenarios at a 390 × 874 iPhone viewport, collecting 1192 control instances. Repeated navigation is included.
- Exercised 87 tab selections; each reached its selected state. The 135 scenarios produced no captured JavaScript/scenario errors.
- Completed 10 targeted isolated-browser checks; results include reproduced failures, behavior observations and the successful theme persistence check.
- Followed labels to destinations, state setters, form submission and mutation handlers; inspected server behavior for the consequential findings. Targeted results record actual click outcomes and mocked request arguments.
- Browser data was isolated with intercepted API fixtures and external requests blocked. Render success is not proof that every control was clicked, every server filter returned correct live data, or every downstream service completed. Generic inventories are deliberately not labelled “passed.”

The remaining end-to-end gap includes production persistence, real Stripe payment/webhook completion, account deletion, Google sign-in, email/SMS/push delivery, Instagram/Shopify imports, physical-device sharing and native iOS behavior. Those require authorized service-backed test accounts and device tests before an honest all-controls certification.

## Findings

### 1. Decline — older proposal review — High

**Path:** Client → Messages → a pending project_proposal → Review proposal → Decline.

**Actual result:** The dialog stays open and no mutation runs. Thread does not supply the onRejectProposal callback used by this button.

**Recommended correction:** Wire the rejection callback and verify proposal state after success.

Evidence: [BookingWizardContent.tsx:836](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/booking/BookingWizardContent.tsx:836>); targeted check `legacy-proposal-decline`.

### 2. Edit Booking — older proposal review — High

**Path:** Artist → Messages → project_proposal → Review proposal → Edit Booking.

**Actual result:** No editor appears. Thread supplies a proposal but no selectedAppointmentRaw; EditBookingModal returns null without an appointment.

**Recommended correction:** Resolve the relevant appointment before enabling the editor, or use an editor for the proposal data.

Evidence: [BookingWizardContent.tsx:1321](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/booking/BookingWizardContent.tsx:1321>); targeted check `legacy-proposal-edit`.

### 3. Show on your booking page — Medium

**Path:** Artist → Working hours & services → Services → add/edit service → checkbox → Save service.

**Actual result:** The showInFunnel flag is saved, but the current public booking form uses a fixed style list and never reads services or that flag. Switching it cannot show/hide the service on that page. The old funnel did consume it.

**Recommended correction:** Restore a service choice that respects visibility, or remove the unsupported setting.

Evidence: [WorkingHours.tsx:489](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/WorkingHours.tsx:489>); targeted check `booking-page-service-visibility`.

### 4. Review dates & deposit — Medium

**Path:** Client → Cancellation offers → offered slot → Review dates & deposit.

**Actual result:** This calls waitlist.accept before showing the review. The server creates a session plan and chat message and marks the entry accepted. Closing the sheet does not undo this; the accepted entry uses Continue to deposit rather than Leave waitlist. No payment is charged by this first tap.

**Recommended correction:** Show a read-only review first and make acceptance explicit, or label the action Accept offer & review deposit.

Evidence: [Waitlist.tsx:150](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/Waitlist.tsx:150>); targeted check `waitlist-review-mutates`.

### 5. Shopfront — Medium

**Path:** Client → Discover → Your artists and bookings → See Artist Map → artist marker → Shopfront.

**Actual result:** Opens /ella-morgan, an artist profile/booking page. It does not open /shop/ella-morgan and contains no cart.

**Recommended correction:** Link to the store route when a store exists, or rename the link View artist.

Evidence: [ArtistMapOverlay.tsx:643](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/client-profile/ArtistMapOverlay.tsx:643>); targeted check `map-shopfront`.

### 6. Later / Remind me about arrival later — Medium

**Path:** Artist → arrival prompt → Later.

**Actual result:** Dismisses the prompt for that appointment in the mounted shell. No timer or scheduled reminder is created. Advancing the isolated clock 20 minutes did not restore it. Remounting the shell may show it again, which is not a promised reminder.

**Recommended correction:** Implement a specific snooze interval or use Dismiss for both visible and accessible labels.

Evidence: [ArrivalToast.tsx:89](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/components/ArrivalToast.tsx:89>); targeted check `arrival-later`.

### 7. Check for updates — Low

**Path:** Settings → Check for updates.

**Actual result:** Immediately clears CacheStorage, unregisters service workers and reloads with a cache-busting URL. There is no preliminary available-version check or up-to-date result.

**Recommended correction:** Rename Reload latest version or implement a genuine check followed by an update action.

Evidence: [Settings.tsx:228](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/Settings.tsx:228>); targeted check `check-for-updates`.

### 8. Book Consult — Low

**Path:** Discover → View artist → Book Consult.

**Actual result:** Opens a tattoo-idea request form with style, placement and timeframe fields. Submission creates a consultation request; it does not reserve a consultation time. This is a wording/expectation issue, not a dead button.

**Recommended correction:** Use Request consultation consistently, and explain that the artist will respond before a date is confirmed.

Evidence: [ArtistProfileOverlay.tsx:310](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/client-home/ArtistProfileOverlay.tsx:310>); targeted check `book-consult-profile`.

### 9. Your orders — Track deliveries and reorder — Low

**Path:** Artist Today → Supplies → Your orders.

**Actual result:** Your orders opens the correct order list, but its subtitle promises tracking and reorder functions that the order-detail page does not provide. It shows payment/supplier handoff information.

**Recommended correction:** Change the subtitle to Review orders and payment status, or implement the promised controls.

Evidence: [Today.tsx:234](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/Today.tsx:234>) and [Purchases.tsx:139](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/Purchases.tsx:139>) (source trace).

The two proposal failures apply specifically to legacy `project_proposal` messages. They do **not** establish a defect in the newer `session_plan` “Decline plan” action or in studio invitation “Decline.” The missing props are visible at [Thread.tsx:339](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/Thread.tsx:339>); the editor guard is at [EditBookingModal.tsx:89](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/components/modals/EditBookingModal.tsx:89>).

Waitlist acceptance side effects are in [waitlist.ts:290](</Users/pip/Documents/GitHub/DOTS CODEX TEST/server/routers/waitlist.ts:290>). The public form's fixed style list and request flow are in [PublicArtist.tsx:22](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/PublicArtist.tsx:22>). The force-reload implementation is in [pwa.ts:140](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/lib/pwa.ts:140>).

## Additional inconsistencies and edge cases

10. **Show email / Show phone / Show website have narrower scope than “Public profile” implies.** They work for the authenticated in-app artist profile. The public profile/booking endpoint intentionally omits these fields and the public page does not render them. Even supplying visible contact values in an isolated fixture produces no contact links. This is a scope mismatch, not proof that the toggles never work. Clarify “In-app profile” or make intentional public contact visibility consistent. Evidence: [ArtistProfile.tsx:143](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/ArtistProfile.tsx:143>), [feed.ts:307](</Users/pip/Documents/GitHub/DOTS CODEX TEST/server/routers/feed.ts:307>), [feed.ts:408](</Users/pip/Documents/GitHub/DOTS CODEX TEST/server/routers/feed.ts:408>), [PublicArtist.tsx:105](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/PublicArtist.tsx:105>).

11. **Near Me fails at a valid latitude or longitude of zero.** The server checks `input?.lat && input?.lng`, so zero skips distance calculation and leaves distances null. This is a source-confirmed geographical edge case; ordinary Brisbane coordinates do not trigger it. Use null/undefined checks. Evidence: [auth.ts:128](</Users/pip/Documents/GitHub/DOTS CODEX TEST/server/routers/auth.ts:128>). Live GPS sorting was not certified.

12. **See Artist Map — “N artists near Brisbane” overstates the count.** The subtitle counts every returned artist with coordinates, without a distance/radius filter, and hardcodes Brisbane. An artist elsewhere can be counted as near Brisbane. Rename to “N artists on the map” or calculate an actual local count. Evidence: [ClientFeedTab.tsx:618](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/client-profile/ClientFeedTab.tsx:618>).

## Controls whose inspected behavior matches their wording

| Family | Observed or traced behavior | Evidence limit |
|---|---|---|
| Today / Clients / Supplies and bottom navigation | Destination routes match labels | Source destinations and scenario rendering |
| Overview / Messages / Files / Payments and other section tabs | Selected state and relevant panel branches change | 87 isolated tab selections; no assertion of live server filtering |
| Dark appearance | Applies dark mode, survives reload, switches back to light | Targeted browser pass |
| Show / Hide password; Keep me signed in | Changes input visibility; chooses localStorage vs sessionStorage for credentials | Handler/source trace; no live identity-provider sign-in |
| Request date change / Request cancellation | Opens Messages with the corresponding request draft | Correct request wording; does not claim immediate cancellation |
| New booking / Review proposal / Send proposal | Opens composer, reviews, then submits a session plan | Source wiring; older proposal exceptions above |
| New session-plan Decline / Keep plan | Confirmed decline mutation vs closing confirmation | Source wiring; distinct from legacy dead Decline |
| Finish session / Send payment request | Reviews session, sends outstanding-payment request where required | Source branch semantics; payment completion requires service validation |
| Add / Remove cart item and quantities | Updates the selected cart item with stock bounds | Source handlers and existing cart flow scenarios |
| Pay securely by card / Continue to secure checkout | Prepares checkout; final payment is a separate action | No live charge or webhook exercised |
| Report a cash payment / I’ve made the transfer | Reports for artist verification, rather than immediately claiming verified receipt | Client/server workflow trace |
| Calendar Previous / Next week, Today, Expand / Collapse | Changes week/date or agenda visibility | Source handlers and calendar scenarios |
| Search, style filters, Popular | Search/style predicates apply; popularity sorts booking counts | Source trace; isolated fixtures do not reproduce real rankings |
| Save / Add / Remove profile, product, notes, travel and studio actions | Corresponding editor and mutation handlers are present | Inventory/source review is not proof of production persistence |
| Like / Unlike, favourites, artwork navigation | Correct toggle/navigation handlers | Browser scenarios and source; live persistence not certified |
| Share artwork | Attempts native sharing or clipboard copy before success feedback | Source trace; physical iPhone share sheet not tested |
| Back / Next / Clear / Close in forms and tours | Changes the relevant local step, selection or open state | Source and scenario coverage; not a guarantee for every conditional state |

## Dormant code, not counted as an active failure

“Delete Imported Booking” in the old BookingWizardContent appointment mode only displays a success toast and closes; no deletion is implemented. The current Thread integration does not provide the appointment needed to reach that mode. Record this before reusing the old component, but do not confuse it with a confirmed live calendar action. Evidence: [BookingWizardContent.tsx:2065](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/booking/BookingWizardContent.tsx:2065>).

The compact FeedCard hides its separate “Book Consult” CTA. Its source handler should not be counted as an additional visible failure on the current compact Discover feed. Finding 8 was reproduced through the artist profile overlay instead.

## Audit files

- [Rendered control catalog](./rendered-control-catalog.csv): every control instance extracted from the 135 scenarios, with role, path, label and observed state.
- [Source control catalog](./source-control-catalog.csv): label expressions and handler/destination traces for import-reachable candidates.
- [Browser inventory](./browser-inventory.json): panel text, tab selections and scenario errors.
- [Targeted results](./targeted-results.json): reproduction results, mocked requests and theme checks.
- [Source inventory](./source-inventory.json): all scanned candidates, including inactive modules.
- [Screenshots](./screens/): selected reproductions.

Run the audit scripts from the repository root with the local preview on port 5196. Browser scripts use isolated fixtures and a local Chrome binary. The targeted script covers the suspicious interactions; it is not a substitute for service-backed acceptance tests.
