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
 * Steps reference targetIds that must be registered via
 * useTooltipTarget() in the corresponding page component.
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
      body: "Bring your portfolio over from Instagram in one tap. We'll grab your latest 20 posts.",
      position: "bottom",
    },
  ],
};

// ── Future tours (loosely planned) ────────────────────────

export const BOOKING_FLOW_TOUR: TourConfig = {
  id: "booking-flow",
  label: "How bookings work",
  description: "Learn how clients discover and book consultations with you.",
  icon: "Calendar",
  route: "/artist-home",
  category: "artist",
  steps: [
    {
      targetId: "business-tab",
      title: "Your business dashboard",
      body: "This is where you'll manage incoming consultation requests and bookings.",
      position: "bottom",
    },
  ],
};

export const CLIENT_DISCOVERY_TOUR: TourConfig = {
  id: "client-discovery",
  label: "Discover artists",
  description: "Learn how to browse artists, like their work, and book a consultation.",
  icon: "Compass",
  route: "/",
  category: "client",
  steps: [
    {
      targetId: "discover-feed",
      title: "Browse artists",
      body: "Swipe through portfolios from local tattoo artists. Tap the tags to filter by style.",
      position: "bottom",
    },
  ],
};

export const SETTINGS_TOUR: TourConfig = {
  id: "settings-overview",
  label: "Navigate settings",
  description: "A quick guide to the most important settings and where to find them.",
  icon: "Settings",
  route: "/settings",
  category: "general",
  steps: [
    {
      targetId: "settings-profile-row",
      title: "Profile settings",
      body: "Manage your display name, bio, and contact visibility here.",
      position: "bottom",
    },
  ],
};

// ── All tours registry ────────────────────────────────────

export const ALL_TOURS: TourConfig[] = [
  PROFILE_ONBOARDING_TOUR,
  BOOKING_FLOW_TOUR,
  CLIENT_DISCOVERY_TOUR,
  SETTINGS_TOUR,
];

export function getToursForRole(role: "artist" | "client"): TourConfig[] {
  return ALL_TOURS.filter(t => t.category === role || t.category === "general");
}
