/**
 * ClientHome — Unified client home page
 * ─────────────────────────────────────────────────────────
 * Two views toggled from the header:
 * - Discovery: Instagram-style portrait card feed
 * - Home: My Artists, Upcoming, Discover Artists cards
 *
 * Header auto-hides on scroll down, reappears on scroll up.
 */
import "./clientHome.css";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Compass, Home } from "lucide-react";

// Discovery feed (reused)
import DiscoverFeedContent from "./DiscoverFeedContent";

// Home view components (reused from client-profile)
import { MyArtistsSection } from "@/features/client-profile/MyArtistsSection";
import { UpcomingWidget } from "@/features/client-profile/UpcomingWidget";
import { ClientFeedTab } from "@/features/client-profile/ClientFeedTab";
import { useClientProfileController } from "@/features/profile/useClientProfileController";
import { useFavourites } from "@/features/client-profile/useFavourites";
import { trpc } from "@/lib/trpc";

type ViewMode = "discovery" | "home";

export default function ClientHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ViewMode>("discovery");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);

  // Home view data
  const { upcoming } = useClientProfileController();
  const { favouriteIds, isFavourited, toggleFavourite } = useFavourites();
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    staleTime: 30000,
  });
  const [isShopExpanded, setIsShopExpanded] = useState(false);

  // Auto-hide header on scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const currentY = el.scrollTop;
    const delta = currentY - lastScrollY.current;

    // Only trigger after meaningful scroll
    if (Math.abs(delta) > 8) {
      if (delta > 0 && currentY > 60) {
        // Scrolling down — hide
        setHeaderHidden(true);
      } else {
        // Scrolling up — show
        setHeaderHidden(false);
      }
    }

    lastScrollY.current = currentY;
  }, []);

  // Reset header when switching views
  useEffect(() => {
    setHeaderHidden(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [view]);

  const avatarUrl = user?.avatar;
  const initials = (user?.name || "?").charAt(0).toUpperCase();

  return (
    <>
      {/* ── Auto-hide Header ── */}
      <header className={`client-home-header ${headerHidden ? "header-hidden" : ""}`}>
        {/* Profile avatar */}
        <div
          className="client-home-avatar"
          onClick={() => setLocation("/settings")}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" />
          ) : (
            <div className="client-home-avatar-fallback">{initials}</div>
          )}
        </div>

        {/* Logo */}
        <span className="client-home-logo">FETCH</span>

        {/* View toggle */}
        <div className="client-home-toggle">
          <button
            className={`client-home-toggle-btn ${view === "discovery" ? "active" : ""}`}
            onClick={() => setView("discovery")}
            title="Discovery"
          >
            <Compass size={18} />
          </button>
          <button
            className={`client-home-toggle-btn ${view === "home" ? "active" : ""}`}
            onClick={() => setView("home")}
            title="Home"
          >
            <Home size={18} />
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <div
        className="client-home-content"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className="client-home-content-inner">
          {view === "discovery" ? (
            <DiscoverFeedContent />
          ) : (
            <div className="client-home-view">
              <MyArtistsSection
                conversations={conversations || []}
                favouriteIds={favouriteIds}
                isFavourited={isFavourited}
                toggleFavourite={toggleFavourite}
                onShopToggle={setIsShopExpanded}
              />
              <UpcomingWidget upcoming={upcoming || []} />
              <ClientFeedTab
                conversations={conversations || []}
                setIsShopExpanded={setIsShopExpanded}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
