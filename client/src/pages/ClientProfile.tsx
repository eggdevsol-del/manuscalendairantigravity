/**
 * ClientProfile.tsx
 * ─────────────────────────────────────────────────────────
 * Client home page — feed layout (no tabs).
 *
 * Layout:
 *   FloatingProfileIcon (top-right)
 *   MyArtistsSection (conditional: conversations + favourites)
 *   UpcomingWidget (next 1-2 appointments)
 *   DiscoverArtists (ClientFeedTab discover section)
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useClientProfileController } from "@/features/profile/useClientProfileController";

import { FloatingProfileIcon } from "@/features/client-profile/FloatingProfileIcon";
import { MyArtistsSection } from "@/features/client-profile/MyArtistsSection";
import { UpcomingWidget } from "@/features/client-profile/UpcomingWidget";
import { ClientFeedTab } from "@/features/client-profile/ClientFeedTab";
import { useFavourites } from "@/features/client-profile/useFavourites";

import { useTeaser } from "@/contexts/TeaserContext";
import { Lock, Compass } from "lucide-react";
import { InstallAppModal } from "@/components/modals/InstallAppModal";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/ui/ssot";

export default function ClientProfile() {
  const { isTeaserClient } = useTeaser();
  const [, setLocation] = useLocation();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isShopExpanded, setIsShopExpanded] = useState(false);

  const { upcoming } = useClientProfileController();

  const { favouriteIds, isFavourited, toggleFavourite } = useFavourites();

  // Fetch conversations to get connected artists
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    staleTime: 30000,
  });

  return (
    <PageShell className="bg-transparent">
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* Teaser Mode Overlay */}
      {isTeaserClient && (
        <div
          className="absolute inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-all hover:bg-background/70"
          onClick={() => setShowInstallModal(true)}
        >
          <div className="flex flex-col items-center gap-3 p-8 rounded-[2rem] bg-card/90 border border-border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Profile Locked</h3>
            <button className="text-sm font-medium text-primary hover:underline">
              Install app to manage profile
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col h-full w-full",
          isTeaserClient && "filter blur-sm pointer-events-none select-none"
        )}
      >
        {/* Floating profile icon — top right */}
        <FloatingProfileIcon />

        {/* Scrollable feed content */}
        <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-14 pb-[120px] space-y-6">
          {/* My Artists — conversations first, then favourites-only */}
          <MyArtistsSection
            conversations={conversations || []}
            favouriteIds={favouriteIds}
            isFavourited={isFavourited}
            toggleFavourite={toggleFavourite}
            onShopToggle={setIsShopExpanded}
          />

          {/* Upcoming appointments widget */}
          <UpcomingWidget upcoming={upcoming || []} />

          {/* Discovery button — opens the full-screen portrait feed */}
          <button
            onClick={() => setLocation("/discover")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "16px",
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(59, 130, 246, 0.12))",
              border: "1px solid rgba(168, 85, 247, 0.2)",
              borderRadius: "16px",
              color: "var(--foreground, #fff)",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              textAlign: "left",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25))",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Compass size={22} style={{ color: "rgb(168, 85, 247)" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px" }}>Discovery</div>
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>Browse artist portfolios</div>
            </div>
          </button>

          {/* Discover Artists feed */}
          <ClientFeedTab
            conversations={conversations || []}
            setIsShopExpanded={setIsShopExpanded}
          />
        </div>
      </div>
    </PageShell>
  );
}
