import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { SyncOverlay } from "@/features/onboarding/SyncOverlay";
import { cn } from "@/lib/utils";
import { ChevronRight, ArrowLeft, TrendingUp, Package, Users, Store, Gift, Settings } from "lucide-react";
import { Button } from "@/components/ui";
import { ArtistsTier } from "./ArtistsTier";
import { StorefrontPreviewTier } from "./StorefrontPreviewTier";
import { ShopifySyncTier } from "./ShopifySyncTier";
import { PromotionsTier } from "./PromotionsTier";

const CARDS = [
  { id: "analytics", title: "Analytics & Revenue", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-400/10" },
  { id: "inventory", title: "Inventory & Alerts", icon: Package, color: "text-amber-400", bg: "bg-amber-400/10" },
  { id: "artists", title: "Top Artists", icon: Users, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { id: "storefront", title: "Storefront Preview", icon: Store, color: "text-purple-400", bg: "bg-purple-400/10" },
  { id: "promotions", title: "Promotions & Discounts", icon: Gift, color: "text-pink-400", bg: "bg-pink-400/10" },
  { id: "shopify", title: "Shopify Sync", icon: Settings, color: "text-green-500", bg: "bg-green-500/10" },
];

export function MerchantDashboard() {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const renderExpandedContent = () => {
    switch (expandedCardId) {
      case "analytics":
        return <div className="p-8 text-center text-muted-foreground pt-20">Analytics dashboard coming soon. Includes Weekly/Monthly toggles and Pending orders.</div>;
      case "inventory":
        return <div className="p-8 text-center text-muted-foreground pt-20">Inventory management and low stock alerts.</div>;
      case "artists":
        return <ArtistsTier />;
      case "storefront":
        return <StorefrontPreviewTier />;
      case "promotions":
        return <PromotionsTier />;
      case "shopify":
        return <ShopifySyncTier />;
      default:
        return null;
    }
  };

  return (
    <PageShell>
      <SyncOverlay />
      
      {/* Header Area */}
      <PageHeader title={expandedCardId ? "Details" : "Home"} />
      
      <div className="px-6 pt-4 z-10 shrink-0 flex flex-col justify-center min-h-[14vh] transition-all duration-300">
        {!expandedCardId ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Today's Revenue</p>
            <p className="text-4xl font-light text-foreground tracking-tight">$1,240.50</p>
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-4 h-4" /> +14% vs yesterday (12 orders)
            </p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button 
              variant="ghost" 
              className="w-fit pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground h-auto p-0 mb-2"
              onClick={() => setExpandedCardId(null)}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {CARDS.find(c => c.id === expandedCardId)?.title}
            </h2>
          </motion.div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full relative mt-4">
        <div className="absolute inset-0 overflow-y-auto mobile-scroll px-6 pb-32">
          
          {/* Default Grid View */}
          <AnimatePresence mode="wait">
            {!expandedCardId && (
              <motion.div 
                key="grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20"
              >
                {/* Quick Actions Row */}
                <div className="col-span-1 md:col-span-2 flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                  {["Add Product", "Create PO", "Discounts", "Preview"].map(action => (
                    <button key={action} className="whitespace-nowrap px-5 py-2.5 rounded-full bg-secondary/80 text-sm font-semibold text-foreground hover:bg-secondary transition-colors shrink-0">
                      {action}
                    </button>
                  ))}
                </div>

                {CARDS.map((card) => (
                  <motion.div
                    key={card.id}
                    layoutId={`card-${card.id}`}
                    onClick={() => setExpandedCardId(card.id)}
                    className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-[24px] p-5 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", card.bg)}>
                        <card.icon className={cn("w-6 h-6", card.color)} />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-[15px]">{card.title}</h3>
                        <p className="text-[13px] text-muted-foreground/80 font-medium mt-0.5">Tap to expand</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded View */}
          <AnimatePresence mode="wait">
            {expandedCardId && (
              <motion.div
                key="expanded"
                layoutId={`card-${expandedCardId}`}
                className="bg-card border border-border/50 rounded-[32px] overflow-hidden min-h-[60vh] shadow-xl"
              >
                {renderExpandedContent()}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </PageShell>
  );
}
