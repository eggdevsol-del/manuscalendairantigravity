import { useState } from "react";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Input, Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
export function MerchantOrders() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("paid");
  const query = trpc.storefront.getOrders.useQuery();
  const update = trpc.storefront.updateOrderStatus.useMutation({
    onSuccess: () => {
      void query.refetch();
    },
  });
  const orders = (query.data || []).filter(
    o =>
      (filter === "all" || o.status === filter) &&
      `${o.id} ${o.buyerName || ""} ${o.buyerEmail || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  return (
    <PageShell>
      <PageHeader title="Orders" subtitle="Keep every order moving." />
      <div className="px-4 py-4 max-w-4xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            aria-label="Search orders"
            placeholder="Order number or customer"
            className="flex-1 min-w-44 h-12"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            aria-label="Order status"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border rounded-xl bg-background px-3 h-12"
          >
            <option value="paid">To fulfil</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="all">All orders</option>
          </select>
        </div>
        {query.isLoading && <p role="status">Loading orders…</p>}
        {query.error && (
          <div role="alert">
            <p>We couldn't load your orders.</p>
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {update.error && (
          <p role="alert" className="text-destructive">
            {update.error.message}
          </p>
        )}
        {!query.isLoading && !query.error && !orders.length && (
          <div className="border border-dashed rounded-2xl p-10 text-center">
            <h2 className="text-xl font-semibold">
              {filter === "paid" && !search
                ? "You're all caught up"
                : "No matching orders"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              Paid orders appear here when they're ready to fulfil.
            </p>
          </div>
        )}
        {orders.map(o => (
          <article
            key={o.id}
            className="border bg-card rounded-2xl p-5 space-y-4"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">Order #{o.id}</h2>
                <p className="text-sm text-muted-foreground">
                  {o.buyerName || o.buyerEmail || "Customer"} ·{" "}
                  {o.createdAt.toLocaleDateString("en-AU")}
                </p>
              </div>
              <span className="text-sm capitalize">{o.status}</span>
            </div>
            <ul className="space-y-2">
              {o.items.map(i => (
                <li key={i.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    {i.quantity} × {i.productName || i.product?.title || "Item"}
                  </span>
                  <span>
                    ${((i.priceAtPurchaseCents * i.quantity) / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t pt-3 flex justify-between">
              <span className="capitalize">{o.fulfillmentMethod}</span>
              <strong>${(o.totalAmountCents / 100).toFixed(2)}</strong>
            </div>
            {o.shippingAddress && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {o.shippingAddress}
              </p>
            )}
            {o.status === "paid" && (
              <Button
                className="min-h-12 w-full"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({ orderId: o.id, status: "fulfilled" })
                }
              >
                {update.isPending && update.variables?.orderId === o.id
                  ? "Saving…"
                  : "Mark fulfilled"}
              </Button>
            )}
          </article>
        ))}
      </div>
    </PageShell>
  );
}
