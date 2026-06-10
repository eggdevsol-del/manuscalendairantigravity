import React from "react";
import { Gift, Plus, Megaphone } from "lucide-react";

export function PromotionsTier() {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Promotions</h3>
          <p className="text-sm text-muted-foreground mt-1">Broadcast discounts to your top artists.</p>
        </div>
        <button className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center hover:bg-primary/30 transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Active Promotion */}
        <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-md p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-foreground">Winter Cartridges Sale</h4>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Active</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Sent to 45 artists</p>
              </div>
            </div>
          </div>
          <div className="bg-background/50 rounded-md p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Code</p>
              <p className="text-lg font-mono font-bold tracking-widest text-foreground">WINTER20</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Redemptions</p>
              <p className="text-lg font-light text-foreground">12 / 45</p>
            </div>
          </div>
        </div>

        {/* Draft Promotion */}
        <div className="bg-secondary/20 border border-border/50 rounded-md p-5 opacity-70">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Gift className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-foreground">Flash Sale: Inks</h4>
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">Draft</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Not sent yet</p>
              </div>
            </div>
          </div>
          <div className="bg-background/50 rounded-md p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Code</p>
              <p className="text-lg font-mono font-bold tracking-widest text-foreground">INKFLASH50</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Target</p>
              <p className="text-sm font-medium text-foreground mt-1">All VIP Artists</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
