# Tattoi Pre-Launch Checklist

> **SSOT for deployment.** Complete every item before going live.

## 1. Database Schema

- [ ] Run `pnpm db:migrate` (or `npx drizzle-kit push`) to synchronize the schema, including migration `0034_artist_timezone` (`artistSettings.timeZone`)
  - `payment_ledger` table
  - `appointments`: deposit/balance payment tracking columns
  - `artistSettings`: `depositPercentage`, `allowUpfrontPayment`, `instantPayoutsEnabled`

## 2. Stripe Webhook Events

Register **all 8 events** at:  
**Stripe Dashboard → Developers → Webhooks → Add endpoint**

| Event | Handler | Purpose |
|---|---|---|
| `checkout.session.completed` | Deposit + balance + subscription ✅ | Ledger write, payment status |
| `payment_intent.succeeded` | Direct payment ✅ | Payment confirmation |
| `customer.subscription.updated` | Subscription status ✅ | Tier change, status sync |
| `customer.subscription.deleted` | Subscription cancelled ✅ | Revert to Free tier |
| `account.updated` | Connect onboarding ✅ | Sync account status |
| `charge.refunded` | Refund ledger ✅ | Negative ledger entry |
| `charge.dispute.created` | Dispute opened ✅ | Freeze payout, log dispute |
| `charge.dispute.closed` | Dispute resolved ✅ | Release or deduct |

**Endpoint URL:** `https://<your-domain>/api/stripe/webhook`  
**Signing secret:** Set as `STRIPE_WEBHOOK_SECRET` env var

## 3. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | ✅ | Server-side Pro price ID (for webhook tier matching) |
| `STRIPE_STUDIO_PRICE_ID` | ✅ | Server-side Studio price ID |
| `JWT_SECRET` | ✅ | At least 32 characters |
| `APP_URL` | ✅ | Public app URL; payment links in reminders are built from it |
| `RESEND_API_KEY`, `EMAIL_FROM` | ✅ | Email delivery (reminders, sign-in links) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | ❌ | SMS delivery; reminders fall back to email and push without it |
| `ONESIGNAL_API_KEY`, `VITE_ONESIGNAL_APP_ID` | ❌ | Push notifications |
| `VITE_STRIPE_PRO_PRICE_ID` | ✅ | Client-side Pro price ID (for checkout mutation) |
| `BALANCE_REMINDER_HOUR` | ❌ | UTC hour for balance reminders (default: 21 = 7am AEST) |

## 4. Stripe Product Setup

Prices are set in `shared/fees.ts` and `docs/PRICING_DECISION.md`: Free $0 with a 2% artist fee, **Pro A$99/month**, **Studio A$499/month** (up to 10 artists).

- [ ] Create a Product in Stripe Dashboard (live mode): "Tattoi Pro Plan"
- [ ] Create a Price: **$99.00 AUD / month, recurring**
- [ ] Create a Product "Tattoi Studio Plan" with a Price of **$499.00 AUD / month, recurring**, and set `STRIPE_STUDIO_PRICE_ID`
- [ ] Copy the Price ID (e.g., `price_1Xyz...`) 
- [ ] Set as both `STRIPE_PRO_PRICE_ID` and `VITE_STRIPE_PRO_PRICE_ID`
- [ ] Attach `artistId` metadata to the subscription in the checkout session (already done in code)

## 5. Stripe Customer Portal Configuration

**Stripe Dashboard → Settings → Billing → Customer Portal**

- [x] Allow customers to cancel subscriptions ✅
- [x] Allow customers to update payment methods ✅
- [ ] Disable "Switch plans" (only one paid tier)
- [ ] Disable "Update quantity" (N/A)

## 6. Stripe Connect Configuration

- [ ] Verify Connect onboarding flow works in test mode
- [ ] Confirm `account.updated` webhook fires on onboarding completion
- [ ] Test destination charge with `application_fee_amount` + `transfer_data`

## 7. Verification Steps

- [ ] Free tier artist: try to change the deposit percentage → should be rejected (Free is fixed at 25%)
- [ ] Pro artist: change the deposit percentage → saved and used on the next booking

- [ ] Create a Pro subscription → verify tier changes to `pro` in DB
- [ ] Cancel Pro subscription → verify tier stays `pro` until period ends
- [ ] Period ends → verify `customer.subscription.deleted` fires and tier reverts to `free`
- [ ] Test balance reminder: set `BALANCE_REMINDER_HOUR` to current hour, verify emails sent

## 8. Reminders, time zone and legal (added November 2026)

- [ ] Balance reminders: with a sitting starting in the next 18 hours that has a balance owing, run the scheduler (set `BALANCE_REMINDER_HOUR` to the current UTC hour) and confirm the client receives the payment link by email, and by SMS and push where configured. Confirm a second run does not resend.
- [ ] Time zone: set Business details → Time zone to a zone other than Brisbane, create a booking, and confirm it shows at the intended local time for artist and client.
- [ ] Legal: have `/privacy` and `/terms` reviewed by a lawyer, then set `LEGAL_REVIEWED = true` in `client/src/app-v3/pages/Legal.tsx` to remove the draft notice. Confirm the contact address in that file is monitored.
- [ ] Sign-up: confirm an account cannot be created without ticking the consent box.
- [ ] Data download: Settings → Your data and account → Download my data returns a file with no passwords, tokens or bank details.
- [ ] Native app identifier: `capacitor.config.ts` uses `com.manus.calendair`. This cannot be changed after the first App Store or Play Store release, so confirm or change it first.
- [ ] Server error alerting: connect an alerting service before taking live payments.
