import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { SyncOverlay } from "@/features/onboarding/SyncOverlay";
import { cn } from "@/lib/utils";
import { ArrowLeft, TrendingUp, Package, Users, Store, Gift, Settings, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ArtistsTier } from "./ArtistsTier";
import { StorefrontPreviewTier } from "./StorefrontPreviewTier";
import { ShopifySyncTier } from "./ShopifySyncTier";
import { PromotionsTier } from "./PromotionsTier";
import { AnalyticsTier } from "./AnalyticsTier";
import { InventoryTier } from "./InventoryTier";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/utils/formatCurrency";

export function MerchantDashboard() {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const { data: merchant } = trpc.merchantAuth.getMerchantProfile.useQuery();
  const { data: stats } = trpc.merchantAuth.getDashboardStats.useQuery();

  const isShopifyConnected = merchant?.integrationType === "shopify" && !!merchant?.shopifyToken;

  const renderExpandedContent = () => {
    switch (expandedCardId) {
      case "analytics":
        return <AnalyticsTier />;
      case "inventory":
        return <InventoryTier />;
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

  const getExpandedTitle = () => {
    const titles: Record<string, string> = {
      analytics: "Analytics & Revenue",
      inventory: "Inventory & Alerts",
      artists: "Top Artists",
      storefront: "Storefront Preview",
      promotions: "Promotions & Discounts",
      shopify: "Shopify Integration"
    };
    return expandedCardId ? titles[expandedCardId] : "";
  };

  return (
    <PageShell>
      <SyncOverlay />
      
      {/* Header Area */}
      <PageHeader title={expandedCardId ? "Details" : "Home"} />
      
      <div className="px-6 pt-4 z-10 shrink-0 flex flex-col justify-center min-h-[14vh] transition-all duration-300">
        {!expandedCardId ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Revenue</p>
            <p className="text-4xl font-light text-foreground tracking-tight">{stats ? formatCurrency(stats.revenueCents) : "$0.00"}</p>
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-4 h-4" /> Lifetime earnings
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
          </motion.div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full relative mt-4">
        <div className="absolute inset-0 overflow-y-auto mobile-scroll px-6 pb-32">
          
          <AnimatePresence mode="wait">
            {!expandedCardId && (
              <motion.div 
                key="carousels"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pb-20"
              >
                
                {/* Action Required Row */}
                <div>
                  <h2 className="text-[15px] font-bold text-foreground mb-4 pl-1">Action Required</h2>
                  <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
                    
                    <motion.div
                      layoutId={`card-analytics`}
                      onClick={() => setExpandedCardId("analytics")}
                      className="snap-center shrink-0 w-[260px] h-[300px] rounded-[32px] bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/20 flex flex-col justify-between p-6 cursor-pointer relative overflow-hidden"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4">
                          <TrendingUp className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="font-bold text-foreground text-xl">{stats?.pendingOrders || 0} Pending<br/>Orders</h3>
                      </div>
                      <p className="text-sm text-blue-400 font-medium">Requires fulfillment</p>
                    </motion.div>

                    <motion.div
                      layoutId={`card-inventory`}
                      onClick={() => setExpandedCardId("inventory")}
                      className="snap-center shrink-0 w-[260px] h-[300px] rounded-[32px] bg-gradient-to-br from-amber-500/20 to-amber-900/10 border border-amber-500/20 flex flex-col justify-between p-6 cursor-pointer relative overflow-hidden"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
                          <Package className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="font-bold text-foreground text-xl">Low Stock<br/>Alerts</h3>
                      </div>
                      <p className="text-sm text-amber-400 font-medium">{stats?.lowStockItems || 0} items below minimum</p>
                    </motion.div>

                  </div>
                </div>

                {/* Store Management Row */}
                <div>
                  <h2 className="text-[15px] font-bold text-foreground mb-4 pl-1">Store Management</h2>
                  <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
                    
                    <motion.div
                      layoutId={`card-shopify`}
                      onClick={() => setExpandedCardId("shopify")}
                      className="snap-center shrink-0 w-[280px] h-[360px] rounded-[32px] bg-card border border-border/50 flex flex-col justify-between p-6 cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-green-500/20 to-transparent"></div>
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                          <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center backdrop-blur-md">
                            <Settings className="w-7 h-7 text-green-500" />
                          </div>
                          {isShopifyConnected && (
                            <div className="px-3 py-1 bg-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> CONNECTED
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-2xl mb-2">Shopify Sync</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">Manage your live API integration and webhook settings.</p>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      layoutId={`card-storefront`}
                      onClick={() => setExpandedCardId("storefront")}
                      className="snap-center shrink-0 w-[280px] h-[360px] rounded-[32px] bg-card border border-border/50 flex flex-col justify-between p-6 cursor-pointer relative overflow-hidden group"
                    >
                       <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity">
                         <img src="https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover" alt="Ink" />
                         <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
                       </div>
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center backdrop-blur-md">
                          <Store className="w-7 h-7 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-2xl mb-2">Storefront Preview</h3>
                          <p className="text-sm text-muted-foreground/80 leading-relaxed">View how artists see your products.</p>
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      layoutId={`card-promotions`}
                      onClick={() => setExpandedCardId("promotions")}
                      className="snap-center shrink-0 w-[280px] h-[360px] rounded-[32px] bg-card border border-border/50 flex flex-col justify-between p-6 cursor-pointer relative overflow-hidden"
                    >
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center">
                          <Gift className="w-7 h-7 text-pink-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-2xl mb-2">Promotions</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">Create discount codes for top artists.</p>
                        </div>
                      </div>
                    </motion.div>

                  </div>
                </div>

                {/* Discovery Row */}
                <div>
                  <h2 className="text-[15px] font-bold text-foreground mb-4 pl-1">Discover Top Artists</h2>
                  <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
                    <motion.div
                      layoutId={`card-artists`}
                      onClick={() => setExpandedCardId("artists")}
                      className="snap-center shrink-0 w-[180px] h-[240px] rounded-[32px] bg-card border border-border/50 flex flex-col items-center justify-center p-6 cursor-pointer text-center relative"
                    >
                       <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 mb-4">
                         <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200" alt="Artist" className="w-full h-full object-cover" />
                       </div>
                       <h3 className="font-bold text-foreground text-lg leading-tight">Explore<br/>Network</h3>
                       <p className="text-xs text-primary mt-3 font-bold uppercase tracking-wider">See All</p>
                    </motion.div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded View */}
          <AnimatePresence mode="wait">
            {expandedCardId && (
              <motion.div
                key="expanded"
                layoutId={`card-${expandedCardId}`}
                className="bg-card border border-border/50 rounded-[32px] overflow-hidden min-h-[70vh] shadow-[0_0_50px_rgba(0,0,0,0.3)] relative z-50 mb-10"
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
