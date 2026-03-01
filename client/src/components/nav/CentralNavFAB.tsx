import React, { useMemo, useState } from "react";
import { Settings, Plus, Sun, Moon, Link, User, MapPin, ChevronLeft, Bell, FileText, Calendar, Users, Zap, RefreshCw, LogOut } from "lucide-react";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { forceUpdate } from "@/lib/pwa";

type SettingsView = "main" | "settings-menu" | "profile" | "business" | "work-hours" | "notifications" | "regulation";

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
          onClick: () => {
            setFABOpen(false);
            setLocation("/consultations");
          },
        },
        {
          id: "policies",
          label: "Policies",
          icon: Bell, // using Bell as fallback if needed, or another icon
          onClick: () => {
            setFABOpen(false);
            setLocation("/policies");
          },
        }
      );
    }

    if (isArtist) {
      items.push(
        {
          id: "clients",
          label: "Clients",
          icon: User, // using User icon
          onClick: () => {
            setFABOpen(false);
            setLocation("/clients");
          },
        },
        {
          id: "business",
          label: "Business Info",
          icon: MapPin,
          onClick: () => handleViewChange("business"),
          closeOnClick: false,
        }
      );

      if (isStudio) {
        items.push({
          id: "studio",
          label: "Studio Headquarters",
          icon: Users,
          onClick: () => {
            setFABOpen(false);
            setLocation("/studio");
          },
        });
      }

      items.push(
        {
          id: "subscriptions",
          label: "Subscription & Billing",
          icon: Zap,
          onClick: () => {
            setFABOpen(false);
            setLocation("/subscriptions");
          },
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
          onClick: () => {
            setFABOpen(false);
            setLocation("/quick-actions");
          },
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
      toast.error(
        "Booking link not configured. Please set your public slug in settings."
      );
      return;
    }
    const url = `https://calendair.app/start/${artistSettings.publicSlug}`;
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
          "!items-center",
          (fabChildren || (activeSettingsView !== "main" && activeSettingsView !== "settings-menu")) ? "w-[330px] !items-stretch" : "w-[220px]",
          isLargePanel && "max-h-[85vh] h-[85vh] w-[95vw] md:w-[600px] overflow-hidden rounded-t-[32px] md:rounded-[32px] pb-[100px] md:pb-0 relative shadow-2xl bg-background/95 backdrop-blur-3xl border border-white/10"
        )}
      >
        {activeSettingsView === "profile" && (
          <div className="w-full h-full relative isolate p-0 absolute inset-0 overflow-y-auto mobile-scroll">
            <ProfileSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "business" && (
          <div className="w-full h-full relative isolate p-0 absolute inset-0 overflow-y-auto mobile-scroll">
            <BusinessSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "work-hours" && (
          <div className="w-full h-full relative isolate p-0 absolute inset-0 overflow-y-auto mobile-scroll">
            <WorkHoursAndServicesSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "notifications" && (
          <div className="w-full h-full relative isolate p-0 absolute inset-0 overflow-y-auto mobile-scroll">
            <NotificationSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {activeSettingsView === "regulation" && (
          <div className="w-full h-full relative isolate p-0 absolute inset-0 overflow-y-auto mobile-scroll">
            <RegulationSettings onBack={() => handleViewChange("settings-menu")} />
          </div>
        )}
        {fabChildren && activeSettingsView === "main" && fabChildren}
      </FABMenu>
    </div>
  );
}
