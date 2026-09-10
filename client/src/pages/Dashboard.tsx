import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { SetupChecklistWidget } from "@/features/onboarding/SetupChecklistWidget";
import { MerchantDashboard } from "@/features/merchant/Dashboard";
import { TodaySegment } from "@/features/dashboard/TodaySegment";
import { MoneyStrip } from "@/features/dashboard/MoneyStrip";
import { MoneyScreen } from "@/features/dashboard/MoneyScreen";
import { DashboardFABActions } from "@/features/dashboard/DashboardActions";
import {
  useTooltipTour,
  useTooltipTarget,
  DASHBOARD_TOUR,
} from "@/components/tooltip-tour";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [showMoney, setShowMoney] = useState(false);
  const { startTour, isTourCompleted, activeTour } = useTooltipTour();
  const started = useRef(false);
  const payoutRef = useTooltipTarget("payout-widget");
  const actionsRef = useTooltipTarget("dashboard-tabs");
  useEffect(() => {
    if (
      !user ||
      !["artist", "admin"].includes(user.role) ||
      isTourCompleted(DASHBOARD_TOUR.id) ||
      started.current
    )
      return;
    const timer = setTimeout(() => {
      started.current = true;
      startTour(DASHBOARD_TOUR);
    }, 800);
    return () => clearTimeout(timer);
  }, [user, isTourCompleted, startTour]);
  if (user?.role === "merchant") return <MerchantDashboard />;
  if (showMoney)
    return (
      <PageShell>
        <MoneyScreen onBack={() => setShowMoney(false)} />
      </PageShell>
    );
  return (
    <PageShell>
      <PageHeader title="Today" subtitle={format(new Date(), "EEEE, d MMMM")} />
      <div className="flex-1 min-h-0 overflow-y-auto mobile-scroll px-4 py-5 pb-32">
        <div className="max-w-3xl mx-auto space-y-6">
          <div ref={actionsRef} className="flex flex-wrap gap-2">
            <Link
              href="/conversations"
              className="rounded-full bg-primary text-primary-foreground px-5 py-3 font-medium"
            >
              Open inbox
            </Link>
            <Link href="/calendar" className="rounded-full border px-5 py-3">
              View calendar
            </Link>
            <Link
              href="/artist-profile"
              className="rounded-full border px-5 py-3"
            >
              Profile & booking link
            </Link>
          </div>
          <TodaySegment demoMode={activeTour?.id === DASHBOARD_TOUR.id} />
          <SetupChecklistWidget />
          <section
            ref={payoutRef}
            aria-label="Business overview"
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold">Business overview</h2>
            <MoneyStrip onTap={() => setShowMoney(true)} />
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/settings"
                className="min-h-11 inline-flex items-center underline"
              >
                Manage your business
              </Link>
              <Link
                href="/supplies"
                className="min-h-11 inline-flex items-center underline"
              >
                Supplies
              </Link>
              <Link
                href="/subscriptions"
                className="min-h-11 inline-flex items-center underline"
              >
                Your plan
              </Link>
            </div>
          </section>
        </div>
      </div>
      <DashboardFABActions activeCategory="today" onShowChallenge={() => {}} />
    </PageShell>
  );
}
