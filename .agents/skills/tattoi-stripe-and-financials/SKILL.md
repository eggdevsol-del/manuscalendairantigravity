---
name: tattoi-stripe-and-financials
description: Technical reference for Stripe Connect custom accounts, deposit escrow, platform fee calculation, webhook idempotency, and balance checkouts.
---

# Tattoi Stripe Connect & Financial Architecture

## 1. Core Principles & Business Rules

1. **Escrow & Split Deposits**:
   * Deposits are calculated per session or as a project lump sum and captured via Stripe Connect `PaymentIntent` or Stripe Checkout.
   * Multi-session plans calculate: `depositTotalCents = sum(sessions.depositCents)`.
   * Funds are attributed to the artist's Stripe Connect Custom Account with optional platform fee deductions.
2. **Payment Status Lifecycle**:
   * `pending_deposit`: Appointment or session plan created, awaiting payment.
   * `deposit_paid`: Deposit successfully captured via Stripe webhook; dates locked in calendar.
   * `fully_paid`: Remaining balance cleared at or after appointment completion.
   * `refunded`: Deposit or full payment refunded.
3. **Strict Webhook Idempotency**:
   * Webhook handlers (`checkout.session.completed`, `payment_intent.succeeded`) must verify payment intent IDs before mutating database records to prevent duplicate appointments or double-receipt issues.

---

## 2. Data Models & Database Columns

### A. `appointments` Financial Columns
* `price: int`: Base sitting price in dollars.
* `depositAmount: int`: Deposit required in dollars.
* `depositPaid: tinyint`: `1` if deposit received, `0` otherwise.
* `depositPaymentId: varchar(255)`: Stripe PaymentIntent ID.
* `balancePaymentId: varchar(255)`: Stripe PaymentIntent ID for final balance.
* `totalExpectedAmountCents: int`: Full project/session value in cents.
* `totalPaidAmountCents: int`: Cumulative paid amount in cents.
* `remainingBalanceCents: int`: `totalExpectedAmountCents - totalPaidAmountCents`.
* `paymentStatus`: Enum `['pending_deposit', 'deposit_paid', 'fully_paid', 'refunded']`.

### B. `session_plans` & `session_plan_items`
* `totalEstimateCents: int`: Sum of all session estimates.
* `depositTotalCents: int`: Sum of all session deposits due today.
* `status`: Enum `['pending', 'accepted', 'declined', 'withdrawn']`.

---

## 3. Stripe Checkout & Modal Workflow

1. **Client Plan Acceptance**:
   * Client clicks "Accept & Pay Deposit" on `SessionPlanCard.tsx`.
   * Opens `SessionPlanCheckoutSheet.tsx` (must be portalled to `document.body` at `z-60`).
2. **Payment Processing**:
   * Backend `sessionPlans.accept` creates Stripe `PaymentIntent` with `clientSecret`.
   * Rendered via `DotsCheckout.tsx` / Stripe Elements.
3. **Post-Payment Handshake**:
   * Webhook triggers `acceptSessionPlan()` creating concrete `appointments` rows.
   * Client frontend triggers immediate (0ms) and staged (600ms & 1500ms) query invalidations.

---

## 4. Refund & Cancellation Rules

* **Client Cancellation Policy**:
  * Deposits are non-refundable by default as communicated on the checkout summary (*"Deposit due now (non-refundable)"*).
  * If an artist grants a manual exception, refunds are processed via Stripe Connect dashboard / API endpoint.
* **Artist Reschedule**:
  * Rescheduling a sitting transfers the existing deposit to the new date without requiring a new payment.
