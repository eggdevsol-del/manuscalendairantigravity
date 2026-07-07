import React, { useCallback, useMemo, useState } from "react";
import {
  Settings,
  Menu,
  Link,
  User,
  Bell,
  FileText,
  ChevronLeft,
  LogOut,
  Camera,
  Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import { FABMenu, FABMenuItem } from "@/ui/FABMenu";
import { cn } from "@/lib/utils";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// Client-role settings panels (still served from the FAB for clients)
import { ProfileSettings } from "../settings/ProfileSettings";
import { PolicySettings } from "../settings/PolicySettings";
import { FormsCard, PhotosCard, HistoryCard } from "@/features/profile/components/ContentCards";
import { useClientProfileController } from "@/features/profile/useClientProfileController";

/**
 * CentralNavFAB
 *
 * Artist role:
 *   - "Booking Link" button — copies booking URL to clipboard
 *   - "Settings" button    — navigates to /settings (full-page, all sections)
 *   - Page-specific contextual FAB actions from useRegisterFABActions (Calendar, Conversations, etc.)
 *   - fabChildren support (Calendar quick-book panel)
 *
 * Client role:
 *   - "Referral Link" button
 *   - "Settings" button — opens in-FAB settings menu (profile, policies, forms, photos, history)
 *
 * Artist settings have been fully moved to /settings page (Option B consolidation).
 */

// Views used only for the CLIENT in-FAB settings
type ClientView = "main" | "settings-menu" | "profile" | "policies" | "forms" | "photos" | "history";

const isMenuView = (view: ClientView) =>
  view === "main" || view === "settings-menu";

/** Panel wrapper for client FAB content views */
function ClientPanel({ onBack, title, children }: { onBack: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto mobile-scroll p-4">{children}</div>
    </div>
  );
}

interface CentralNavFABProps {
  className?: string;
}

export function CentralNavFAB({ className }: CentralNavFABProps) {
  const [, setLocation] = useLocation();
  const { fabActions, fabChildren, isFABOpen, setFABOpen, isLargePanel, setLargePanel } =
    useBottomNav();

  const { user, logout } = useAuth();

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const isClient = user?.role === "client";

  // ── Client-only in-FAB settings state ───────────────────────────────────
  const [clientView, setClientView] = useState<ClientView>("main");

  // Client profile data for forms/photos/history panels
  const clientProfileController = useClientProfileController();
  const clientProfileData = isClient ? clientProfileController : null;

  // Delayed-mount guard: prevents React Error #185 from Radix Switch components
  // mounting during FABMenu's AnimatePresence animation.
  const [panelReady, setPanelReady] = useState(false);

  React.useEffect(() => {
    if (isFABOpen && !isMenuView(clientView)) {
      const timer = setTimeout(() => setPanelReady(true), 150);
      return () => clearTimeout(timer);
    } else {
      setPanelReady(false);
    }
  }, [isFABOpen, clientView]);

  const handleClientView = useCallback(
    (view: ClientView) => {
      setClientView(view);
      setLargePanel(!isMenuView(view));
    },
    [setLargePanel]
  );

  // Reset view when FAB closes
  React.useEffect(() => {
    if (!isFABOpen && clientView !== "main") {
      setTimeout(() => {
        setClientView("main");
        setLargePanel(false);
      }, 300);
    }
  }, [isFABOpen, clientView, setLargePanel]);

  // ── Booking link copy (artist) / Referral link copy (client) ────────────
  const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    enabled: isArtist,
  });

  const handleCopyLink = useCallback(() => {
    if (isArtist) {
      if (!artistSettings?.publicSlug) {
        toast.info("Booking link not configured yet. Let's set it up!");
        setFABOpen(false);
        setLocation("/settings?section=booking-link");
        return;
      }
      const url = `${window.location.origin}/${artistSettings.publicSlug}`;
      navigator.clipboard.writeText(url);
      toast.success("Booking link copied to clipboard!");
    } else {
      const url = `${window.location.origin}/signup?ref=${user?.id || ""}`;
      navigator.clipboard.writeText(url);
      toast.success("Referral link copied to clipboard!");
    }
  }, [isArtist, artistSettings?.publicSlug, user?.id, setFABOpen, setLocation]);

  // ── Client settings menu items ───────────────────────────────────────────
  const clientSettingsMenu = useMemo(
    (): FABMenuItem[] => [
      {
        id: "back",
        label: "Back",
        icon: ChevronLeft,
        onClick: () => handleClientView("main"),
        closeOnClick: false,
      },
      {
        id: "profile",
        label: "Profile",
        icon: User,
        onClick: () => handleClientView("profile"),
        closeOnClick: false,
      },
      {
        id: "policies",
        label: "Policies",
        icon: Bell,
        onClick: () => handleClientView("policies"),
        closeOnClick: false,
      },
      {
        id: "forms",
        label: "Forms",
        icon: FileText,
        onClick: () => handleClientView("forms"),
        closeOnClick: false,
      },
      {
        id: "photos",
        label: "Photos",
        icon: Camera,
        onClick: () => handleClientView("photos"),
        closeOnClick: false,
      },
      {
        id: "history",
        label: "History",
        icon: Clock,
        onClick: () => handleClientView("history"),
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
    ],
    [handleClientView, logout, setLocation]
  );

  // ── Resolve current FAB menu items ───────────────────────────────────────
  // For artists: always undefined at settings-menu level — settings are on /settings page
  // For clients: show settings-menu when navigated into it
  const currentMenuItems = useMemo((): FABMenuItem[] | undefined => {
    if (!isClient) return undefined;
    if (clientView === "settings-menu") return clientSettingsMenu;
    return undefined; // leaf views render as children
  }, [isClient, clientView, clientSettingsMenu]);

  // ── Permanent FAB items ──────────────────────────────────────────────────
  const permanentItems = useMemo((): FABMenuItem[] => {
    const settingsItem: FABMenuItem = isArtist
      ? {
          id: "settings",
          label: "Settings",
          icon: Settings,
          onClick: () => {
            setFABOpen(false);
            setLocation("/settings");
          },
          closeOnClick: true,
        }
      : {
          id: "settings",
          label: "Settings",
          icon: Settings,
          onClick: () => handleClientView("settings-menu"),
          closeOnClick: false,
        };

    return [
      {
        id: "copy-link",
        label: isArtist ? "Booking Link" : "Referral Link",
        icon: Link,
        onClick: handleCopyLink,
      },
      settingsItem,
    ];
  }, [isArtist, handleCopyLink, handleClientView, setFABOpen, setLocation]);

  // Merge page-registered contextual actions with permanent items
  const allItems = useMemo(
    () => [...fabActions, ...permanentItems],
    [fabActions, permanentItems]
  );

  // ── Determine what the FAB shows ─────────────────────────────────────────
  // Main view (no sub-menu open): show allItems
  // Client settings-menu: show clientSettingsMenu
  // Client leaf panel: show children (panel components below)
  // fabChildren: show page-injected ReactNode content
  const showAllItems = !fabChildren && (isArtist || clientView === "main");

  return (
    <div
      className={cn(
        "relative flex items-center justify-center w-16 h-full transition-none",
        className
      )}
    >
      <FABMenu
        toggleIcon={<Menu className="w-6 h-6" />}
        items={showAllItems ? allItems : currentMenuItems}
        isOpen={isFABOpen}
        onOpenChange={setFABOpen}
        className="!static !bottom-auto !right-auto transition-none"
        portalContainerClassName="bottom-[90px] left-1/2 -translate-x-1/2 items-center"
        panelClassName={cn(
          "!items-center max-h-[calc(100dvh-130px)] overflow-y-auto mb-[20px] w-[350px]",
          !isLargePanel ? "h-auto" : "",
          fabChildren || !isMenuView(clientView) ? "!items-stretch" : "",
          isLargePanel &&
            "max-h-[calc(100dvh-130px)] h-[calc(100dvh-130px)] w-[calc(100vw-40px)] md:w-[600px] overflow-hidden rounded-[32px] relative shadow-2xl bg-background/35 backdrop-blur-3xl border border-border"
        )}
      >
        {/* ── Client settings panels ──────────────────────────────────── */}
        {isClient && clientView === "profile" && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <ProfileSettings onBack={() => handleClientView("settings-menu")} />
          </div>
        )}

        {isClient && clientView === "policies" && panelReady && (
          <div className="w-full h-[85vh] max-h-[calc(100dvh-130px)] relative flex flex-col overflow-hidden">
            <PolicySettings onBack={() => handleClientView("settings-menu")} />
          </div>
        )}

        {isClient && clientView === "forms" && panelReady && (
          <ClientPanel onBack={() => handleClientView("settings-menu")} title="Forms">
            <FormsCard forms={clientProfileData?.forms || []} />
          </ClientPanel>
        )}

        {isClient && clientView === "photos" && panelReady && (
          <ClientPanel onBack={() => handleClientView("settings-menu")} title="Photos">
            <PhotosCard photos={clientProfileData?.photos || []} isEditMode={false} />
          </ClientPanel>
        )}

        {isClient && clientView === "history" && panelReady && (
          <ClientPanel onBack={() => handleClientView("settings-menu")} title="History">
            <HistoryCard history={clientProfileData?.history || []} />
          </ClientPanel>
        )}

        {/* Page-injected content (e.g. Calendar quick-book panel) */}
        {fabChildren && clientView === "main" && fabChildren}
      </FABMenu>
    </div>
  );
}
