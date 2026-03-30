# Tattoi Pre-Launch Checklist

> **SSOT for deployment.** Complete every item before going live.

## 1. Database Schema

- [ ] Run `npx drizzle-kit push` to synchronize the new schema fields
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
| `VITE_STRIPE_PRO_PRICE_ID` | ✅ | Client-side Pro price ID (for checkout mutation) |
| `BALANCE_REMINDER_HOUR` | ❌ | UTC hour for balance reminders (default: 21 = 7am AEST) |

## 4. Stripe Product Setup

- [ ] Create a Product in Stripe Dashboard: "Tattoi Pro Plan"
- [ ] Create a Price: **$39.00 AUD / month, recurring**
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

- [ ] Free tier artist: submit a deposit below 37% → should be rejected
- [ ] Free tier artist: confirm BNPL options are NOT shown at checkout
- [ ] Pro tier artist: confirm BNPL options ARE shown at checkout
- [ ] Create a Pro subscription → verify tier changes to `pro` in DB
- [ ] Cancel Pro subscription → verify tier stays `pro` until period ends
- [ ] Period ends → verify `customer.subscription.deleted` fires and tier reverts to `free`
- [ ] Test balance reminder: set `BALANCE_REMINDER_HOUR` to current hour, verify emails sent
