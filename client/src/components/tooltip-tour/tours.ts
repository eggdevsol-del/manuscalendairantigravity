/**
 * Tour definitions — Registry of all available tooltip tours
 * ───────────────────────────────────────────────────────────
 * Each tour has:
 * - id: unique key (used for completion tracking)
 * - label: human-readable name (shown in "How to's" settings)
 * - description: short explainer
 * - icon: Lucide icon component name
 * - route: where to navigate before starting the tour
 * - steps: the actual tour step definitions
 *
 * Only tours with fully wired targets are included in ALL_TOURS.
 * Steps reference targetIds registered via useTooltipTarget().
 *
 * Note: onNext callbacks are added dynamically when the tour
 * is started from the page component (since they need access
 * to page state like setEditMode).
 */
import type { TourStep } from "./TooltipTourProvider";

export interface TourConfig {
  id: string;
  label: string;
  description: string;
  icon: string;          // Lucide icon name
  route: string;         // Where to navigate to start this tour
  category: "artist" | "client" | "general";
  steps: TourStep[];
}

// ── Artist tours ──────────────────────────────────────────

export const PROFILE_ONBOARDING_TOUR: TourConfig = {
  id: "profile-onboarding",
  label: "Set up your profile",
  description: "Learn how to edit your profile and import your portfolio from Instagram.",
  icon: "UserCircle",
  route: "/artist-profile",
  category: "artist",
  steps: [
    {
      targetId: "edit-profile-btn",
      title: "Edit your profile",
      body: "Tap here to customise how clients see you — update your name, bio, and contact details.",
      position: "bottom",
      // onNext is injected by ArtistProfileTab (sets editMode = true)
      nextDelay: 350,
    },
    {
      targetId: "import-instagram-btn",
      title: "Import from Instagram",
      body: "Bring your portfolio over from Instagram. Choose how many posts to import — you can always import more later.",
      position: "bottom",
    },
  ],
};

export const DASHBOARD_TOUR: TourConfig = {
  id: "dashboard-overview",
  label: "Your dashboard",
  description: "Learn how to use your home dashboard to manage your business.",
  icon: "LayoutDashboard",
  route: "/dashboard",
  category: "artist",
  steps: [
    // ── Business tab (Steps 0–2) ──────────────────────
    {
      targetId: "payout-widget",
      title: "Your earnings",
      body: "Track revenue at a glance — deposits, pending, and withdrawal balance.",
      position: "bottom",
    },
    {
      targetId: "dashboard-tabs",
      title: "Business tasks",
      body: "Smart task cards flag things that need your attention — follow-ups, deposits due, and more.",
      position: "top",
    },
    {
      targetId: "demo-task-card",
      title: "Example: Follow up",
      body: "Task cards like this appear when a client hasn't responded. Tap to expand and see action options like SMS, Email, or In-App message.",
      position: "bottom",
    },
    // ── Orders tab (Steps 3–4) ────────────────────────
    {
      targetId: "demo-orders-area",
      title: "Your orders",
      body: "When clients purchase through your storefront, orders appear here. Track payment status and manage dispatch.",
      position: "bottom",
    },
    {
      targetId: "demo-order-card",
      title: "Order management",
      body: "Each order shows the client, item, and payment status. Mark as dispatched when you've shipped or handed it to the client.",
      position: "bottom",
    },
    // ── Contacts tab (Steps 5–7) ──────────────────────
    {
      targetId: "demo-contacts-area",
      title: "Your network",
      body: "Manage your suppliers, fellow artists, and client contacts all in one place.",
      position: "bottom",
    },
    {
      targetId: "demo-supplier-card",
      title: "Suppliers",
      body: "Import supplier storefronts to browse and reorder supplies. Add any Shopify store by URL.",
      position: "bottom",
    },
    {
      targetId: "demo-reminders-area",
      title: "Automated reminders",
      body: "The app sends automatic reminders on your behalf — appointment alerts, aftercare messages, and deposit nudges. You don't need to lift a finger.",
      position: "top",
    },
  ],
};

// ── All tours registry ────────────────────────────────────
// Only include tours that have fully wired targets

export const ALL_TOURS: TourConfig[] = [
  PROFILE_ONBOARDING_TOUR,
  DASHBOARD_TOUR,
];

export function getToursForRole(role: "artist" | "client"): TourConfig[] {
  return ALL_TOURS.filter(t => t.category === role || t.category === "general");
}
