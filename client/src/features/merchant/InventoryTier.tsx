import React from "react";
import { Package, AlertTriangle, Box } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function InventoryTier() {
  const { data: stats, isLoading } = trpc.merchantAuth.getDashboardStats.useQuery();

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading inventory stats...</div>;
  }

  if (!stats) return null;

  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border/50 rounded-md p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Low Stock Alerts</p>
            <h4 className="text-xl font-bold text-foreground">{stats.lowStockItems}</h4>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-md p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center mb-3">
            <Box className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Total Products</p>
            <h4 className="text-xl font-bold text-foreground">--</h4>
          </div>
        </div>
      </div>
      <div className="mt-4 bg-secondary/50 rounded-md p-4 flex items-center justify-center gap-2">
        <Package className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Detailed Inventory Editor Coming Soon</span>
      </div>
    </div>
  );
}
