# Selected experience — 3.2.0

Branch: `codex/tattoi-selected-experience`. Based on `8092273`.

This implements the first boundary recommended in the 13 September decision review: the shared shell, calendar, messages, dashboard and existing booking/payment workspace, plus the explicitly rejected supplier editors. The 134 unanswered comparisons remain undecided. This is not a claim that every suggestion in the notes is complete.

## Implemented

- Original role-specific bottom navigation on phones and iPads; removed the duplicate global side rail. Shared brand/header, safe-area spacing and tighter control corners use the new token system.
- Calendar date strip, per-day wizard entry, compact/expanded timeline detail, independently scrolling iPad agenda/inspector and an expanding phone day agenda. The bounded virtual date window extends in either direction and updates the active date on scroll. Preserves existing calendar queries, including artist/studio merging.
- Task priority gradients, task conversation design briefs and a selectable seven-day dashboard agenda with optional full-week expansion.
- Two-line ellipsis on conversation previews, independently scrolling list/thread/context panels, shared reference images and a details sheet on smaller screens. Existing artist-only Book action, composer, booking wizard and custom Stripe checkout remain.
- Session-plan identity separates different tattoos within the same conversation; standalone imported appointments remain separate. Session numbering and the session selector are scoped to the selected plan. Invalid session links no longer silently select another appointment. Pending proposals remain accessible before appointments exist.
- Existing pending payment requests are returned by the authorized workspace query and displayed instead of inviting a duplicate balance request. No new fee schedule or payment provider was introduced.
- Service numeric fields permit empty editing states; existing submit validation remains. Service colours are editable and used on matching calendar titles.
- Supplier catalogue is an image grid with read-only variants/stock and an Edit in Shopify link. Tattoi product/variant/fulfilment editors were removed from these pages; fulfilment links to Shopify.
- Arrival prompt now offers Later. Operational banners reserve space and sit below sheets so they cannot cover calendar actions or checkout dialogs.

## Existing behavior preserved and verified

- Three-sitting proposal submission, automatic booking UI and client notes retry/draft preservation.
- Six-step public booking request before password creation.
- Shared existing custom deposit/balance checkout implementation, consent and aftercare paths. Live Stripe transactions were not submitted in this pass.

## Remaining decisions and limits

- Historical briefs, reference files and ledger history are conversation-level records and explicitly labelled that way. Existing sessionPlanId separates session plans, but is not a newly introduced end-to-end project entity joining every lead, brief and payment. No historical records were automatically reassigned.
- Shopify OAuth/public distribution, checkout and platform-fee architecture remain unresolved. This frontend source-of-truth change does not establish bidirectional sync or provider approval. Legacy Tattoi-only orders need operational review before routing all fulfilment through Shopify in production.
- Complete contextual tours, notification-template redesign, studio departure/closure permissions, procedure PDF redesign and travel/reordering additions are separate unfinished follow-ups. Artist selling, events/social features and advertising are deferred.
- Device checks are Chromium viewport/touch/safe-area simulations with intercepted fixtures, not physical Safari or live backend certification. The branch needs a staging deployment for a real iPhone/iPad PWA test.

## Validation

- TypeScript and production Vite/PWA build.
- 169 tests across 43 files, including returning-client project separation and authorization coverage.
- 78 light/dark phone/iPad page cases across artist, client and supplier; no reported horizontal overflow or page errors.
- Four long-inbox tests (820/1180, light/dark): two-line clipping, independent scrolling and task gradients.
- Focused 440/820/1180 interactions: bottom navigation, actual wheel scrolling, previous/next virtual-window extension, bounded DOM, phone agenda, wizard entry, project switching and dashboard week.
- Existing booking interaction and six-step intake scripts pass.

Local screenshots: `/private/tmp/tattoi-selected-review`. Reproducible scripts in `scripts/ui-audit/` use `AUDIT_URL`, `PLAYWRIGHT_PATH` and optional `AUDIT_BROWSER`.
