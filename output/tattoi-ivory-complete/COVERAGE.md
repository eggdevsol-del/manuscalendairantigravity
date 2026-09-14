# Coverage and verification

90 page/view scenarios and 45 nested flow states. Long screens include scroll sections. This inventory does not claim every possible data permutation is tested.

## Verification

- TypeScript and final production build passed.
- Unit suite: 59 files, 229 tests passed.
- All 135 capture scenarios completed without detected error boundaries or horizontal document overflow.
- Existing interaction checks passed for failed-note draft preservation, retry, layout transition and multi-sitting booking.
- Selected light/dark iPhone and iPad layouts checked. Collection uses 402 × 874 CSS pixels at 2× resolution.

## Limits

Isolated tRPC fixtures; external network blocked. Live Stripe payments, Google authentication, identity verification, notifications, backend persistence and native iOS accessibility were not exercised. No deployment. Payment confirmation screens illustrate states, not real charges. Gallery is a click-through review; functional implementation is in the source app.

## Pages

| Screen | Role | Path | Capture |
|---|---|---|---|
| Welcome back | public | `/login` | [PNG](screens/public-sign-in.png) |
| Your booking, together | public | `/signup` | [PNG](screens/public-client-sign-up.png) |
| Make room for your craft | public | `/signup?role=artist` | [PNG](screens/public-artist-sign-up.png) |
| Supply the craft | public | `/signup?role=merchant` | [PNG](screens/public-supplier-sign-up.png) |
| Let’s get you back in | public | `/forgot-password` | [PNG](screens/public-password-recovery.png) |
| Choose a new password | public | `/set-password?token=preview` | [PNG](screens/public-set-password.png) |
| Your secure sign-in link | public | `/auth/magic?token=preview` | [PNG](screens/public-magic-link.png) |
| Ella Morgan | public | `/ella-morgan` | [PNG](screens/public-public-artist.png) |
| Ella Morgan | public | `/start/ella-morgan` | [PNG](screens/public-booking-intake.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/public-booking-link.png) |
| Northside Studio | public | `/studio/northside` | [PNG](screens/public-public-studio.png) |
| Ella Morgan | public | `/shop/ella-morgan` | [PNG](screens/public-public-shop.png) |
| Events & workshops | public | `/events/ella-morgan` | [PNG](screens/public-public-events.png) |
| Secure your booking | public | `/deposit/preview` | [PNG](screens/public-deposit-link.png) |
| Your session balance | public | `/balance/101` | [PNG](screens/public-balance-link.png) |
| Review your payment | public | `/pay/preview` | [PNG](screens/public-payment-request.png) |
| Bookings | client | `/bookings` | [PNG](screens/client-bookings.png) |
| Tattoo project | client | `/projects/12` | [PNG](screens/client-booking-overview.png) |
| Tattoo project | client | `/projects/12?view=Messages` | [PNG](screens/client-booking-messages.png) |
| Tattoo project | client | `/projects/12?view=Files` | [PNG](screens/client-booking-files.png) |
| Tattoo project | client | `/projects/12?view=Payments` | [PNG](screens/client-booking-payments.png) |
| Messages | client | `/conversations` | [PNG](screens/client-inbox.png) |
| Messages | client | `/chat/12` | [PNG](screens/client-conversation.png) |
| Your profile | client | `/profile` | [PNG](screens/client-client-profile.png) |
| Your consent forms | client | `/profile?tab=forms` | [PNG](screens/client-client-documents.png) |
| Earlier appointments | client | `/waitlist` | [PNG](screens/client-earlier-appointments.png) |
| Your purchases | client | `/purchases` | [PNG](screens/client-purchases.png) |
| A few details | client | `/complete-profile` | [PNG](screens/client-complete-profile.png) |
| Today | artist | `/dashboard` | [PNG](screens/artist-today.png) |
| Business | artist | `/business` | [PNG](screens/artist-business.png) |
| Products | artist | `/products` | [PNG](screens/artist-artist-products.png) |
| Your events | artist | `/artist-events` | [PNG](screens/artist-artist-events.png) |
| Orders | artist | `/store-orders` | [PNG](screens/artist-store-orders.png) |
| Money | artist | `/money` | [PNG](screens/artist-money.png) |
| Calendar | artist | `/calendar` | [PNG](screens/artist-calendar.png) |
| Messages | artist | `/conversations` | [PNG](screens/artist-inbox.png) |
| Messages | artist | `/chat/12` | [PNG](screens/artist-conversation.png) |
| Tattoo project | artist | `/projects/12` | [PNG](screens/artist-project-overview.png) |
| Tattoo project | artist | `/projects/12?view=Files` | [PNG](screens/artist-project-files.png) |
| Tattoo project | artist | `/projects/12?view=Payments` | [PNG](screens/artist-project-payments.png) |
| Clients | artist | `/clients` | [PNG](screens/artist-clients.png) |
| Booking request | artist | `/lead/1` | [PNG](screens/artist-booking-request.png) |
| Cancellation waitlist | artist | `/waitlist` | [PNG](screens/artist-cancellation-waitlist.png) |
| Profile | artist | `/artist-profile` | [PNG](screens/artist-artist-profile.png) |
| Profile | artist | `/artist-profile?view=Portfolio` | [PNG](screens/artist-artist-portfolio.png) |
| Working hours & services | artist | `/work-hours` | [PNG](screens/artist-working-hours.png) |
| Supplies | artist | `/supplies` | [PNG](screens/artist-supplies.png) |
| Supply orders | artist | `/supply-orders` | [PNG](screens/artist-supply-orders.png) |
| Your purchases | artist | `/purchases` | [PNG](screens/artist-purchases.png) |
| Bank & payouts | artist | `/bank-payouts` | [PNG](screens/artist-bank-payouts.png) |
| Payment history | artist | `/payout-history` | [PNG](screens/artist-payout-history.png) |
| Notifications | artist | `/notifications-management` | [PNG](screens/artist-notifications.png) |
| Your plan | artist | `/subscriptions` | [PNG](screens/artist-plans.png) |
| Northside Studio | artist | `/studio` | [PNG](screens/artist-studio-schedule.png) |
| Northside Studio | artist | `/studio?view=Team` | [PNG](screens/artist-studio-team.png) |
| Northside Studio | artist | `/studio?view=Billing` | [PNG](screens/artist-studio-billing.png) |
| Studio invitations | artist | `/studio?view=invitations` | [PNG](screens/artist-studio-invitations.png) |
| Settings | client | `/settings` | [PNG](screens/client-settings.png) |
| Your profile | client | `/settings?section=profile` | [PNG](screens/client-settings-profile.png) |
| Notifications | client | `/settings?section=notifications` | [PNG](screens/client-settings-notifications.png) |
| Guided walkthroughs | client | `/settings?section=how-tos` | [PNG](screens/client-settings-how-tos.png) |
| Delete your account | client | `/settings?section=danger-zone` | [PNG](screens/client-settings-danger-zone.png) |
| Settings | artist | `/settings` | [PNG](screens/artist-settings.png) |
| Your profile | artist | `/settings?section=profile` | [PNG](screens/artist-settings-profile.png) |
| Notifications | artist | `/settings?section=notifications` | [PNG](screens/artist-settings-notifications.png) |
| Guided walkthroughs | artist | `/settings?section=how-tos` | [PNG](screens/artist-settings-how-tos.png) |
| Delete your account | artist | `/settings?section=danger-zone` | [PNG](screens/artist-settings-danger-zone.png) |
| Settings | merchant | `/account-settings` | [PNG](screens/merchant-settings.png) |
| Your profile | merchant | `/account-settings?section=profile` | [PNG](screens/merchant-settings-profile.png) |
| Notifications | merchant | `/account-settings?section=notifications` | [PNG](screens/merchant-settings-notifications.png) |
| Guided walkthroughs | merchant | `/account-settings?section=how-tos` | [PNG](screens/merchant-settings-how-tos.png) |
| Delete your account | merchant | `/account-settings?section=danger-zone` | [PNG](screens/merchant-settings-danger-zone.png) |
| Business details | artist | `/settings?section=business` | [PNG](screens/artist-settings-business.png) |
| Your booking link | artist | `/settings?section=booking-link` | [PNG](screens/artist-settings-booking-link.png) |
| Forms & procedure records | artist | `/settings?section=regulation` | [PNG](screens/artist-settings-regulation.png) |
| Travel & guest spots | artist | `/settings?section=travel` | [PNG](screens/artist-settings-travel.png) |
| Import your data | artist | `/settings?section=data-import` | [PNG](screens/artist-settings-data-import.png) |
| Instagram import | artist | `/settings?section=instagram` | [PNG](screens/artist-settings-instagram.png) |
| Consultation requests | artist | `/settings?section=consultations` | [PNG](screens/artist-settings-consultations.png) |
| Home | merchant | `/dashboard` | [PNG](screens/merchant-supplier-home.png) |
| Orders | merchant | `/merchant/orders` | [PNG](screens/merchant-supplier-orders.png) |
| Products | merchant | `/merchant/products` | [PNG](screens/merchant-supplier-products.png) |
| Store settings | merchant | `/settings` | [PNG](screens/merchant-store-settings.png) |
| Messages | merchant | `/conversations` | [PNG](screens/merchant-supplier-inbox.png) |
| Messages | merchant | `/chat/12` | [PNG](screens/merchant-supplier-conversation.png) |
| Your purchases | merchant | `/purchases` | [PNG](screens/merchant-supplier-purchases.png) |
| Operations | admin | `/admin/operations` | [PNG](screens/admin-operations.png) |
| Error reports | admin | `/admin/errors` | [PNG](screens/admin-error-reports.png) |
| Page not found | client | `/not/a/route` | [PNG](screens/client-not-found.png) |
| Client Discover | client | `/discover` | [PNG](screens/client-discover.png) |

## Flow states

| Screen | Role | Path | Capture |
|---|---|---|---|
| Calendar | artist | `/calendar` | [PNG](screens/flow-booking-client.png) |
| Calendar | artist | `/calendar` | [PNG](screens/flow-booking-service.png) |
| Calendar | artist | `/calendar` | [PNG](screens/flow-booking-frequency.png) |
| Calendar | artist | `/calendar` | [PNG](screens/flow-booking-review.png) |
| Calendar | artist | `/calendar` | [PNG](screens/flow-booking-single.png) |
| Clients | artist | `/clients` | [PNG](screens/flow-new-client.png) |
| Clients | artist | `/clients` | [PNG](screens/flow-client-detail.png) |
| Clients | artist | `/clients` | [PNG](screens/flow-client-forms.png) |
| Clients | artist | `/clients` | [PNG](screens/flow-client-notes.png) |
| Messages | artist | `/chat/12` | [PNG](screens/flow-private-notes.png) |
| Messages | artist | `/chat/12` | [PNG](screens/flow-design-brief.png) |
| Working hours & services | artist | `/work-hours` | [PNG](screens/flow-services.png) |
| Working hours & services | artist | `/work-hours` | [PNG](screens/flow-service-editor.png) |
| Profile | artist | `/artist-profile?view=Portfolio` | [PNG](screens/flow-portfolio-upload.png) |
| Travel & guest spots | artist | `/settings?section=travel` | [PNG](screens/flow-travel-add.png) |
| Northside Studio | artist | `/studio?view=Team` | [PNG](screens/flow-studio-remove.png) |
| Bookings | client | `/bookings` | [PNG](screens/flow-past-bookings.png) |
| Bookings | client | `/bookings` | [PNG](screens/flow-deposit-review.png) |
| Tattoo project | client | `/bookings` | [PNG](screens/flow-client-consent.png) |
| Products | merchant | `/merchant/products` | [PNG](screens/flow-product-details.png) |
| Booking request | artist | `/lead/1` | [PNG](screens/flow-archive-request.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/flow-intake-idea.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/flow-intake-placement.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/flow-intake-reference.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/flow-intake-placement-photo.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/flow-intake-details.png) |
| Ella Morgan | public | `/book/ella-morgan` | [PNG](screens/flow-intake-review.png) |
| Tattoo project | client | `/bookings` | [PNG](screens/flow-consent-signature.png) |
| Notifications | artist | `/notifications-management` | [PNG](screens/flow-notification-template.png) |
| Payment history | artist | `/payout-history` | [PNG](screens/flow-refund-review.png) |
| Tattoo project | artist | `/projects/12` | [PNG](screens/flow-session-reschedule.png) |
| Tattoo project | artist | `/projects/12` | [PNG](screens/flow-session-cancel.png) |
| Profile | artist | `/artist-profile?view=Portfolio` | [PNG](screens/flow-portfolio.png) |
| Profile | artist | `/artist-profile?view=Portfolio` | [PNG](screens/flow-portfolio-view.png) |
| Confirming your payment | public | `/deposit/preview?status=success` | [PNG](screens/flow-payment-confirming.png) |
| Confirming your payment | public | `/balance/101?status=success` | [PNG](screens/flow-balance-confirming.png) |
| Discovery / your artists | client | `/discover` | [PNG](screens/flow-discovery-home.png) |
| Forms & procedure records | artist | `/settings?section=regulation` | [PNG](screens/flow-consent-template.png) |
| Forms & procedure records | artist | `/settings?section=regulation` | [PNG](screens/flow-medical-template.png) |
| Tattoo project | artist | `/projects/12` | [PNG](screens/flow-session-finish.png) |
| Import your data | artist | `/settings?section=data-import` | [PNG](screens/flow-import-mapping.png) |
| Discovery / artist focus | client | `/discover` | [PNG](screens/flow-discovery-focus.png) |
| Your events | artist | `/artist-events` | [PNG](screens/flow-event-create.png) |
| Orders | merchant | `/merchant/orders` | [PNG](screens/flow-order-detail.png) |
| Ella Morgan | public | `/shop/ella-morgan` | [PNG](screens/flow-shop-cart.png) |

Latest cohesion audit: 123 route/viewport checks, 11 feed/dialog assertions, commerce recovery checks and the full 229-test unit suite passed. See [the audit report](audit/AUDIT.md) for fixes and release-validation limits.

Calendar follow-up: eight targeted regressions and 32 browser scroll checks passed; see [calendar details](audit/CALENDAR-SCROLL.md).

Close controls follow-up: 47 flow/calendar scenarios and 30 portfolio/map browser checks passed; see [the close-controls report](audit/CLOSE-CONTROLS.md).
