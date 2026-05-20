import React from "react";
import { TrendingUp, Package, Clock, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/utils/formatCurrency";

export function AnalyticsTier() {
  const { data: stats, isLoading } = trpc.merchantAuth.getDashboardStats.useQuery();

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading analytics...</div>;
  }

  if (!stats) return null;

  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Verified Revenue</p>
            <h4 className="text-xl font-bold text-foreground">{formatCurrency(stats.revenueCents)}</h4>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Fulfilled Orders</p>
            <h4 className="text-xl font-bold text-foreground">{stats.totalOrders}</h4>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Pending Orders</p>
            <h4 className="text-xl font-bold text-foreground">{stats.pendingOrders}</h4>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Conversion Rate</p>
            <h4 className="text-xl font-bold text-foreground">--</h4>
          </div>
        </div>
      </div>
    </div>
  );
}
