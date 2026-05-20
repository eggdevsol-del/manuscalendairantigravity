import React from "react";
import { Package, AlertTriangle, Box } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function InventoryTier() {
  const { data: stats, isLoading } = trpc.merchantAuth.getDashboardStats.useQuery();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground pt-20">Loading inventory stats...</div>;
  }

  if (!stats) return null;

  return (
    <div className="flex flex-col h-full bg-background rounded-[32px]">
      <div className="p-8 border-b border-border/50">
        <h3 className="text-2xl font-bold text-foreground">Inventory & Alerts</h3>
        <p className="text-muted-foreground">Manage your stock levels and low stock warnings.</p>
      </div>

      <div className="flex-1 p-8">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Low Stock Alerts</p>
              <h4 className="text-3xl font-bold text-foreground">{stats.lowStockItems}</h4>
              <p className="text-xs text-amber-500 mt-1">Requires attention</p>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Box className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Active Products</p>
              <h4 className="text-3xl font-bold text-foreground">--</h4>
              <p className="text-xs text-muted-foreground mt-1">All available items</p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-card border border-border/50 rounded-3xl p-6 text-center">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium text-foreground">Detailed Inventory Coming Soon</h4>
          <p className="text-sm text-muted-foreground">You will soon be able to update stock directly from here.</p>
        </div>
      </div>
    </div>
  );
}
