---
name: tattoi-core-architecture
description: Comprehensive technical reference for Tattoi core architecture, data contracts, booking lifecycle, calendar/agenda dual-layer engine, legal/QLD Form 9 compliance, and advisory protocol.
---

# Tattoi Core Architecture & Behavioral Skill

## 1. MANDATORY ADVISORY PROTOCOL

> [!IMPORTANT]
> **Advisory-First Rule**: Whenever the user asks questions, seeks architectural feedback, reports UI/UX observations, or requests analysis, the agent **MUST advise, explain, and outline the technical plan first WITHOUT making changes to code or database**. Do not apply modifications or commit changes until the user provides explicit instruction (e.g. "yes", "proceed", "apply the fix").

---

## 2. Client Data Contracts & Compliance Invariants

### A. Minimal Required Client Fields Matrix (`users` table)

| Field Name | DB Column | Type | Critical System Dependency |
|---|---|---|---|
| **Client ID** | `id` | `varchar(64)` | Primary key linking appointments, conversations, forms, and notes. |
| **Role** | `role` | `varchar(20)` | **Must be `"client"`**. Enables client navigation, permissions, and booking funnels. |
| **Full Legal Name** | `name` | `text` | Displayed on Calendar Cards, Chat, Proposals, Stripe Receipts, and **QLD Form 9** (`clientName`). |
| **Email Address** | `email` | `varchar(320)` | Authentication, Stripe payment receipts, and automated booking notifications. |
| **Mobile Phone** | `phone` | `varchar(20)` | Required for SMS booking reminders, arrival notifications, and one-click SMS invites. |
| **Date of Birth** | `birthday` | `datetime` | **18+ Age Verification**, **QLD Form 9 compliance** (`procedure_logs.clientDob`), and **Birthday Outreach** tasks. |
| **Onboarding Flag** | `hasCompletedOnboarding` | `tinyint` | **Must be `1`**. Unlocks full client dashboard and feed access. |
| **City / Location** | `city` | `varchar(255)` | Local artist discovery matching and timezone resolution (`Australia/Brisbane`). |
| **Avatar URL** | `avatar` | `text` | Displayed in Chat, Client Profile side-sheet, and CRM Directory. |
| **Digital Signature** | `savedSignature` | `longtext` | Base64 PNG signature enabling **1-Tap digital signing** for Consent & Medical forms. |

### B. Relational Setup
* **`conversations` table**: Links client and artist. Setting `lastMessageSenderId = clientId` triggers the `new_lead` CRM task.

---

## 3. Services System & Deterministic Styling

### A. Data Model (`artist_settings.services`)
Serialized JSON array stored on the artist settings record:
* `name: string` (e.g., *"Full Day Session"*, *"Flash Tattoo"*)
* `duration: number` (in minutes, e.g. `60`, `240`, `420`)
* `price: number` (in dollars, e.g. `1500`)
* `sittings: number` (`1` for single sitting, `>1` for multi-session projects)
* `color: string` (Hex accent code, e.g. `#3b82f6`)
* `showInFunnel: boolean` (client intake visibility)

### B. Deterministic Pastel Hashing Engine (`styles.ts` & `tokens.ts`)
* Calendar events hash `appointment.serviceName || appointment.title` into 5 balanced pastel palettes:
  * **Orange**: `#FFE4C4` / text `#8B4513`
  * **Purple**: `#E6E6FA` / text `#4B0082`
  * **Green**: `#F0FFF0` / text `#006400`
  * **Pink**: `#FFF0F5` / text `#C71585`
  * **Blue**: `#E0F7FA` / text `#006064`
* Event cards use `border-l-4` with the hashed palette border and background tint.

### C. Mystery String Resolver
* When appointments are imported from external booking platforms with unmapped service strings, an **Unmapped Service** alert allows artists to batch-map them to active services via `resolveMysteryAppointments` in `appointmentService.ts`.

---

## 4. Calendar & Agenda Dual-Layer Engine

### A. Dual-Layer Sliding Architecture
* **Top Layer (`AgendaDayList.tsx`)**:
  * Fixed 7-day date strip (`CalendarDateStrip7.tsx`).
  * Virtualized infinite scroll (`@tanstack/react-virtual`) rendering day blocks.
  * Multi-artist columns in studio view.
  * Work schedule & Design Day badges.
  * Weekly income summary bar.
* **Underlying Layer (`AgendaBreakdownList.tsx`)**:
  * Slides down `55vh` when toggling `"Agenda"`.
  * Renders full-width **Session Cards** with countdown badges (`TODAY`, `TOMORROW`), sitting indices (`Session 1 of 4`), deposit vs. estimate stats, and live remaining balance bars.
  * In-card actions: Message Client, Reschedule, Cancel Session.

### B. Viewport & Scroll Invariants
* The underlying agenda layer must always have `flex flex-col w-full h-full` and `pb-[60vh]` with `touch-pan-y overscroll-contain` to ensure smooth native scrolling.
* Top layer modals and sheets must be portalled using `createPortal(content, document.body)` so they mount at `z-60` above the `z-30` chat input pill.

---

## 5. End-to-End Booking Lifecycle

1. **Trigger**: Artist taps **"BOOK"** in chat header (`ChatInterface.tsx`).
2. **Wizard Flow (`BookingWizardContent.tsx`)**:
   * Service selection $\rightarrow$ Frequency selection (if multi-sitting) $\rightarrow$ Date & slot selection (via `checkAvailability`) $\rightarrow$ Deposit & price review $\rightarrow$ Send.
3. **Proposal & Escrow**:
   * Renders `SessionPlanCard` or `ProjectProposalMessage` in chat.
   * Client clicks "Accept & Pay Deposit" and completes Stripe Connect checkout.
4. **Automated Database Ingestion**:
   * `appointments` table inserts 1 row per sitting with `sessionPlanId`, `sessionIndex`, `sessionTotal`, `status = "confirmed"`, `paymentStatus = "deposit_paid"`.
   * `consent_forms` table automatically creates `procedure_consent` and `medical_release` in `status = "pending"`.
5. **Day-of Execution**:
   * Client completes 1-tap intake signing (`InlineFormSigning.tsx`).
   * Artist confirms arrival (`ArrivalToast.tsx` / `AppointmentCheckInModal.tsx`).
   * Final checkout captures remaining balance $\rightarrow$ triggers `createProcedureLog(appointmentId)` to snapshot into `procedure_logs` (QLD Form 9).

---

## 6. Revenue Protection & Dashboard Tasks Engine

The task engine (`businessTaskGenerator.ts`) scans data points to trigger prioritized CRM tasks:
* **`new_lead`**: Client sent an inquiry; artist has not replied.
* **`lead_follow_up`**: Inquiry unanswered for >24 hours.
* **`deposit_collection`**: Proposal pending deposit payment.
* **`appointment_confirmation`**: Sitting scheduled in next 48 hours.
* **`birthday_outreach`**: Client birthday within $\pm 7$ days.
* **`healed_photo_request`**: 21–28 days after sitting completion.
* **`tattoo_anniversary`**: 365 days after sitting completion.
* **`invoice_delivered_work`**: Sitting completed with remaining balance unpaid.
