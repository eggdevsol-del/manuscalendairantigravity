# SSOT Flow Map Sources
This document provides evidence for every node and connection in the SSOT Flow Map, derived strictly from the current codebase.

## UI LAYER Nodes
- **Node: PageShell**
  - Path: `client/src/components/ui/ssot/PageShell.tsx`
  - Purpose: Root layout component for all authenticated views.
- **Node: GlassSheet**
  - Path: `client/src/components/ui/ssot/GlassSheet.tsx`
  - Purpose: Standardized surface container for content.
- **Node: FullScreenSheet**
  - Path: `client/src/components/ui/ssot/FullScreenSheet.tsx`
  - Purpose: Full-screen modal wrapper used for wizards (Booking, Promotions).
- **Node: BottomNav**
  - Path: `client/src/components/BottomNav.tsx`
  - Purpose: Consumer of the Action Registry for contextual navigation.
- **Node: PublicFunnel**
  - Path: `client/src/pages/funnel/PublicFunnel.tsx`
  - Purpose: Entry point for client consultation intake.

## STATE LAYER Nodes
- **Node: auth_state**
  - Path: `client/src/_core/hooks/useAuth.ts`
  - Purpose: Single Source of Truth for user identity and role-based gating.
- **Node: isTeaserClient (teaser_mode)**
  - Path: `client/src/contexts/TeaserContext.tsx`
  - Purpose: Flag gating the dashboard blur/lock UI; stored in `localStorage` as `calendair_teaser_mode`.
- **Node: ui_state (Action Registry)**
  - Path: `client/src/contexts/BottomNavContext.tsx`
  - Purpose: Centralized state for BottomNav buttons per-page.

## FLOW/WIZARD LAYER Nodes
- **Node: FunnelWrapper**
  - Path: `client/src/pages/funnel/FunnelWrapper.tsx`
  - Purpose: Orchestrates the multi-step consultation funnel logic.
- **Node: BookingWizard**
  - Path: `client/src/features/booking/BookingWizard.tsx`
  - Purpose: Step-based workflow for converting conversations into proposals/bookings.

## DATA/API LAYER Nodes
- **Node: Leads**
  - Path: `drizzle/schema.ts` (Table definition)
  - Purpose: Persisted raw intake data from the funnel.
- **Node: Consultations**
  - Path: `drizzle/schema.ts` (Table definition)
  - Purpose: Business-level entity linked to leads and conversations.
- **Node: Appointments**
  - Path: `drizzle/schema.ts` (Table definition)
  - Purpose: Persisted records of confirmed bookings.
- **Node: tagDerivationEngine**
  - Path: `server/services/tagDerivationEngine.ts`
  - Purpose: SSOT logic for computing tags from lead data.

## INTEGRATIONS Nodes
- **Node: OneSignal (Push)**
  - Path: `client/src/components/WebPushSettings.tsx`
  - Purpose: External notification service integration.
- **Node: Comms (Email/SMS)**
  - Path: `client/src/features/dashboard/useBusinessTasks.ts`
  - Purpose: Utilization of `mailto:` and `sms:` URI protocols for client communication.

## FLOW CONNECTIONS (Arrows)
- **Consultation -> Leads**
  - Evidence: `client/src/pages/funnel/FunnelWrapper.tsx` (Call to `trpc.funnel.submit.useMutation`)
- **Leads -> Conversations**
  - Evidence: `server/routers/funnel.ts` (Automatic creation of conversation on lead completion)
- **Booking -> Appointments**
  - Evidence: `client/src/features/booking/BookingWizard.tsx` (Call to `trpc.booking.confirm.useMutation`)
- **Gating: isTeaserClient -> Dashboard Lock**
  - Evidence: `client/src/pages/Dashboard.tsx` (Conditional blur and `Lock` icon based on `isTeaserClient`)
