import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Search } from "lucide-react";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { PageShell, PageHeader, SegmentedHeader } from "@/components/ui/ssot";
import { SyncOverlay } from "@/features/onboarding/SyncOverlay";
import { cn } from "@/lib/utils";
import { ArtistsTier } from "./ArtistsTier";
import { StorefrontPreviewTier } from "./StorefrontPreviewTier";
import { ShopifySyncTier } from "./ShopifySyncTier";
import { PromotionsTier } from "./PromotionsTier";
import { AnalyticsTier } from "./AnalyticsTier";
import { InventoryTier } from "./InventoryTier";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/utils/formatCurrency";
import { ExpandableTaskCard } from "./ExpandableTaskCard";

const TITLES = ["Tasks", "Store", "Network"];

export function MerchantDashboard() {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [[page, direction], setPage] = useState([0, 0]);
  const [, setLocation] = useLocation();

  useRegisterFABActions("merchant-dashboard-actions", [
    {
      id: "merchant-settings",
      label: "Settings",
      icon: Settings,
      onClick: () => setLocation("/settings"),
    },
  ]);

  const { data: merchant } = trpc.merchantAuth.getMerchantProfile.useQuery();
  const { data: stats } = trpc.merchantAuth.getDashboardStats.useQuery();
  
  const selectedDate = new Date();

  const toggleExpand = (id: string) => {
    setExpandedCardId(prev => prev === id ? null : id);
  };

  const paginate = (newDirection: number) => {
    const newIndex = page + newDirection;
    if (newIndex < 0 || newIndex >= TITLES.length) return;
    setPage([newIndex, newDirection]);
    setActiveIndex(newIndex);
  };

  // Framer motion variants for tab switching
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

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;
  const activeCategory = TITLES[activeIndex].toLowerCase() as "tasks" | "store" | "network";

  return (
    <PageShell>
      <SyncOverlay />
      <PageHeader title="Home" />
      
      {/* Top Header Metrics (Date & Total Revenue) */}
      <div className="px-6 pt-4 pb-2 z-10 shrink-0 flex justify-between items-center transition-all duration-300">
        <div>
          <p className="text-4xl font-light text-foreground/90 tracking-tight">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <p className="text-muted-foreground text-lg font-medium mt-1">
            {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <button className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <div className="text-right">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-500">{stats ? formatCurrency(stats.revenueCents) : "$0.00"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mobile-scroll">
        <div className="flex flex-col">
          <div className="px-6 pb-2 shrink-0">
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

          <div className="relative" style={{ minHeight: "60vh" }}>
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
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipe = swipePower(offset.x, velocity.x);
                  if (swipe < -swipeConfidenceThreshold) paginate(1);
                  else if (swipe > swipeConfidenceThreshold) paginate(-1);
                }}
                dragDirectionLock
                className="absolute top-0 left-0 w-full px-4 pt-4 touch-pan-y"
              >
                <div className="space-y-1 pb-32 max-w-lg mx-auto">
                  
                  {activeCategory === "tasks" && (
                    <>
                      <ExpandableTaskCard
                        title={`${stats?.pendingOrders || 0} Pending Orders`}
                        context="Requires fulfillment"
                        priority="high"
                        status="pending"
                        actionType="internal"
                        isExpanded={expandedCardId === "analytics"}
                        onToggle={() => toggleExpand("analytics")}
                      >
                        <AnalyticsTier />
                      </ExpandableTaskCard>

                      <ExpandableTaskCard
                        title={`${stats?.lowStockItems || 0} Low Stock Alerts`}
                        context="Items below minimum"
                        priority="medium"
                        status="pending"
                        actionType="internal"
                        isExpanded={expandedCardId === "inventory"}
                        onToggle={() => toggleExpand("inventory")}
                      >
                        <InventoryTier />
                      </ExpandableTaskCard>
                    </>
                  )}

                  {activeCategory === "store" && (
                    <>
                      <ExpandableTaskCard
                        title="Shopify Sync"
                        context="Manage API integration"
                        priority="low"
                        status="completed"
                        actionType="internal"
                        isExpanded={expandedCardId === "shopify"}
                        onToggle={() => toggleExpand("shopify")}
                      >
                        <div className="bg-card rounded-md p-2"><ShopifySyncTier /></div>
                      </ExpandableTaskCard>

                      <ExpandableTaskCard
                        title="Storefront Preview"
                        context="View your live products"
                        priority="low"
                        status="completed"
                        actionType="internal"
                        isExpanded={expandedCardId === "storefront"}
                        onToggle={() => toggleExpand("storefront")}
                      >
                        <div className="bg-card rounded-md p-2"><StorefrontPreviewTier /></div>
                      </ExpandableTaskCard>

                      <ExpandableTaskCard
                        title="Promotions"
                        context="Manage discount codes"
                        priority="low"
                        status="completed"
                        actionType="internal"
                        isExpanded={expandedCardId === "promotions"}
                        onToggle={() => toggleExpand("promotions")}
                      >
                        <div className="bg-card rounded-md p-2"><PromotionsTier /></div>
                      </ExpandableTaskCard>
                    </>
                  )}

                  {activeCategory === "network" && (
                    <>
                      <ExpandableTaskCard
                        title="Explore Network"
                        context="Discover top artists"
                        priority="low"
                        status="completed"
                        actionType="internal"
                        isExpanded={expandedCardId === "artists"}
                        onToggle={() => toggleExpand("artists")}
                      >
                        <div className="bg-card rounded-md p-2"><ArtistsTier /></div>
                      </ExpandableTaskCard>
                    </>
                  )}

                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
