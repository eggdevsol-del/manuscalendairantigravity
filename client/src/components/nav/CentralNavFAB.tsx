import React, { useCallback, useMemo, useState } from "react";
import { Settings, Menu, Sun, Moon, Crown, Link, User, MapPin, ChevronLeft, Bell, FileText, Calendar, Users, Zap, RefreshCw, LogOut, Database, AlertTriangle, Plane, Banknote, Store, Images } from "lucide-react";
import { useLocation } from "wouter";
import { FABMenu, FABMenuItem } from "@/ui/FABMenu";
import { cn } from "@/lib/utils";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ProfileSettings } from "../settings/ProfileSettings";
import { BusinessSettings } from "../settings/BusinessSettings";
import { WorkHoursAndServicesSettings } from "../settings/WorkHoursAndServicesSettings";
import { NotificationSettings } from "../settings/NotificationSettings";
import { RegulationSettings } from "../settings/RegulationSettings";
import { ConsultationSettings } from "../settings/ConsultationSettings";
import { PolicySettings } from "../settings/PolicySettings";
import { ClientSettings } from "../settings/ClientSettings";
import { StudioDashboardSettings } from "../settings/StudioDashboardSettings";
import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { forceUpdate } from "@/lib/pwa";

import { DataImportSettings } from "../settings/DataImportSettings";
import { FunnelSettings } from "../FunnelSettings";
import { DangerZoneSettings } from "../settings/DangerZoneSettings";
import { TravelSettings } from "../settings/TravelSettings";
import { PortfolioSettings } from "../settings/PortfolioSettings";
import StorefrontSetupWizard from "@/features/storefront/StorefrontSetupWizard";
// PaymentSettings moved to dedicated /bank-payouts page
// SubscriptionSettings & QuickActionsSettings removed from FAB — accessible via their routes

type SettingsView =
  | "main"
  | "settings-menu"
  // Category intermediate views (item lists, not large panels)
  | "category-profile"
  | "category-business"
  | "category-booking"
  | "category-system"
  // Leaf settings panels (large panels)
  | "profile"
  | "business"
  | "work-hours"
  | "notifications"
  | "regulation"
  | "consultations"
  | "policies"
  | "clients"
  | "studio"
  | "data-import"
  | "booking-link"
  | "travel"
  | "danger-zone"
  | "payments"
  | "storefront"
  | "portfolio";

/** Map each leaf settings view to its parent category for back-navigation */
const leafToCategory: Partial<Record<SettingsView, SettingsView>> = {
  profile: "category-profile",
  portfolio: "category-profile",
  storefront: "category-profile",
  business: "category-business",
  clients: "category-business",
  "data-import": "category-business",
  regulation: "category-business",
  studio: "category-business",
  "booking-link": "category-booking",
  "work-hours": "category-booking",
  travel: "category-booking",
  notifications: "category-system",
  "danger-zone": "category-system",
};

interface CentralNavFABProps {
  className?: string;
}

/**
 * CentralNavFAB - Anchored in the center of the BottomNav.
 * Houses global actions like Settings and potential page-specific quick actions.
 *
 * Artist settings are organized into 4 grouped categories + Bank Payouts:
 *  1. My Profile & Identity  (Profile, Portfolio, Storefront)
 *  2. My Business            (Business Info, Clients, CSV Import, Regulation, Studio HQ)
 *  3. Booking & Availability (Booking Link, Work Hours, Travel Dates)
 *  4. Bank Payouts           (standalone — routes to /bank-payouts)
 *  5. System & Preferences   (Notifications, UI Debug, Updates, Log Out, Danger Zone)
 */
export function CentralNavFAB({ className }: CentralNavFABProps) {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { fabActions, fabChildren, isFABOpen, setFABOpen, isLargePanel, setLargePanel,
    requestedSettingsView, requestSettingsView } =
    useBottomNav();

  const { user, logout } = useAuth();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsView>("main");

  // Views that are "menu-level" — not full panels
  const isMenuView = (view: SettingsView) =>
    view === "main" || view === "settings-menu" || view.startsWith("category-");

  // Delayed-mount guard: prevents settings panels with Radix Switch components
  // from mounting during the FABMenu's AnimatePresence animation, which causes
  // React Error #185 (Maximum update depth exceeded) due to Switch's
  // useControllableState calling setState during render.
  const [panelReady, setPanelReady] = useState(false);

  React.useEffect(() => {
    if (isFABOpen && !isMenuView(activeSettingsView)) {
      const timer = setTimeout(() => setPanelReady(true), 150);
      return () => clearTimeout(timer);
    } else {
      setPanelReady(false);
    }
  }, [isFABOpen, activeSettingsView]);

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const isStudio = user?.role === "studio" || user?.role === "admin";

  const handleViewChange = useCallback((view: SettingsView) => {
    setActiveSettingsView(view);
    // Only activate large panel for leaf settings views, not menus or categories
    setLargePanel(!isMenuView(view));
  }, [setLargePanel]);

  /** Get the parent view for back-navigation from a leaf panel */
  const getBackTarget = useCallback((view: SettingsView): SettingsView => {
    // For artist role, route back to the parent category
    if (isArtist && leafToCategory[view]) {
      return leafToCategory[view]!;
    }
    // For client role (flat settings), route back to settings-menu
    return "settings-menu";
  }, [isArtist]);

  // ── Artist Category Menus ────────────────────────────────────────────
  // Top-level settings menu for artists: 4 categories + Bank Payouts
  const artistSettingsMenu = useMemo((): FABMenuItem[] => [
    {
      id: "back",
      label: "Back",
      icon: ChevronLeft,
      onClick: () => handleViewChange("main"),
      closeOnClick: false,
    },
    {
      id: "category-profile",
      label: "My Profile & Identity",
      icon: User,
      onClick: () => handleViewChange("category-profile"),
      closeOnClick: false,
    },
    {
      id: "category-business",
      label: "My Business",
      icon: MapPin,
      onClick: () => handleViewChange("category-business"),
      closeOnClick: false,
    },
    {
      id: "category-booking",
      label: "Booking & Availability",
      icon: Calendar,
      onClick: () => handleViewChange("category-booking"),
      closeOnClick: false,
    },
    {
      id: "payments",
      label: "Bank Payouts",
      icon: Banknote,
      onClick: () => {
        setFABOpen(false);
        setLocation("/bank-payouts");
      },
      closeOnClick: true,
    },
    {
      id: "category-system",
      label: "System & Preferences",
      icon: Settings,
      onClick: () => handleViewChange("category-system"),
      closeOnClick: false,
    },
  ], [handleViewChange, setFABOpen, setLocation]);

  // Sub-menu: My Profile & Identity
  const categoryProfileItems = useMemo((): FABMenuItem[] => [
    {
      id: "back",
      label: "Back",
      icon: ChevronLeft,
      onClick: () => handleViewChange("settings-menu"),
      closeOnClick: false,
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      onClick: () => handleViewChange("profile"),
      closeOnClick: false,
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: Images,
      onClick: () => handleViewChange("portfolio"),
      closeOnClick: false,
    },
    {
      id: "storefront",
      label: "Storefront",
      icon: Store,
      onClick: () => handleViewChange("storefront"),
      closeOnClick: false,
    },
  ], [handleViewChange]);

  // Sub-menu: My Business
  const categoryBusinessItems = useMemo((): FABMenuItem[] => {
    const items: FABMenuItem[] = [
      {
        id: "back",
        label: "Back",
        icon: ChevronLeft,
        onClick: () => handleViewChange("settings-menu"),
        closeOnClick: false,
      },
      {
        id: "business",
        label: "Business Info",
        icon: MapPin,
        onClick: () => handleViewChange("business"),
        closeOnClick: false,
      },
      {
        id: "clients",
        label: "Clients",
        icon: Users,
        onClick: () => handleViewChange("clients"),
        closeOnClick: false,
      },
      {
        id: "data-import",
        label: "Import Clients (CSV)",
        icon: Database,
        onClick: () => handleViewChange("data-import"),
        closeOnClick: false,
      },
      {
        id: "regulation",
        label: "Regulation & Forms",
        icon: FileText,
        onClick: () => handleViewChange("regulation"),
        closeOnClick: false,
      },
    ];

    if (isStudio) {
      items.push({
        id: "studio",
        label: "Studio Headquarters",
        icon: Users,
        onClick: () => handleViewChange("studio"),
        closeOnClick: false,
      });
    }

    return items;
  }, [handleViewChange, isStudio]);

  // Sub-menu: Booking & Availability
  const categoryBookingItems = useMemo((): FABMenuItem[] => [
    {
      id: "back",
      label: "Back",
      icon: ChevronLeft,
      onClick: () => handleViewChange("settings-menu"),
      closeOnClick: false,
    },
    {
      id: "booking-link",
      label: "Booking Link",
      icon: Link,
      onClick: () => handleViewChange("booking-link"),
      closeOnClick: false,
    },
    {
      id: "work-hours",
      label: "Work Hours & Services",
      icon: Settings,
      onClick: () => handleViewChange("work-hours"),
      closeOnClick: false,
    },
    {
      id: "travel",
      label: "Travel Dates",
      icon: Plane,
      onClick: () => handleViewChange("travel"),
      closeOnClick: false,
    },
  ], [handleViewChange]);

  // Sub-menu: System & Preferences
  const categorySystemItems = useMemo((): FABMenuItem[] => [
    {
      id: "back",
      label: "Back",
      icon: ChevronLeft,
      onClick: () => handleViewChange("settings-menu"),
      closeOnClick: false,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      onClick: () => handleViewChange("notifications"),
      closeOnClick: false,
    },
    {
      id: "ui-debug",
      label: showDebugLabels ? "Hide UI Debug" : "Show UI Debug",
      icon: Zap,
      onClick: () => setShowDebugLabels(!showDebugLabels),
      closeOnClick: false,
    },
    {
      id: "check-updates",
      label: "Check for Updates",
      icon: RefreshCw,
      onClick: () => {
        toast.info("Checking for updates...");
        forceUpdate();
      },
      closeOnClick: false,
    },
    {
      id: "logout",
      label: "Log Out",
      icon: LogOut,
      onClick: async () => {
        await logout();
        setLocation("/");
      },
    },
    // Danger Zone — visually separated at bottom with red styling
    {
      id: "danger-zone",
      label: "Danger Zone",
      icon: AlertTriangle,
      onClick: () => handleViewChange("danger-zone"),
      closeOnClick: false,
      className: "text-red-500 hover:text-red-400 hover:bg-red-500/10 mt-4 pt-4 border-t border-red-500/20",
    },
  ], [handleViewChange, showDebugLabels, setShowDebugLabels, logout, setLocation]);

  // ── Client Flat Settings Menu ────────────────────────────────────────
  // Client role: flat list (no categories needed)
  const clientSettingsMenu = useMemo((): FABMenuItem[] => [
    {
      id: "back",
      label: "Back",
      icon: ChevronLeft,
      onClick: () => handleViewChange("main"),
      closeOnClick: false,
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      onClick: () => handleViewChange("profile"),
      closeOnClick: false,
    },
    {
      id: "consultations",
      label: "Consultations",
      icon: Calendar,
      onClick: () => handleViewChange("consultations"),
      closeOnClick: false,
    },
    {
      id: "policies",
      label: "Policies",
      icon: Bell,
      onClick: () => handleViewChange("policies"),
      closeOnClick: false,
    },
    {
      id: "logout",
      label: "Log Out",
      icon: LogOut,
      onClick: async () => {
        await logout();
        setLocation("/");
      },
    },
  ], [handleViewChange, logout, setLocation]);

  // ── Resolve active menu items ────────────────────────────────────────
  /** Returns the FABMenuItem[] to display for the current activeSettingsView */
  const currentMenuItems = useMemo((): FABMenuItem[] | undefined => {
    switch (activeSettingsView) {
      case "settings-menu":
        return isArtist ? artistSettingsMenu : clientSettingsMenu;
      case "category-profile":
        return categoryProfileItems;
      case "category-business":
        return categoryBusinessItems;
      case "category-booking":
        return categoryBookingItems;
      case "category-system":
        return categorySystemItems;
      default:
        return undefined; // leaf views use children, not items
    }
  }, [
    activeSettingsView, isArtist,
    artistSettingsMenu, clientSettingsMenu,
    categoryProfileItems, categoryBusinessItems,
    categoryBookingItems, categorySystemItems,
  ]);

  // Fetch artist settings for the booking link slug
  const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleCopyLink = useCallback(() => {
    if (isArtist) {
      // Artist: copy booking link
      if (!artistSettings?.publicSlug) {
        toast.info("Booking link not configured yet. Let's set it up!");
        handleViewChange("booking-link");
        return;
      }
      const url = `${window.location.origin}/${artistSettings.publicSlug}`;
      navigator.clipboard.writeText(url);
      toast.success("Booking link copied to clipboard!");
    } else {
      // Client: copy referral signup link
      const url = `${window.location.origin}/signup?ref=${user?.id || ""}`;
      navigator.clipboard.writeText(url);
      toast.success("Referral link copied to clipboard!");
    }
  }, [isArtist, artistSettings?.publicSlug, user?.id, handleViewChange]);

  const permanentItems: FABMenuItem[] = useMemo(() => [
    {
      id: "theme",
      label: theme === "dark" ? "Light Mode" : theme === "light" ? "Noir" : "Dark Mode",
      icon: theme === "dark" ? Sun : theme === "light" ? Crown : Moon,
      onClick: () => toggleTheme?.(),
      closeOnClick: false, // Keep menu open to show change
    },
    {
      id: "copy-link",
      label: isArtist ? "Booking Link" : "Referral Link",
      icon: Link,
      onClick: handleCopyLink,
    },
    {
      id: "settings-menu",
      label: "Settings",
      icon: Settings,
      onClick: () => handleViewChange("settings-menu"),
      closeOnClick: false,
    }
  ], [theme, toggleTheme, isArtist, handleCopyLink, handleViewChange]);



  // Combine permanent items with dynamic actions from context
  const allItems = useMemo(() => {
    return [...fabActions, ...permanentItems];
  }, [fabActions, permanentItems]);

  // Handle resetting the view when the FAB closes
  React.useEffect(() => {
    if (!isFABOpen && activeSettingsView !== "main") {
      setTimeout(() => {
        setActiveSettingsView("main");
        setLargePanel(false);
      }, 300); // Wait for close animation
    }
  }, [isFABOpen, activeSettingsView, setLargePanel]);

  // Deep-link: when a settings view is requested externally, navigate to it.
  // Delay to ensure FAB panel has rendered before navigating. Do not remove.
  React.useEffect(() => {
    if (requestedSettingsView && isFABOpen) {
      const timer = setTimeout(() => {
        handleViewChange(requestedSettingsView as SettingsView);
        requestSettingsView(null); // Clear the request
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [requestedSettingsView, isFABOpen, handleViewChange, requestSettingsView]);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center w-16 h-full transition-none",
        className
      )}
    >
      <FABMenu
        toggleIcon={<Menu className="w-6 h-6" />}
        items={
          !fabChildren && activeSettingsView === "main"
            ? allItems
            : currentMenuItems
        }
        isOpen={isFABOpen}
        onOpenChange={setFABOpen}
        className="!static !bottom-auto !right-auto transition-none"
        portalContainerClassName="bottom-[90px] left-1/2 -translate-x-1/2 items-center"
        panelClassName={cn(
          "!items-center max-h-[calc(100dvh-130px)] overflow-y-auto mb-[20px] w-[350px]",
          // Auto-size for main menu, settings menu, and category menus; fixed height only for large panel sub-views
          (!isLargePanel) ? "h-auto" : "",
          (fabChildren || !isMenuView(activeSettingsView))
            ? "!items-stretch"
            : "",
          isLargePanel && "max-h-[calc(100dvh-130px)] h-[calc(100dvh-130px)] w-[calc(100vw-40px)] md:w-[600px] overflow-hidden rounded-[32px] relative shadow-2xl bg-background/35 backdrop-blur-3xl border border-border"
        )}
      >
        {/* Settings panels: panelReady gate prevents mounting during FABMenu animation
           to avoid React #185 from Radix Switch's useControllableState */}
        {activeSettingsView === "profile" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ProfileSettings onBack={() => handleViewChange(getBackTarget("profile"))} />
          </div>
        )}
        {activeSettingsView === "consultations" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ConsultationSettings onBack={() => handleViewChange(getBackTarget("consultations"))} />
          </div>
        )}
        {activeSettingsView === "policies" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <PolicySettings onBack={() => handleViewChange(getBackTarget("policies"))} />
          </div>
        )}
        {activeSettingsView === "clients" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ClientSettings onBack={() => handleViewChange(getBackTarget("clients"))} />
          </div>
        )}
        {activeSettingsView === "travel" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <TravelSettings onBack={() => handleViewChange(getBackTarget("travel"))} onNavigateToClients={() => handleViewChange("clients")} />
          </div>
        )}
        {activeSettingsView === "studio" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <StudioDashboardSettings onBack={() => handleViewChange(getBackTarget("studio"))} />
          </div>
        )}
        {activeSettingsView === "business" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <BusinessSettings onBack={() => handleViewChange(getBackTarget("business"))} />
          </div>
        )}
        {activeSettingsView === "work-hours" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <WorkHoursAndServicesSettings onBack={() => handleViewChange(getBackTarget("work-hours"))} />
          </div>
        )}
        {activeSettingsView === "notifications" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <NotificationSettings onBack={() => handleViewChange(getBackTarget("notifications"))} />
          </div>
        )}
        {activeSettingsView === "data-import" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <DataImportSettings onBack={() => handleViewChange(getBackTarget("data-import"))} />
          </div>
        )}
        {activeSettingsView === "booking-link" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <FunnelSettings onBack={() => handleViewChange(getBackTarget("booking-link"))} />
          </div>
        )}
        {activeSettingsView === "regulation" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <RegulationSettings onBack={() => handleViewChange(getBackTarget("regulation"))} />
          </div>
        )}
        {activeSettingsView === "danger-zone" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <DangerZoneSettings onBack={() => handleViewChange(getBackTarget("danger-zone"))} />
          </div>
        )}
        {activeSettingsView === "storefront" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <StorefrontSetupWizard onClose={() => handleViewChange(getBackTarget("storefront"))} />
          </div>
        )}
        {activeSettingsView === "portfolio" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <PortfolioSettings onBack={() => handleViewChange(getBackTarget("portfolio"))} />
          </div>
        )}
        {/* Bank Payouts moved to dedicated /bank-payouts page */}
        {fabChildren && activeSettingsView === "main" && fabChildren}
      </FABMenu>
    </div>
  );
}
