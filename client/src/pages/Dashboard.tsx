/**
 * Dashboard — §2 Information Architecture
 *
 * Bottom nav: Home · Messages · Calendar · Profile (unchanged)
 *
 * Home screen layout:
 *   - Header: avatar + name + "Today, {date}" (§6.1)
 *   - Money strip (§6.2) — amber hairline, taps to push MoneyScreen
 *   - Segmented control: Today · Clients · Supplies (§2)
 *   - Content area: renders the active segment
 *
 * Money is NOT a tab. It is a pushed screen.
 * Clients tab is untouched — renders existing ClientsTab as-is.
 *
 * Hard rules:
 *   - Do not add/remove/rename any tab or nav item
 *   - Do not modify ClientsTab
 *   - Never more than three buttons in expanded rows
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageShell,
  PageHeader,
  SegmentedHeader,
} from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { format } from "date-fns";
import { useTeaser } from "@/contexts/TeaserContext";
import { SetupChecklistWidget } from "@/features/onboarding/SetupChecklistWidget";
import { MerchantDashboard } from "@/features/merchant/Dashboard";
import { useTooltipTour, DASHBOARD_TOUR } from "@/components/tooltip-tour";
import { DashboardFABActions } from "@/features/dashboard/DashboardActions";

// ── Segments ──────────────────────────────────────────────
import { TodaySegment } from "@/features/dashboard/TodaySegment";
import { ClientsTab } from "@/features/dashboard/ClientsTab";
import { SuppliesSegment } from "@/features/dashboard/SuppliesSegment";
import { MoneyStrip } from "@/features/dashboard/MoneyStrip";
import { MoneyScreen } from "@/features/dashboard/MoneyScreen";

// ── Constants ─────────────────────────────────────────────

const TITLES = ["Today", "Clients", "Supplies"];

// ── Main Component ────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);

  // Money pushed screen state
  const [showMoney, setShowMoney] = useState(false);

  // Tooltip tour
  const { startTour, isTourCompleted, activeTour, currentStep } = useTooltipTour();
  const dashTourStartedRef = useRef(false);
  const isDemoMode = activeTour?.id === "dashboard-overview";

  // Auto-start dashboard tour
  useEffect(() => {
    if (
      user &&
      !isTourCompleted("dashboard-overview") &&
      !dashTourStartedRef.current
    ) {
      dashTourStartedRef.current = true;
      const timer = setTimeout(() => startTour(DASHBOARD_TOUR), 800);
      return () => clearTimeout(timer);
    }
  }, [user, isTourCompleted, startTour]);

  // Auto-switch tabs during tour
  useEffect(() => {
    if (!isDemoMode) return;
    let targetIndex = 0;
    if (currentStep >= 3 && currentStep <= 5) targetIndex = 1;
    else if (currentStep >= 6) targetIndex = 2;

    if (activeIndex !== targetIndex) {
      const dir = targetIndex > activeIndex ? 1 : -1;
      setPage([targetIndex, dir]);
      setActiveIndex(targetIndex);
    }
  }, [isDemoMode, currentStep]);

  // Redirect Studio users
  useEffect(() => {
    if (user?.role === "studio") {
      setLocation("/studio");
    }
  }, [user, setLocation]);

  // Teaser Mode
  const { isTeaserClient } = useTeaser();

  // Framer motion for swipe transitions
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  const [[page, direction], setPage] = useState([0, 0]);

  const activeCategory = TITLES[activeIndex].toLowerCase() as "today" | "clients" | "supplies";

  const todayLabel = format(new Date(), "EEEE, d MMMM");

  if (user?.role === "studio") return null;
  if (user?.role === "merchant") return <MerchantDashboard />;

  // ── Money pushed screen ──
  if (showMoney) {
    return (
      <PageShell>
        <MoneyScreen onBack={() => setShowMoney(false)} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* SSOT PageHeader — handles safe-area-inset-top for notch */}
      <PageHeader title="Home" subtitle={todayLabel} />

      {/* 2. Content Container */}
      <div className={cn(tokens.contentContainer.base, "relative")}>
        {/* Teaser Mode Overlay */}
        {isTeaserClient && (
          <div
            className="absolute inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-all hover:bg-background/70"
          >
            <div className="flex flex-col items-center gap-3 p-8 rounded-[2rem] bg-card border border-border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Dashboard Locked</h3>
              <button className="text-sm font-medium text-primary hover:underline">
                Install app to unlock
              </button>
            </div>
          </div>
        )}

        {/* Scrollable wrapper */}
        <div className="flex-1 overflow-y-auto mobile-scroll">
          <div className="px-6 w-full z-10 relative space-y-4">
            <div>
              <SetupChecklistWidget />
            </div>

            {/* §6.2 Money strip — always visible for artists */}
            {(user?.role === "artist" || user?.role === "admin") && (
              <MoneyStrip onTap={() => setShowMoney(true)} />
            )}
          </div>

          <div
            className={cn(
              "flex flex-col",
              isTeaserClient && "filter blur-sm pointer-events-none select-none"
            )}
          >
            {/* §2: Segmented control — Today · Clients · Supplies */}
            <div className="px-6 pb-2 pt-2 shrink-0 relative z-50">
              <SegmentedHeader
                options={TITLES}
                activeIndex={activeIndex}
                onChange={index => {
                  const dir = index > activeIndex ? 1 : -1;
                  setPage([index, dir]);
                  setActiveIndex(index);
                }}
              />
            </div>

            {/* Content area */}
            <div className="relative" style={{ minHeight: "60vh" }}>
              <div className="relative w-full" style={{ minHeight: "60vh" }}>
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={page}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                    className="absolute top-0 left-0 w-full px-4 pt-4 touch-pan-y"
                  >
                    <div className="pb-32 max-w-lg mx-auto">
                      {activeCategory === "today" ? (
                        <TodaySegment demoMode={isDemoMode} />
                      ) : activeCategory === "clients" ? (
                        <ClientsTab demoMode={isDemoMode} />
                      ) : activeCategory === "supplies" ? (
                        <SuppliesSegment demoMode={isDemoMode} />
                      ) : null}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAB Actions */}
      <DashboardFABActions
        activeCategory={activeCategory as any}
        onShowChallenge={() => {}}
      />
    </PageShell>
  );
}
