# Client bookings — 3.2.3

Bookings groups appointments by their existing session-plan identity, with every sitting visible, a highlighted next sitting, per-sitting status/date/deposit/balance, and project-level payment/form actions. Single-project iPad views arrange sittings side by side. Legacy standalone appointments remain separate rather than guessing their project membership.

Active projects include started sessions and all historical sittings from the same plan. Completed projects with an outstanding recorded balance stay accessible; closed completed, cancelled and no-show projects appear in Past. Intake requests and pending consultations now appear in Upcoming. Past empty states do not depend on unrelated pending proposals.

Payment request actions in both the list and project detail use the existing exact-token checkout, preserving the requested amount. Project details filter proposals, reference images and payment history by stable record/payment links. Historical references and transactions without a verified project link remain available in explicitly labelled unassigned disclosures. No historical financial records are rewritten or automatically reassigned.

Saved proposal names are reused on the list; missing historical plan names use the existing naming service, with retry feedback on failure. Balance checkout receives the tattoo project name. Client date-change/cancellation actions prepare an editable, session-specific message for the client to review and send; the appointment is not automatically changed or refunded. Form actions open the selected sitting's signing flow.

An unavailable payment verification no longer claims a payment was submitted. Existing pending payment checks poll with a bounded timeout and retain manual retry.

Validation: TypeScript, 188 tests across 48 files, Vite/PWA production build and server bundle. Isolated browser regressions cover phone and portrait/landscape iPad widths (440/820/1180): sitting visibility, intake requests, exact partial-payment amount/token, empty history, cross-project isolation, editable change requests, form deep links and layout overflow. Prior discovery/project-name regression checks also run. These use fixtures; they are not live payment reconciliation or physical Safari certification. No database migration is required.
