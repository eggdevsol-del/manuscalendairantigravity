import React, { useMemo, useState } from "react";
import { Settings, Plus, Sun, Moon, Link, User, MapPin, ChevronLeft, Bell, FileText, Calendar, Users, Zap, RefreshCw, LogOut, Database, AlertTriangle, Plane } from "lucide-react";
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
import { SubscriptionSettings } from "../settings/SubscriptionSettings";
import { QuickActionsSettings } from "../settings/QuickActionsSettings";
import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { forceUpdate } from "@/lib/pwa";

import { DataImportSettings } from "../settings/DataImportSettings";
import { FunnelSettings } from "../FunnelSettings";
import { DangerZoneSettings } from "../settings/DangerZoneSettings";
import { TravelSettings } from "../settings/TravelSettings";

type SettingsView = "main" | "settings-menu" | "profile" | "business" | "work-hours" | "notifications" | "regulation" | "consultations" | "policies" | "clients" | "studio" | "subscriptions" | "quick-actions" | "data-import" | "booking-link" | "travel" | "danger-zone";

interface CentralNavFABProps {
  className?: string;
}

/**
 * CentralNavFAB - Anchored in the center of the BottomNav.
 * Houses global actions like Settings and potential page-specific quick actions.
 */
export function CentralNavFAB({ className }: CentralNavFABProps) {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { fabActions, fabChildren, isFABOpen, setFABOpen, isLargePanel, setLargePanel } =
    useBottomNav();

  const { user, logout } = useAuth();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsView>("main");

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const isStudio = user?.role === "studio" || user?.role === "admin";

  const handleViewChange = (view: SettingsView) => {
    setActiveSettingsView(view);
    setLargePanel(view !== "main" && view !== "settings-menu");
  };

  // Dynamically build settingsMenuItems based on user role
  const settingsMenuItems = useMemo(() => {
    const items: FABMenuItem[] = [
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
      }
    ];

    if (!isArtist) {
      items.push(
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
          icon: Bell, // using Bell as fallback if needed, or another icon
          onClick: () => handleViewChange("policies"),
          closeOnClick: false,
        }
      );
    }

    if (isArtist) {
      items.push(
        {
          id: "clients",
          label: "Clients",
          icon: User, // using User icon
          onClick: () => handleViewChange("clients"),
          closeOnClick: false,
        },
        {
          id: "travel",
          label: "Travel Dates",
          icon: Plane,
          onClick: () => handleViewChange("travel"),
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
          id: "business",
          label: "Business Info",
          icon: MapPin,
          onClick: () => handleViewChange("business"),
          closeOnClick: false,
        },
        {
          id: "data-import",
          label: "Import Clients (CSV)",
          icon: Database,
          onClick: () => handleViewChange("data-import"),
          closeOnClick: false,
        }
      );

      if (isStudio) {
        items.push({
          id: "studio",
          label: "Studio Headquarters",
          icon: Users,
          onClick: () => handleViewChange("studio"),
          closeOnClick: false,
        });
      }

      items.push(
        {
          id: "danger-zone",
          label: "Danger Zone",
          icon: AlertTriangle,
          onClick: () => handleViewChange("danger-zone"),
          closeOnClick: false,
          className: "text-red-500 hover:text-red-400 hover:bg-red-500/10",
        },
        {
          id: "subscriptions",
          label: "Subscription & Billing",
          icon: Zap,
          onClick: () => handleViewChange("subscriptions"),
          closeOnClick: false,
        },
        {
          id: "work-hours",
          label: "Work Hours & Services",
          icon: Settings, // or Clock if imported
          onClick: () => handleViewChange("work-hours"),
          closeOnClick: false,
        },
        {
          id: "regulation",
          label: "Regulation & Forms",
          icon: FileText, // assuming FileText is imported
          onClick: () => handleViewChange("regulation"),
          closeOnClick: false,
        },
        {
          id: "quick-actions",
          label: "Quick Actions",
          icon: Zap,
          onClick: () => handleViewChange("quick-actions"),
          closeOnClick: false,
        },
        {
          id: "notifications",
          label: "Notifications",
          icon: Bell, // assuming Bell is imported
          onClick: () => handleViewChange("notifications"),
          closeOnClick: false,
        }
      );
    }

    // System Settings for all users
    items.push(
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
      }
    );

    return items;
  }, [isArtist, isStudio, handleViewChange, setLocation, setFABOpen, showDebugLabels, setShowDebugLabels, logout]);

  // Fetch artist settings for the booking link slug
  const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleCopyLink = () => {
    if (!artistSettings?.publicSlug) {
      toast.info("Booking link not configured yet. Let's set it up!");
      handleViewChange("booking-link");
      return;
    }
    const url = `${window.location.origin}/start/${artistSettings.publicSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("Booking link copied to clipboard!");
  };

  const permanentItems: FABMenuItem[] = [
    {
      id: "theme",
      label: theme === "dark" ? "Light Mode" : "Dark Mode",
      icon: theme === "dark" ? Sun : Moon,
      onClick: () => toggleTheme?.(),
      closeOnClick: false, // Keep menu open to show change
    },
    {
      id: "copy-link",
      label: "Booking Link",
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
  ];



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

  return (
    <div
      className={cn(
        "relative flex items-center justify-center w-16 h-full transition-none",
        className
      )}
    >
      <FABMenu
        toggleIcon={<Plus className="w-6 h-6" />}
        items={
          !fabChildren && activeSettingsView === "main"
            ? allItems
            : activeSettingsView === "settings-menu"
              ? settingsMenuItems
              : undefined
        }
        isOpen={isFABOpen}
        onOpenChange={setFABOpen}
        className="!static !bottom-auto !right-auto transition-none"
        portalContainerClassName="bottom-[90px] left-1/2 -translate-x-1/2 items-center"
        panelClassName={cn(
          "!items-center max-h-[calc(100dvh-130px)] overflow-y-auto mb-[20px]",
          (fabChildren || (activeSettingsView !== "main" && activeSettingsView !== "settings-menu"))
            ? "w-[calc(100vw-40px)] max-w-[360px] !items-stretch"
            : "w-[260px] max-w-[calc(100vw-40px)]",
          isLargePanel && "max-h-[calc(100dvh-130px)] h-[calc(100dvh-130px)] w-[calc(100vw-40px)] md:w-[600px] overflow-hidden rounded-[32px] relative shadow-2xl bg-background/35 backdrop-blur-3xl border border-white/10"
        )}
      >
        {activeSettingsView === "profile" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ProfileSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "consultations" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ConsultationSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "policies" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <PolicySettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "clients" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ClientSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "travel" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <TravelSettings onBack={() => handleViewChange("settings-menu")} onNavigateToClients={() => handleViewChange("clients")} />
          </div>
        )}
        {activeSettingsView === "studio" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <StudioDashboardSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "subscriptions" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <SubscriptionSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "quick-actions" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <QuickActionsSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "business" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <BusinessSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "work-hours" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <WorkHoursAndServicesSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "notifications" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <NotificationSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "data-import" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <DataImportSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "booking-link" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <FunnelSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "regulation" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <RegulationSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "danger-zone" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <DangerZoneSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {fabChildren && activeSettingsView === "main" && fabChildren}
      </FABMenu>
    </div>
  );
}
