import React from "react";
import { Settings, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function ShopifySyncTier() {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Shopify Integration</h3>
          <p className="text-sm text-muted-foreground mt-1">Connect your Tattoi storefront to Shopify.</p>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Connected
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-secondary/20 border border-border/50 rounded-2xl p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <Settings className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground">Sync Status</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Your products and inventory are automatically syncing with your Shopify store every 15 minutes. Orders placed on Tattoi will appear in your Shopify admin.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-foreground">Products Synced</p>
                <p className="text-xs text-muted-foreground">Last sync: 2 mins ago</p>
              </div>
              <p className="text-xl font-light text-foreground">1,240</p>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-foreground">Pending Orders</p>
                  <p className="text-xs text-amber-500/80">Require fulfillment in Shopify</p>
                </div>
              </div>
              <p className="text-xl font-light text-foreground">12</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/50 flex justify-end gap-3">
            <button className="px-5 py-2.5 bg-background text-foreground text-sm font-bold rounded-full hover:bg-secondary/80 transition-colors">
              Configure Webhooks
            </button>
            <button className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
              <RefreshCw className="w-4 h-4" /> Force Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
