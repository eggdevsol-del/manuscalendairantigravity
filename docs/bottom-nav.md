# BottomNav System Architecture

## Overview

The **BottomNav** is not just a navigation widget; it is a **system-level interaction controller** that facilitates 2D navigation:

- **Horizontal Axis (X):** Navigation between top-level functional areas (Pages).
- **Vertical Axis (Y):** Access to contextual actions relevant to the current page (Contextual Rows).

This system is designed to keep the main navigation clean while offering powerful, context-aware tools without cluttering the screen or requiring modal overlays.

## Interaction Model

The BottomNav interaction is strictly defined by physical axes:

1.  **Horizontal Scrolling (Main Nav):**
    - **Action:** Swipe Left/Right on the navigation pill.
    - **Result:** Scrolls the main button row to access top-level destinations (e.g., Dashboard, Messages, Portfolio).
    - **Behavior:** Standard scroll physics with snap points.

2.  **Vertical Paging (Contextual Actions):**
    - **Action:** Swipe Up (from Main Nav) or Swipe Down (from Context Row).
    - **Result:** Switches the _entire_ viewable row between the "Main Nav" and the "Contextual Row".
    - **Behavior:**
      - **Axis Locking:** The gesture locks to the Y-axis once vertical movement dominates.
      - **Capture:** Uses `Pointer Events` with `setPointerCapture` to track gestures even if the finger leaves the hit area.
      - **Commit:** A row switch only commits if the swipe exceeds a 25% threshold or high velocity. Otherwise, it snaps back.

## Registry Pattern

To maintain separation of concerns, the `BottomNav` component **does not know about specific pages or routes**. It acts as a dumb container that displays whatever functionality is registered by the current active page.

This is achieved via the `BottomNavContext` and the `useRegisterBottomNavRow` hook.

### How it Works

1.  **Registry:** The `BottomNavContext` maintains a registry of rows keyed by an ID.
2.  **Registration:** When a page loads (e.g., `Chat.tsx`), it calls `useRegisterBottomNavRow` to register its specific actions (e.g., `QuickActionsRow`).
3.  **Display:** The `BottomNav` listens to the context. If a contextual row exists for the active view, it enables vertical swiping and renders the registered row in the "down" slot.

### Example Usage

Inside a page component:

```tsx
// Chat.tsx
import { useRegisterBottomNavRow } from "@/contexts/BottomNavContext";
import { QuickActionsRow } from "@/features/chat/components/QuickActionsRow";

export default function Chat() {
  // Register the contextual row.
  // IMPORTANT: Memoize the content to prevent infinite registration loops.
  const quickActions = useMemo(
    () => <QuickActionsRow onAction={handleAction} />,
    [handleAction]
  );

  useRegisterBottomNavRow("chat-actions", quickActions);

  return <div>Chat Content...</div>;
}
```

## Architectural Rules (Non-Negotiable)

To preserve the maintainability and scalability of this system, the following rules must be strictly observed:

1.  **No Route Logic in BottomNav:**
    - ❌ **FORBIDDEN:** `if (location.pathname === '/chat') return <ChatActions />` inside `BottomNav.tsx`.
    - ✅ **REQUIRED:** `BottomNav` simply renders `{contextualRow}` provided by the context. Logic belongs in the _Page_.

2.  **Presentational Shell Only:**
    - The `BottomNav` component is responsible **only** for layout, gesture handling, and animation. It must never contain business logic, data fetching, or hardcoded action buttons.

3.  **Single Source of Truth:**
    - The `BottomNavContext` is the sole authority on what is currently displayed in the contextual slot.

## Terminology

- **Main Nav:** The default, persistent row containing top-level navigation links.
- **Contextual Row:** An ephemeral row of actions specific to the user's current task (e.g., "Send Proposal" in Chat).
- **Registry:** The internal state map in `BottomNavContext` that stores active contextual rows.
- **Gesture Capture Layer:** A transparent overlay in `BottomNav` that intercepts pointer events to ensure reliable swiping without interfering with browser gestures (pull-to-refresh).

## Frozen API Rules

The BottomNav interaction model and API are **FROZEN**. To ensure stability and consistency, strict rules apply:

1.  **Canonical Types Only:** All navigation items must strictly adhere to the types defined in `client/src/_core/bottomNav/types.ts`.
2.  **Registration First:**
    - **Main Row:** Defined statically in `client/src/_core/bottomNav/defaultNav.ts`.
    - **Contextual Rows:** Must be registered via `useRegisterBottomNavRow`.
3.  **No Exceptions:** Do not add "one-off" buttons directly to `BottomNav.tsx`.
4.  **No Logic:** `BottomNav.tsx` must remain logic-free regarding routes.

### How to Add/Remove Buttons

**Main Navigation (Dashboard, etc.)**

- [ ] Open `client/src/_core/bottomNav/defaultNav.ts`.
- [ ] Add or remove items from the `MAIN_NAV_ITEMS` array.
- [ ] Ensure the new item matches the `BottomNavButton` interface.

**Contextual Actions (Page-Specific)**

- [ ] In your page component (e.g., `Chat.tsx`), define your action row.
- [ ] Use `useRegisterBottomNavRow('unique-id', <YourActionRow />)`.
- [ ] Do NOT edit `BottomNav.tsx` to add `if (page === 'chat')`.
