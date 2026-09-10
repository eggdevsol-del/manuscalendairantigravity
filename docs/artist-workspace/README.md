# Artist workspace — 2.15.0

Branch: `codex/tattoi-artist-workspace` (starts at `5c7f180`).

The approved concept centres Tattoi on running an artist’s working day. The branch uses the existing booking, identity and payment services and replaces the primary artist/client presentation with the approved warm neutral and gold direction.

## Working areas

- **Today**: next appointment, chronological day, payment/form readiness, expandable attention tasks and an unobtrusive setup checklist.
- **Inbox**: existing enquiries and conversations; tablet list/detail split.
- **Calendar**: phone day agenda and seven-day tablet calendar. Tablet selection shows booking details, forms, balance and message/manage actions. Smaller tablets use a compact navigation rail and a dismissible inspector. Week navigation, date selection, new proposals, rescheduling and cancellation remain available.
- **Clients**: searchable people list, functioning client creation, contact profiles, messaging and the existing detailed session-history view.
- **Business**: profile/booking link, income/payouts, working hours, supplies, waitlist, studio and settings.
- **Client bookings**: default landing after sign-in; pending deposits, upcoming/past appointments and messages. Discovery remains an optional destination. Public artist intake retains submission before password creation.
- **Booking workspace**: session selection, readiness, consent signing, request reference images, recorded payments and custom deposit/balance review. Dates use the session timezone. Account checks protect shared booking links; a login returns the client to the requested internal page.

## Design contract

`client/src/features/workspace/workspace.css` supplies the final shared semantic palette and workspace layouts. Existing CSS variables remain the interface used by older modules. `PageHeader`, `PageShell`, `Button`, `SheetShell` and the navigation component define the shared components; pages must not create new palette constants or overlay hosts.

- Warm paper surfaces, ink text, gold actions, restrained status tints.
- Clear page titles and legible supporting text.
- Compact rows instead of decorative metrics and nested cards.
- One responsive artist navigation: bottom tabs on phones, rail/sidebar on tablets.
- Safe areas consumed once by the page root; overlays portal independently.
- Forms and checkout use the same semantic tokens and existing transaction handlers.

The reference screenshots in `evidence/` are captures of the running React application with isolated sample responses, not screenshots of a connected customer's account. They demonstrate layout, not evidence of a processed payment.

## Functional corrections

- Restored the missing global host for registered booking actions, using the canonical portalled sheet.
- Connected Add client to the existing server mutation.
- Bounded calendar queries to the selected month plus one week either side; removed the old ten-year client fetch/virtual-scroll dependency.
- Added stable lanes for overlapping appointments and read-only handling for external calendar blocks.
- Preserved the time selected in the calendar’s quick-book form.
- Corrected Today’s UTC boundaries using the supplied local timezone.
- Protected appointment-proposal reads before loading conversation messages.
- Kept unread badges capped at 9+ and made task-loading failures explicit.

## Testing

- TypeScript check and production client/server builds.
- 117 automated tests, including calendar collision/UTC/cents regression checks and proposal access-control tests.
- Browser layout and interaction fixtures: `scripts/ui-audit/workspace-check.mjs` and `workspace-interactions.mjs`.
- 48/48 shared safe-area cases passed across light/dark themes, iPhone portrait/landscape, iPad portrait/landscape, large iPad and split view.
- Five browser interaction cases passed using isolated fixtures.
- Shared viewport checks: `scripts/ui-audit/check-viewports.mjs`.

Use `PLAYWRIGHT_PATH` if Playwright is installed outside the repository, `AUDIT_BROWSER` for a browser executable, and `AUDIT_URL` to select the local Vite URL (default `http://127.0.0.1:5174`). Fixtures intercept all API responses and block external requests. They do not submit real payments, send messages, or alter application data.

## Acceptance on the test environment

1. Sign in as an artist. Check Today, Clients, Inbox and Business.
2. Open Calendar on iPad. Select a booking, check the inspector, switch weeks, and create a proposal.
3. Open that booking from Today. Review its forms, session totals and messages.
4. Sign in as its client. Review a pending deposit in the custom checkout; sign an outstanding consent form; inspect upcoming and past bookings.
5. Repeat in the installed iPhone PWA, including reopening a private booking link after sign-out and returning through login.

Payment processing, wallet availability, notification delivery and device behaviour should be exercised in the existing Stripe sandbox on the deployed environment. Automated UI fixtures are not a substitute for those end-to-end checks. This branch requires no database schema migration.
