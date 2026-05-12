import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Package, Search, ChevronDown, CheckCircle2, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function OrdersTab() {
  const { data: orders, isLoading, refetch } = trpc.storefront.getOrders.useQuery();
  const updateStatusMutation = trpc.storefront.updateOrderStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "fulfilled">("all");

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-64 bg-white/5 rounded-3xl border border-white/5">
        <Package className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Orders Yet</h2>
        <p className="text-white/50 text-sm">When you receive storefront orders, they will appear here.</p>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (filter === "all") return true;
    if (filter === "pending") return o.status === "paid" || o.status === "pending"; // paid means they paid but not fulfilled
    if (filter === "fulfilled") return o.status === "fulfilled";
    return true;
  });

  const handleDispatch = async (orderId: number) => {
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: "fulfilled" });
      toast.success("Order marked as dispatched");
    } catch (e: any) {
      toast.error(e.message || "Failed to update order");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-white/5 rounded-full mb-6">
        {(["all", "pending", "fulfilled"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-bold capitalize rounded-full transition-all",
              filter === f ? "bg-white text-black" : "text-white/60 hover:text-white"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-white/50 py-10">No {filter} orders found.</p>
        ) : (
          filteredOrders.map(order => {
            const isExpanded = expandedId === order.id;
            const isFulfilled = order.status === "fulfilled";
            const date = new Date(order.createdAt);
            
            let addressObj = null;
            try {
              if (order.shippingAddress) addressObj = JSON.parse(order.shippingAddress);
            } catch (e) {}

            return (
              <div key={order.id} className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">Order #{order.id}</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        isFulfilled ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
                      )}>
                        {isFulfilled ? "Dispatched" : "Pending"}
                      </span>
                    </div>
                    <div className="text-sm text-white/50 flex gap-2">
                      <span>{format(date, "MMM d, yyyy")}</span>
                      <span>•</span>
                      <span>{order.buyerName || "Guest"}</span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-400">${(order.totalAmountCents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <ChevronDown className={cn("w-5 h-5 text-white/40 transition-transform", isExpanded && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/10"
                    >
                      <div className="p-4 bg-black/20 space-y-6">
                        {/* Items */}
                        <div>
                          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Items</h4>
                          <div className="space-y-2">
                            {order.items.map((item: any) => (
                              <div key={item.id} className="flex justify-between items-center text-sm">
                                <span className="font-medium">{item.quantity}x {item.product?.title || "Deleted Product"}</span>
                                <span className="text-white/60">${((item.priceAtPurchaseCents * item.quantity) / 100).toFixed(2)}</span>
                              </div>
                            ))}
                            {order.shippingCostCents > 0 && (
                              <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5 mt-2">
                                <span className="text-white/60">Shipping</span>
                                <span className="text-white/60">${(order.shippingCostCents / 100).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Customer */}
                        <div>
                          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Customer Details</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-white/40 mb-1">Contact</p>
                              <p className="font-medium">{order.buyerName}</p>
                              <p className="text-white/70">{order.buyerEmail}</p>
                              <p className="text-white/70">{order.buyerPhone}</p>
                            </div>
                            {addressObj && (
                              <div>
                                <p className="text-white/40 mb-1">Shipping Address</p>
                                <p className="text-white/80">
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
                              disabled={updateStatusMutation.isPending}
                              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
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
