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
    {
      targetId: "setup-checklist-widget",
      title: "Your setup checklist",
      body: "Complete these steps to go live — connect payments, set your hours, and add services.",
      position: "bottom",
    },
    {
      targetId: "payout-widget",
      title: "Your earnings",
      body: "Track your revenue at a glance. This updates as clients pay for consultations and bookings.",
      position: "bottom",
    },
    {
      targetId: "dashboard-tabs",
      title: "Your business tabs",
      body: "Swipe between Business tasks, Orders, and Contacts. We'll flag things that need your attention.",
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
