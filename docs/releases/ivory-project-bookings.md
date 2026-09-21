# Ivory project-based bookings

## Delivered behaviour

- `/bookings` displays an ordered, single-column list of tattoo project cards. Stable backend session-plan identities keep separate projects with the same artist apart; legacy standalone appointments remain separate.
- Active projects are ordered by their next active sitting. Completed projects are available in a quieter disclosure below the active list; the previous Upcoming/Past tabs are removed.
- Each project exposes its title, artist, next date, recorded payments/balance and sitting progress. Pending payment requests and consent actions remain visible without opening a sitting.
- Progress uses saved `sessionTotal` and completed appointment statuses. Missing, contradictory or invalid totals show a textual “total to be confirmed” instead of a fabricated percentage. Cancelled/missed appointments do not count as completed work. Progress is not a measure of artwork or payment completion.
- Sitting rows expand immediately underneath the selected row. Projects with more than four sittings show the next sitting initially and a View all control. A deep-linked sitting is always included even when the project is compact.
- The `/projects/:conversationId` workspace displays separate project cards instead of a project dropdown. Overview/Messages/Files/Payments tabs are removed. References and payment history are disclosures inside their own project; messages open the existing thread in a sheet. Existing session, resource and consent links remain supported.
- Pending proposals with booked sittings stay inside the same project card. Proposals without appointments retain a separate card and the existing deposit checkout, including platform fees.
- No database migrations or financial calculations changed. Existing authorized tRPC queries remain the data source; no demonstration data is imported into production.

## Validation

- TypeScript passes.
- Full unit suite: 327 passing tests across 77 files, including 13 new tests for progress, grouping, ordering and compact sitting disclosure.
- Production frontend build, reachable-module overlay guard and production-data guard pass.
- Project-card browser audit covers 320, 390 and 820 px: multiple projects with the same artist, unknown totals, accessible progress, inline expansion, project-specific references/payments, outstanding action links, completed projects, sitting and consent deep links, and reviewed date-change drafts without sending messages. Final audit also checks an existing proposal does not duplicate its project card.
- Existing client bookings audit passes at 440, 820 and 1180 px; existing sitting regressions cover artist/client project details, client workspace, studio, virtualized calendar disclosures, proposals and deposit fees.
- 14 affected contextual tour scenarios pass, including project resources, completed bookings, consent and payment sheets.
- Production release regression suite passes for message send visibility, image loading, history and incoming-message scroll anchors, and reduced viewport/composer layout.
- Native web assets are synced and parity checked. Physical iPhone testing and live payment settlement are not claimed by browser fixture tests.

The new project-card browser audit is included in `scripts/verify-release.mjs` for future regressions. All browser business requests are intercepted fixture responses; no real messages, charges, cancellations or consent submissions occur in these tests.

## Review

Screenshots and browser results: `output/tattoi-project-cards/`.
Run `scripts/ui-audit/project-cards-check.mjs` against a local candidate using `AUDIT_URL` and `AUDIT_BROWSER` as needed. Existing public resource links continue to use the current API permissions and backend project associations.

## Project summary refinement

Collapsed projects now list upcoming dates as plain text, with progress always visible. Completed dates are available when the project is expanded; entirely finished projects list their historical dates. One disclosure reveals all sitting rows and secondary resources. Urgent payment and consent actions remain visible. Deep links automatically open the relevant project, including reference, payment and form links.

Rescheduled labels are derived from the existing appointment audit log through a shared server reader. Both booking-list and project-summary responses use that reader. The existing reschedule mutation retains appointment ID, session-plan ID and financial state; project grouping continues to use the saved session-plan ID, never the date. No migration or generated example data was added.

Regression coverage checks plain date summaries, hidden secondary actions, rescheduled labels, one-step sitting access, retained project membership after date changes, progress, and existing deep links at 320, 390 and 820 pixels. Browser runs use intercepted fixtures, not live payments or production records.

## Bottom-sheet detail pattern (supersedes inline expansion above)

Booking proposals are compact selectable rows; selecting one opens the existing proposal review/checkout sheet with server-priced deposit and platform fee. All secondary disclosures in the active app-v3 pages now use shared bottom sheets, including project/sitting details, references, payments, completed projects, client notes, design briefs, transaction details, product variants/descriptions, service removal and bank-transfer instructions. Dates, progress and urgent booking actions remain visible on the page. Sheets restore focus to their triggers without scrolling and use the existing portal, safe-area and native-scroll shell. The architecture check rejects new inline `details` elements in app-v3.

Project titles read tattoo design context from text chat and cached design briefs, prioritising recent design decisions and excluding structured system traffic. Operational titles are rejected by a shared guard. Existing invalid names are hidden by presentation readers and repaired on booking/project load; valid saved names are retained. Historical projects use their original proposal boundary when newer plans exist, avoiding renaming an older tattoo from a newer tattoo's chat. Missing design context or LLM failures produce a neutral fallback. No database migration or bulk rewrite is required.

Validation uses mocked LLM responses and isolated browser fixtures, not production chat, live charges or outgoing messages. Physical iPhone behavior still requires device testing.
