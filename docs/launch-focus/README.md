# Artist-first launch experience — 2.14.0

This release implements the user's approved launch direction on `codex/tattoi-frictionless-rebuild`. It retains discovery and supplier features, and preserves the custom checkout and existing booking request form.

## Verified existing flow

The actual `/book/:slug` route uses `PublicArtistProfile`, not the older `/start/:slug` funnel. It loads the public artist profile, opens `BookingFormModal` after the profile loads, submits the request, and only then asks for a password. That sequencing was already implemented. The update preserves it and opens the specific project after account creation/sign-in. An existing client gets existing-password wording and alternate sign-in/recovery links.

## Changes

- Artist navigation: Today, Calendar, Inbox, Clients, Business. Profile/booking link remains directly accessible from Today. Supplies has its own route and remains linked from Today.
- Today prioritises actual sessions and Needs you, then setup and business totals. Removed the old dashboard segment switching. Corrected raw appointment field mapping for payment figures, avoided calling a merely started session overdue, and made session projects directly accessible.
- Money summary identifies its reporting period and shows an unavailable state instead of a zero amount when its query fails.
- PageHeader prioritises the task title, with compact business identity and contextual Help. Existing safe-area ownership is preserved.
- Returning clients land in Bookings. Bookings includes artist/project links for enquiries as well as accepted sessions. Signed-in visits to the login/root page return to the appropriate workspace. A guarded project/chat link survives sign-in through an allowlisted return path.
- Project includes stored consultation briefs, reference/placement images, next-action guidance, sessions, forms, proposals and payment history. Existing form signing opens directly in a shared full-screen sheet. Forms for cancelled/completed/no-show sessions do not drive the next-action prompt.
- Reusable project links require the normal account session. Copy link and an artist-initiated SMS composer are available. No permanent bearer login link, automatic SMS delivery or SMS verification provider was added.
- Account claiming no longer grants a session for an existing email solely on possession of a publicly obtained booking-submission token. Existing clients must prove their existing password; token identifiers must match the stored lead; failed/mismatched Google exchanges fail closed. Existing non-client accounts cannot be claimed as clients.
- Booking confirmation notifications lead to the project (or Bookings fallback) instead of an obsolete profile/forms tab.
- 24 replayable workflow guides: 17 artist, 6 supplier, 1 client. Per-account read state; reading never marks business tasks complete. Help is accessible from shared page headers, and nested product, subscription, client, consultation and notification dialogs have relevant inline guidance. The booking wizard has an artist-only inline guide. Existing spotlight tours are retained, updated for Today and given safe-area positioning and keyboard navigation.
- Setup checklist profile/business tasks deep-link to their relevant sections. Supplier commerce remains available and gets its own role-specific guidance.

## Verification

- 121 tests passed in 33 files, including failed and mismatched Google-claim regressions. New coverage includes password-after-submission ordering, existing-account protection, redirect allowlisting, project states, and role/account isolation for guide progress.
- TypeScript check passed; production web and server builds passed. Existing build warnings concern analytics placeholders, a noise asset and bundle size; this change does not claim to resolve those unrelated warnings.
- Shared primitives: 107/108 passed on the initial run during edits; the one failed sheet scroll check passed in a settled rerun of all 12 sheet size/theme combinations. These are Chromium simulations of safe insets, not physical Safari tests.
- All 28 light/dark page and guide checks passed. Actual changed components are exercised by `scripts/ui-audit/check-launch-flows.mjs` using isolated sample data in the development-only audit fixture. It covers artist Today, artist/client Project, client Bookings, supplier home/products/orders, guide navigation and direct form review at iPhone/iPad dimensions in light/dark themes.
- Test fixtures are not imported by the production application. No customer message, payment, signature or real booking is submitted by these browser checks.

## Test the release

1. As an artist, open Today; follow a session to Project; review Needs you and the money summary. Try the new bottom navigation.
2. Open the public booking link signed out. Confirm the profile/form appears before any password request, then submit only a test enquiry.
3. After password creation, confirm the specific project opens. Open its saved link on a signed-in device, and then signed out to check the return path.
4. As a client, review a pending proposal and use Review & sign forms for a session. Signing is an explicit user action.
5. Use the question-mark button on artist and supplier pages. Read, close and replay a guide; test the inline help inside product and booking workflows.
6. Use Prepare SMS link to review the proposed message in the phone's composer. The user chooses the recipient and sends it.

Automated SMS/OTP, physical-device wallet authorisation, actual email delivery and subscription lifecycle acceptance remain separate provider/device checks. This release does not turn the earlier beta limitations into a production certification.
