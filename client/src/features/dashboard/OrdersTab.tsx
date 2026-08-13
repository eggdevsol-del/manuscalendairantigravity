import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Package, Search, ChevronDown, CheckCircle2, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_ORDERS } from "./dashboardDemoData";

interface OrdersTabProps {
  demoMode?: boolean;
}

export function OrdersTab({ demoMode = false }: OrdersTabProps) {
  const demoOrdersAreaRef = useTooltipTarget("demo-orders-area");
  const demoOrderCardRef = useTooltipTarget("demo-order-card");
  const { data: orders, isLoading, refetch } = trpc.storefront.getOrders.useQuery();
  const updateStatusMutation = trpc.storefront.updateOrderStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "fulfilled">("all");

  // In demo mode, build mock orders matching the real API shape
  const mockOrders = demoMode ? DEMO_ORDERS.map(d => ({
    id: d.id,
    buyerName: d.customerName,
    buyerEmail: d.customerEmail,
    buyerPhone: "",
    totalAmountCents: d.amount * 100,
    status: d.status,
    createdAt: d.createdAt,
    shippingAddress: null as string | null,
    shippingCostCents: 0,
    items: [{ id: d.id, quantity: d.quantity, product: { title: d.item }, priceAtPurchaseCents: d.amount * 100 }],
  })) : null;

  // Use mock data in demo mode, real data otherwise
  const displayOrders = demoMode ? mockOrders : orders;
  const displayLoading = demoMode ? false : isLoading;

  if (displayLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!displayOrders || displayOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-64 bg-secondary/50 rounded-3xl border border-border">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Orders Yet</h2>
        <p className="text-muted-foreground text-sm">When you receive storefront orders, they will appear here.</p>
      </div>
    );
  }

  const filteredOrders = displayOrders.filter((o: any) => {
    if (filter === "all") return true;
    if (filter === "pending") return o.status === "paid" || o.status === "pending";
    if (filter === "fulfilled") return o.status === "fulfilled";
    return true;
  });

  const handleDispatch = async (orderId: number) => {
    if (demoMode) return;
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: "fulfilled" });
      toast.success("Order marked as dispatched");
    } catch (e: any) {
      toast.error(e.message || "Failed to update order");
    }
  };

  return (
    <div className="space-y-4" ref={demoMode ? demoOrdersAreaRef as any : undefined}>
      <div className="flex gap-2 p-1 bg-secondary/50 rounded-full mb-6">
        {(["all", "pending", "fulfilled"] as const).map(f => (
          <button
            key={f}
            onClick={() => !demoMode && setFilter(f)}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-bold capitalize rounded-full transition-all",
              filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-white"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No {filter} orders found.</p>
        ) : (
          filteredOrders.map((order: any, orderIndex: number) => {
            const isExpanded = expandedId === order.id;
            const isFulfilled = order.status === "fulfilled";
            const date = new Date(order.createdAt);
            
            let addressObj = null;
            try {
              if (order.shippingAddress) addressObj = JSON.parse(order.shippingAddress);
            } catch (e) {}

            return (
              <div
                key={order.id}
                ref={demoMode && orderIndex === 0 ? demoOrderCardRef as any : undefined}
                className="bg-secondary/50 border border-border rounded-[20px] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">Order #{order.id}</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        isFulfilled ? "bg-[var(--color-status-success-bg)] text-[var(--color-success)]" : "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                      )}>
                        {isFulfilled ? "Dispatched" : "Pending"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-2">
                      <span>{format(date, "MMM d, yyyy")}</span>
                      <span>•</span>
                      <span>{order.buyerName || "Guest"}</span>
                      <span>•</span>
                      <span className="font-semibold text-[var(--color-status-info-text)]">${(order.totalAmountCents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="p-4 bg-background/80 space-y-6">
                        {/* Items */}
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Items</h4>
                          <div className="space-y-2">
                            {order.items && order.items.map((item: any) => (
                              <div key={item.id} className="flex justify-between items-center text-sm">
                                <span className="font-medium">{item.quantity}x {item.product?.title || "Deleted Product"}</span>
                                <span className="text-muted-foreground">${((item.priceAtPurchaseCents * item.quantity) / 100).toFixed(2)}</span>
                              </div>
                            ))}
                            {order.shippingCostCents > 0 && (
                              <div className="flex justify-between items-center text-sm pt-2 border-t border-border mt-2">
                                <span className="text-muted-foreground">Shipping</span>
                                <span className="text-muted-foreground">${(order.shippingCostCents / 100).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Customer */}
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Customer Details</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Contact</p>
                              <p className="font-medium">{order.buyerName}</p>
                              <p className="text-muted-foreground">{order.buyerEmail}</p>
                              {order.buyerPhone && <p className="text-muted-foreground">{order.buyerPhone}</p>}
                            </div>
                            {addressObj && (
                              <div>
                                <p className="text-muted-foreground mb-1">Shipping Address</p>
                                <p className="text-muted-foreground">
                                  {addressObj.line1}<br />
                                  {addressObj.line2 && <>{addressObj.line2}<br /></>}
                                  {addressObj.city}, {addressObj.state} {addressObj.postal_code}<br />
                                  {addressObj.country}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        {!isFulfilled && (
                          <div className="pt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDispatch(order.id); }}
                              disabled={demoMode || updateStatusMutation.isPending}
                              className="w-full py-3 bg-primary hover:bg-primary/90 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                            >
                              {updateStatusMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                              Mark as Dispatched
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
