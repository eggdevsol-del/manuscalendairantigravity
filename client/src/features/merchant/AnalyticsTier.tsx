import React from "react";
import { TrendingUp, Package, Clock, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/utils/formatCurrency";

export function AnalyticsTier() {
  const { data: stats, isLoading } = trpc.merchantAuth.getDashboardStats.useQuery();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground pt-20">Loading analytics...</div>;
  }

  if (!stats) return null;

  return (
    <div className="flex flex-col h-full bg-background rounded-[32px]">
      <div className="p-8 border-b border-border/50">
        <h3 className="text-2xl font-bold text-foreground">Revenue Analytics</h3>
        <p className="text-muted-foreground">Overview of your performance and active sales.</p>
      </div>

      <div className="flex-1 p-8">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Verified Revenue</p>
              <h4 className="text-3xl font-bold text-foreground">{formatCurrency(stats.revenueCents)}</h4>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Orders Fulfilled</p>
              <h4 className="text-3xl font-bold text-foreground">{stats.totalOrders}</h4>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Pending Orders</p>
              <h4 className="text-3xl font-bold text-foreground">{stats.pendingOrders}</h4>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Conversion Rate</p>
              <h4 className="text-3xl font-bold text-foreground">N/A</h4>
              <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
