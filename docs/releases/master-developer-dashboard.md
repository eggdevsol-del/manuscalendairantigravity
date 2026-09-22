# Private developer dashboard

## Access and activation
The unlinked `/dev/login` page accepts the configured username (default `MasterDevP`) and the provisioned account's hashed password. `/dev` is the dashboard. Neither role selection nor ordinary navigation advertises this role. Hiding the link is not the authorization boundary: every endpoint requires the `master_dev` database role, the matching `MASTER_DEV_USER_ID` environment setting and a dedicated signed session that expires after 30 minutes. Existing administrators do not automatically gain access.

No account has been provisioned and no production configuration was changed. Apply `server/migrations/20260922-supplier-visibility.sql` before deploying this release; it adds an active flag and leaves existing suppliers visible. Do not reuse a password posted in a conversation. From an interactive terminal against the intended database, run:

```sh
node scripts/provision-master-dev.mjs
```

The script asks for a recovery email, explicit database confirmation and a hidden password twice. It creates a single account, hashes the password with bcrypt, and prints the ID to configure as `MASTER_DEV_USER_ID`. Set `MASTER_DEV_USERNAME=MasterDevP` (or choose another username) and restart the server. Passwords are never embedded in source or printed. Unset the ID to revoke developer access. The sign-in endpoint limits attempts per IP; distributed deployments should additionally enforce a shared gateway rate limit.

## Dashboard
- Overview: registered account counts by role, bookings created in the last 30 days, recorded activity and ledger net earnings grouped by artist business country.
- People: search, role filters and pagination; booking status totals, ledger entries by type and reporting country, paid store orders and recorded business actions; account creation and profile edits.
- Suppliers: catalogue supplier search, paid directory-order totals separated by currency, add/edit, removal from the directory and restoration. Registered merchant accounts can also be managed through People → merchant, including their store sales metrics.
- Insights: geographic account concentration, regional bookings and active account counts, configured artist styles, common recorded tasks and average recorded earnings.

## Definitions and limits
- Account deactivation blocks authentication and protected API use, retains the original role for restoration and preserves bookings, payments and records. It does not cancel subscriptions, existing bookings or public payment links. This is access suspension, not personal-data erasure. Privileged accounts cannot be deactivated from these controls.
- Supplier removal is reversible: `isActive=0` hides the supplier/catalogue, removes reorder suggestions and blocks new checkouts. Order history is preserved. Already-created checkout sessions and existing orders are not cancelled. Restoration sets `isActive=1`.
- New accounts have an unknown random password and must use password recovery and normal onboarding. No email is sent by the developer create action itself. Existing account roles are preserved by profile edits.
- Ledger net is receipts (deposit, balance, store order) plus signed refunds, less artist fees. Payouts are transfers, not earnings. Disputes are shown separately in account ledger detail, not deducted from this net definition, matching existing earnings reporting. Reporting currency derives from artist business country (AU/AUD, NZ/NZD); unknown countries are marked unverified rather than combined. Store-order currency is explicit. This is operational reporting, not a tax statement.
- Booking averages divide non-cancelled bookings created in the last 30 days by all registered non-developer accounts. Usage averages use the same account denominator. Geography is self-reported city/country, not GPS; small role/location groups under five accounts are withheld.
- Styles count artists' configured offerings. There is no reliable historical booking-to-style attribution, so conversion or earnings by style are not invented.
- Only a bounded list of successful business actions is recorded, starting with this release: messages sent, proposals, bookings/reschedules/cancellations, deposit confirmation, supplier checkout review, promotions and waitlist actions. No message bodies, medical data, precise locations, passwords, card details or other action inputs are captured. Idle browsing, screen time, session duration, historical usage and unsuccessful actions are not measured. Retried successful requests may produce another action count; these are operation counts, not unique business outcomes.
- Reads of aggregate and individual metrics and account/supplier mutations write audit entries. Mutation audit writes are transactional with the change. Existing system-log retention affects the activity history available.

## Privacy review before production enablement
Access controls do not by themselves establish a lawful purpose. Confirm that Tattoi's privacy notice, access policy and applicable legal obligations permit these account-level operational metrics and new action analytics. OAIC guidance requires primary-purpose compatibility or an applicable exception for secondary use, alongside reasonable security protections:
- https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/more-guidance/guide-to-data-analytics-and-the-australian-privacy-principles
- https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-6-app-6-use-or-disclosure-of-personal-information

## Validation
Unit tests cover identity/role/session expiry, ordinary-role exclusion, deactivation/restoration, supplier hiding/restoration and order-history preservation, privilege creation rejection, duplicate email rejection and content-free action telemetry. Browser fixtures exercise narrow mobile layouts, editing, cancellation and supplier creation without changing real accounts. No real developer account, real storefront import, migration, deployment or external transaction was performed.

Final local results: **93 test files / 390 tests passed**. TypeScript, frontend production build, server bundle, overlay architecture and production-data guards passed. Production-preview browser checks passed at 320px and 390px for viewing metrics, account creation/editing, cancellation, supplier creation and confirmed removal; ordinary accounts were redirected away. The checks use isolated fixtures, not production identities or data. This is not a live-service or physical-device sign-off.
