/** Repeat-purchase suggestions, never automatic orders or an inventory prediction. */
type Order = {
  id: number;
  supplierId: number;
  status: string | null;
  createdAt: Date | string;
  supplier?: { name: string } | null;
  items: {
    supplierProductId: number;
    variantId: number | null;
    productTitle: string;
    variantTitle: string | null;
    quantity: number;
  }[];
};
const DAY = 86400000;
export function supplierRecommendations(orders: Order[], now = new Date()) {
  const groups = new Map<number, Order[]>();
  for (const order of orders) {
    if (
      order.status !== "paid" ||
      !order.items.length ||
      !Number.isFinite(+new Date(order.createdAt)) ||
      +new Date(order.createdAt) > +now
    )
      continue;
    groups.set(order.supplierId, [
      ...(groups.get(order.supplierId) || []),
      order,
    ]);
  }
  return [...groups]
    .flatMap(([supplierId, history]) => {
      history.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      // Same-day purchases are one visit, not a zero-day replenishment cycle.
      const visits = history
        .filter(
          (order, i) =>
            i === 0 ||
            new Date(order.createdAt).toISOString().slice(0, 10) !==
              new Date(history[i - 1].createdAt).toISOString().slice(0, 10)
        )
        .slice(0, 7);
      if (visits.length < 2) return [];
      const intervals = visits
        .slice(1)
        .map((order, i) =>
          Math.max(
            1,
            Math.round(
              (+new Date(visits[i].createdAt) - +new Date(order.createdAt)) /
                DAY
            )
          )
        )
        .sort((a, b) => a - b);
      const middle = Math.floor(intervals.length / 2);
      const intervalDays = Math.round(
        intervals.length % 2
          ? intervals[middle]
          : (intervals[middle - 1] + intervals[middle]) / 2
      );
      const latest = visits[0];
      const dueAt = new Date(+new Date(latest.createdAt) + intervalDays * DAY);
      // Suppress recent unfinished checkouts; abandoned carts must not stop future reminders.
      const pending = orders.some(
        o =>
          o.supplierId === supplierId &&
          o.status === "pending" &&
          +new Date(o.createdAt) >= Math.max(+new Date(latest.createdAt), +now - DAY)
      );
      if (pending) return [];
      return [
        {
          supplierId,
          supplierName: latest.supplier?.name || "Supplier",
          orderId: latest.id,
          intervalDays,
          dueAt: dueAt.toISOString(),
          due: +dueAt <= +now,
          sampleOrders: visits.length,
          items: latest.items,
        },
      ];
    })
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
}
