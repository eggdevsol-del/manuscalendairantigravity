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
