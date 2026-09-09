import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
export default function Purchases() {
  const query = trpc.storefront.getPurchases.useQuery();
  return (
    <PageShell>
      <PageHeader
        title="Purchase history"
        subtitle="Your store orders and event registrations."
      />
      <div className="flex-1 overflow-y-auto mobile-scroll max-w-3xl mx-auto w-full p-4 pb-28 space-y-4">
        {query.isLoading && <p role="status">Loading purchases…</p>}
        {query.error && (
          <div role="alert">
            <p>We couldn't load your purchases.</p>
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        )}
        {!query.isLoading && !query.error && !query.data?.length && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <h2 className="font-semibold">No purchases yet</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Orders placed while signed in appear here after payment. For guest
              purchases, use the confirmation page saved at checkout.
            </p>
          </div>
        )}
        {query.data?.map(order => (
          <article
            key={order.id}
            className="rounded-2xl border bg-card p-5 space-y-3"
          >
            <div className="flex justify-between gap-3">
              <h2 className="font-semibold">Order #{order.id}</h2>
              <span className="capitalize">{order.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString("en-AU")} ·{" "}
              {order.fulfillmentMethod}
            </p>
            {order.items.map(item => (
              <div className="flex justify-between gap-3 text-sm" key={item.id}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>
                  {new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: order.currency,
                  }).format((item.quantity * item.priceCents) / 100)}
                </span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between">
              <span>Order value</span>
              <strong>
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: order.currency,
                }).format(order.totalAmountCents / 100)}{" "}
                {order.currency.toUpperCase()}
              </strong>
            </div>
            {order.trackingNumber && (
              <p className="text-sm">
                {order.carrier || "Tracking"}: {order.trackingNumber}
              </p>
            )}
          </article>
        ))}
      </div>
    </PageShell>
  );
}
