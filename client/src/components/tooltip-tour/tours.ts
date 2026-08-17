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
    // ── Today tab (Steps 0–2) ──────────────────────
    {
      targetId: "payout-widget",
      title: "Your earnings",
      body: "Track revenue at a glance — deposits, pending, and withdrawal balance. Tap to see your full money screen.",
      position: "bottom",
    },
    {
      targetId: "dashboard-tabs",
      title: "Today · Clients · Supplies",
      body: "Swipe or tap to switch between your daily schedule, client list, and supplier catalog.",
      position: "bottom",
    },
    {
      targetId: "demo-task-card",
      title: "Things that need you",
      body: "Task cards flag things that need your attention — follow-ups, deposits due, and more. Tap to expand and see action options.",
      position: "bottom",
      nextDelay: 500, // Wait for Clients tab to mount
    },
    // ── Clients tab (Steps 3–5) ───────────────────────
    {
      targetId: "demo-clients-area",
      title: "Your clients",
      body: "Your complete client list — see their session history, total spend, and status at a glance. Tap any client to view their full profile.",
      position: "bottom",
    },
    {
      targetId: "demo-client-card",
      title: "Client profile",
      body: "Each client card shows their name, session count, lifetime value, and location. Tap to drill into appointments, orders, and notes.",
      position: "bottom",
    },
    {
      targetId: "demo-reminders-area",
      title: "Automated reminders",
      body: "The app sends automatic reminders on your behalf — appointment alerts, aftercare messages, and deposit nudges. You don't need to lift a finger.",
      position: "top",
      nextDelay: 500, // Wait for Supplies tab to mount
    },
    // ── Supplies tab (Steps 6–7) ─────────────────────
    {
      targetId: "demo-suppliers-area",
      title: "Your suppliers",
      body: "Your linked suppliers appear here. Tap any to browse products and reorder supplies without leaving the app.",
      position: "bottom",
    },
    {
      targetId: "demo-supplier-card",
      title: "Find new suppliers",
      body: "Browse curated tattoo supply stores and add them with one tap. Find inks, needles, aftercare, machines, and more.",
      position: "bottom",
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
