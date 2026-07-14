/**
 * ClientHome — Unified client home page
 * ─────────────────────────────────────────────────────────
 * Two views toggled from the header:
 * - Discovery: Instagram-style portrait card feed
 * - Home: My Artists, Upcoming, Discover Artists cards
 *
 * Header auto-hides on scroll down, reappears on scroll up.
 * Tapping an image enters Artist Focus mode with a floating pill.
 */
import "./clientHome.css";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Compass, Home } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Discovery feed (reused)
import DiscoverFeedContent from "./DiscoverFeedContent";
import ArtistPortfolioFeed from "./ArtistPortfolioFeed";
import ArtistProfileOverlay from "./ArtistProfileOverlay";
import { FeedCardData } from "../feed/FeedCard";

// Home view components (reused from client-profile)
import { MyArtistsSection } from "@/features/client-profile/MyArtistsSection";
import { UpcomingWidget } from "@/features/client-profile/UpcomingWidget";
import { ClientFeedTab } from "@/features/client-profile/ClientFeedTab";
import { useClientProfileController } from "@/features/profile/useClientProfileController";
import { useFavourites } from "@/features/client-profile/useFavourites";
import { trpc } from "@/lib/trpc";
import { useBottomNav } from "@/contexts/BottomNavContext";

type ViewMode = "discovery" | "home";

interface FocusedArtist {
  id: string;
  name: string;
  avatar: string | null;
  slug: string | null;
  tappedImageId: number;
}

export default function ClientHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ViewMode>("discovery");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const { setBottomNavHidden } = useBottomNav();

  // Artist focus mode
  const [focusedArtist, setFocusedArtist] = useState<FocusedArtist | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const mainFeedScrollPos = useRef(0);

  // Home view data
  const { upcoming } = useClientProfileController();
  const { favouriteIds, isFavourited, toggleFavourite } = useFavourites();
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    staleTime: 30000,
  });
  const [isShopExpanded, setIsShopExpanded] = useState(false);

  // Enter artist focus mode
  const handleImageTap = useCallback((card: FeedCardData) => {
    // Save scroll position
    if (scrollRef.current) {
      mainFeedScrollPos.current = scrollRef.current.scrollTop;
    }
    setFocusedArtist({
      id: card.artistId,
      name: card.artistName,
      avatar: card.artistAvatar,
      slug: card.artistSlug,
      tappedImageId: card.id,
    });
    // Hide header, show immersive view
    setHeaderHidden(true);
    setBottomNavHidden(true);
    // Scroll to top for the artist feed
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [setBottomNavHidden]);

  // Open artist profile directly (from tapping artist name/avatar in feed)
  const handleArtistProfileTap = useCallback((card: FeedCardData) => {
    setFocusedArtist({
      id: card.artistId,
      name: card.artistName,
      avatar: card.artistAvatar,
      slug: card.artistSlug,
      tappedImageId: card.id,
    });
    setShowProfile(true);
    setHeaderHidden(true);
    setBottomNavHidden(true);
  }, [setBottomNavHidden]);

  // Exit artist focus mode
  const handleExitFocus = useCallback(() => {
    setFocusedArtist(null);
    setShowProfile(false);
    setHeaderHidden(false);
    setBottomNavHidden(false);
    // Restore scroll position
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = mainFeedScrollPos.current;
      }
    });
  }, [setBottomNavHidden]);

  // Auto-hide header + bottom nav on scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const currentY = el.scrollTop;
    const delta = currentY - lastScrollY.current;

    // Only trigger after meaningful scroll
    if (Math.abs(delta) > 8) {
      if (delta > 0 && currentY > 60) {
        // Scrolling down — hide both
        setHeaderHidden(true);
        setBottomNavHidden(true);
      } else {
        // Scrolling up — show both
        setHeaderHidden(false);
        setBottomNavHidden(false);
      }
    }

    lastScrollY.current = currentY;
  }, [setBottomNavHidden]);

  // Reset header + bottom nav when switching views
  useEffect(() => {
    setHeaderHidden(false);
    setBottomNavHidden(false);
    setFocusedArtist(null);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [view, setBottomNavHidden]);

  // Ensure bottom nav is visible when leaving this page
  useEffect(() => {
    return () => setBottomNavHidden(false);
  }, [setBottomNavHidden]);

  const avatarUrl = user?.avatar;
  const initials = (user?.name || "?").charAt(0).toUpperCase();

  // Pill is visible when in focus mode AND header is hidden
  const showPill = focusedArtist !== null && headerHidden;

  return (
    <>
      {/* ── Auto-hide Header ── */}
      <header className={`client-home-header ${headerHidden ? "header-hidden" : ""}`}>
        {focusedArtist ? (
          /* Focus mode header — mirrors the pill layout */
          <div className="artist-focus-header-row">
            <button
              className="artist-focus-pill-back"
              onClick={handleExitFocus}
            >
              back
            </button>
            <div className="artist-focus-pill-avatar">
              {focusedArtist.avatar ? (
                <img src={focusedArtist.avatar} alt={focusedArtist.name} />
              ) : (
                <span>{focusedArtist.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="artist-focus-pill-name">{focusedArtist.name}</span>
            <button
              className="artist-focus-pill-book"
              onClick={() => setShowProfile(true)}
            >
              View Profile
            </button>
          </div>
        ) : (
          /* Normal header */
          <>
            <div
              className="client-home-avatar"
              onClick={() => setLocation("/profile")}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" />
              ) : (
                <div className="client-home-avatar-fallback">{initials}</div>
              )}
            </div>
            <span className="client-home-logo">TATTOI</span>
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
          </>
        )}
      </header>

      {/* ── Floating Artist Pill (visible when scrolling in focus mode) ── */}
      <AnimatePresence>
        {showPill && focusedArtist && (
          <motion.div
            className="artist-focus-pill"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <button
              className="artist-focus-pill-back"
              onClick={handleExitFocus}
            >
              back
            </button>
            <div className="artist-focus-pill-avatar">
              {focusedArtist.avatar ? (
                <img src={focusedArtist.avatar} alt={focusedArtist.name} />
              ) : (
                <span>{focusedArtist.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="artist-focus-pill-name">{focusedArtist.name}</span>
            <button
              className="artist-focus-pill-book"
              onClick={() => setShowProfile(true)}
            >
              View Profile
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div
        className="client-home-content"
        ref={!focusedArtist ? scrollRef : undefined}
        onScroll={!focusedArtist ? handleScroll : undefined}
      >
        <div className="client-home-content-inner">
          {/* Base layer: always rendered (discovery or home) */}
          {view === "discovery" ? (
            <DiscoverFeedContent onImageTap={handleImageTap} onArtistProfileTap={handleArtistProfileTap} />
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

      {/* ── Focus view overlay (slides in on top, slides out to reveal beneath) ── */}
      <AnimatePresence>
        {focusedArtist && (
          <motion.div
            key="artist-focus-overlay"
            className="client-home-content snap-scroll"
            ref={scrollRef}
            onScroll={handleScroll}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: [0.12, 0, 0.04, 1] }}
            style={{ zIndex: 2 }}
          >
            <ArtistPortfolioFeed
              artistId={focusedArtist.id}
              tappedImageId={focusedArtist.tappedImageId}
              onExit={handleExitFocus}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full-screen Artist Profile Overlay (slides in on top of focus) ── */}
      <AnimatePresence>
        {showProfile && focusedArtist && (
          <ArtistProfileOverlay
            artistId={focusedArtist.id}
            artistName={focusedArtist.name}
            artistAvatar={focusedArtist.avatar}
            artistSlug={focusedArtist.slug}
            onClose={() => setShowProfile(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
