---
name: tattoi-studio-architecture
description: Comprehensive architecture, data contracts, legal vault compliance, fraud prevention, and design invariants for the Tattoi Multi-Artist Studio feature.
---

# Tattoi Studio Feature — Architecture & Technical Reference

This document serves as the Single Source of Truth (SSOT) for the **Studio Mode** feature within Tattoi. It defines the operational goals, data contracts, legal vault obligations, fee structure safeguards, and UI/UX design invariants.

---

## 1. Core Purpose & Operational Goals

The **Studio Mode** allows physical tattoo studio owners (who are typically verified tattoo artists themselves) to manage their physical shop, chairs, resident artists, and business health from a unified multi-artist dashboard.

### Key Capabilities:
1. **Team & Chair Management**:
   - Manage up to 10 resident or guest artist chairs.
   - Configure per-artist chair arrangements:
     - **Percentage Commission** (e.g., 30% shop / 70% artist).
     - **Weekly Fixed Chair Rent** (e.g., $350/wk settled automatically from payouts).
     - **Dynamic Tiered Commission** (e.g., 35% starting, stepping down as the artist hits monthly volume milestones).
     - **None / Owner** (0% shop cut for owner's own work).
2. **Inbound Inquiries & Smart Routing**:
   - Studio receives general inquiries via the studio booking link (`/s/[publicSlug]`).
   - Uses auto-brief summaries to match clients with the best-fit resident artist based on style match and schedule availability.
   - Studio routes the inquiry to the artist with a proposed date/time hold.
3. **Multi-Chair Master Calendar**:
   - Real-time aggregated view of appointments across the studio owner and all active resident artists.
   - Visual multi-artist heat grid, day view, and dots matrix.
4. **Shop Financials & Health Metrics**:
   - Real-time gross shop volume, studio earned commission, collected chair rent, and live Stripe balance.
   - 30-day per-artist breakdown: gross sales, shop cut, bookings count, no-shows, average session value, and chair utilization percentage.
   - Business health metrics: LTV (Lifetime Value), rebooking rates, new vs. returning clientele, and "Needs You" actionable queues.
5. **Shop Supplies Procurement**:
   - Centralized wholesale supplies tab for bulk shop ordering using the studio's verified Stripe payment method.

---

## 2. Fundamental Business & Legal Invariants

### 2.1 The Artist Client Ownership Rule
> [!IMPORTANT]
> **All clients procured through or serviced within the Studio feature remain the 100% intellectual, relational, and commercial property of the artist performing the tattoo procedure.**
> 
> If an artist departs a studio (`status: "departed"`):
> - Their clients, consultation histories, chat threads, portfolio images, and booking history remain linked to their personal artist account.
> - The studio retains only anonymized historical transaction line items in `studio_transactions` for tax and settlement reconciliation.
> - Studios cannot hold an artist's client list hostage or restrict client communication upon departure.

---

### 2.2 Shared Queensland (QLD) Form 9 & Medical/Consent Vault
Under the Queensland *Public Health Act 2005* and infection control regulations for higher-risk personal appearance services:
* **The Studio Licensee** is legally required to ensure that consent forms, client medical disclosures, and procedure records (QLD Form 9 equivalents: client identity, procedure date, anatomical location, needle batch numbers, sterilizer autoclave logs, and pigment lot numbers) are **permanently archived and immediately auditable on-site**.
* **Audit-Proof Multi-Artist Vault**:
  - Whenever an artist completes a booking or registers a signed consent form / Form 9 within the studio, an immutable copy is linked to the `studio_id`.
  - Stored permanently in Cloudflare R2 object storage with tamper-proof timestamps.
  - Accessible to the studio owner via a dedicated **"Compliance & Health Vault"** export in the event of an unannounced Queensland Health or local council inspection.
  - Remains in the vault even if the resident artist subsequently leaves the studio.

---

## 3. Single-Artist Fee Avoidance & Abuse Analysis

The user specifically requested an assessment of potential abuse vectors where a solo artist claims to own a studio to evade fees or manipulate balances.

### Potential Vulnerability Vectors & Structural Mitigations

| Vulnerability Vector | Potential Exploit | Tattoi Architectural Safeguard |
| :--- | :--- | :--- |
| **1. Fake Referral Routing** | An artist creates a fake studio to route bookings to themselves hoping for lower transaction fees. | **Uniform Fee Invariant**: Platform and Stripe processing fees (1.7% + 30¢ AUD Stripe + platform commission) apply identically to direct artist bookings and studio referral bookings. There is zero fee discount for self-referrals. |
| **2. Escrow & Deposit Bypass** | An artist attempts to mark bookings as "Studio Cash Settlement" to bypass Stripe deposit escrow and legal consent collection. | **Mandatory Deposit Pipeline**: All bookings originating on Tattoi require Stripe Connect deposit holds and signed digital consent forms before calendar confirmation, preventing unrecorded cash bypasses. |
| **3. Fake Chair Rent Write-Offs** | An artist invents fictitious resident artists to simulate deductions or artificial business expenses. | **Verified Identity Requirement**: Every invited resident artist must be an authenticated Tattoi user with their own verified phone/email. Arrears and rent deductions only process against real completed Stripe transactions. |
| **4. Studio Tier Gatekeeping** | An artist claims studio ownership without a physical studio footprint. | **Physical Studio Verification**: Studio creation requires a physical business address and verified Instagram handle. High-tier features (e.g., 5+ chairs, wholesale supplies) trigger Stripe KYC and business identity checks. |

---

## 4. Multi-Chair Master Calendar & Expanded Card Specification

Studio calendar cards must present critical shop-level context while adhering to the canonical design tokens.

### Expanded Calendar Card Data Contract:
When a studio owner taps an appointment card on the studio calendar, it expands into a rich SSOT inspection sheet containing:
```typescript
interface StudioCalendarExpandedCard {
  appointmentId: number;
  artist: {
    id: string;
    name: string;
    avatarUrl: string | null;
    chairBadge: string; // e.g. "Chair 3 · Commission (30%)"
  };
  client: {
    id: string;
    name: string;
    phone: string | null;
    isReturnClient: boolean;
  };
  project: {
    title: string; // e.g. "Full Sleeve Japanese Dragon"
    serviceName: string;
    sessionNumber: number; // e.g. 2
    totalSessionsExpected: number; // e.g. 4
    progressPct: number; // e.g. 50%
    designBriefSummary: string; // Auto-brief text from LLM / inquiry
  };
  financials: {
    totalQuoteCents: number;
    depositPaidCents: number;
    collectedToDateCents: number;
    remainingBalanceCents: number;
    studioCutCents: number; // Shop's cut from this session
    paymentStatus: "deposit_escrowed" | "balance_pending" | "completed" | "settled";
  };
  compliance: {
    form9Signed: boolean;
    consentFormSigned: boolean;
    medicalFlags: string[]; // e.g. ["Blood thinners", "Eczema"]
  };
}
```

---

## 5. Wholesale Studio Suppliers & Bulk Procurement

Studio owners can procure shop essentials (gloves, needles, ink caps, grip tape, green soap, barrier film) through the in-app **Suppliers Tab**.

### Rules for Studio Supplies:
1. **Payment Source**: Charged directly to the studio owner's linked Stripe payment method or deducted from available studio Stripe balances where permitted.
2. **Tax Invoicing**: Automatically generates ATO-compliant Australian Tax Invoices (GST included) attributed to the Studio business entity.
3. **Delivery Tracking**: Integrated courier tracking updates delivered into the studio's notification stream.

---

## 6. UI/UX Design System Invariants (SSOT Alignment)

1. **Exact Token Alignment**:
   - Studio pages must **NEVER** use ad-hoc custom font sizes or custom sticky role bars.
   - Must strictly consume canonical tokens from `@/ui/tokens`:
     - Page headers: `<PageHeader title="..." subtitle="..." />` with `tokens.header.pageTitle`.
     - Shell layout: `fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden bg-background`.
     - Inner scrolling: `<div className="flex-1 overflow-y-auto mobile-scroll px-4 sm:px-6 pt-2 pb-32">`.
     - Cards: `tokens.card.base`, `tokens.card.bg`, `border border-border`.
2. **Metric Definitions & Tooltips**:
   - **`% booked` (Chair Utilization)**: Calculated as `(bookedActiveHours / 140h standard monthly chair capacity) * 100`. Includes active, confirmed, and in-progress appointments scheduled on the artist's chair.
   - **`30D Gross`**: Sum of realized completed tattoo payments in the last 30 calendar days.
   - **`Bookings Count`**: Total count of completed appointments in the last 30 calendar days.
