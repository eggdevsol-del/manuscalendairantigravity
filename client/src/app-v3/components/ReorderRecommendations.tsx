import { trpc } from "@/lib/trpc";
import { ActionLink, Feedback, Panel, Section } from "../design/primitives";
export function ReorderRecommendations({
  showUpcoming = false,
}: {
  showUpcoming?: boolean;
}) {
  const query = trpc.supplierOrders.getReorderRecommendations.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );
  const recommendations = (query.data || []).filter(r => showUpcoming || r.due);
  return (
    <Section title="Order recommendations">
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {!query.isLoading && !query.error && !recommendations.length && (
        <p className="v3-muted">
          {query.data?.length
            ? "Your next reorder is not due yet. See Supplies for upcoming suggestions."
            : "Repeat paid orders help estimate when to reorder. No purchases are made automatically."}
        </p>
      )}
      {recommendations.map(r => (
        <Panel key={r.supplierId}>
          <h3>{r.supplierName}</h3>
          <p>
            {r.items.map(i => `${i.quantity} × ${i.productTitle}`).join(" · ")}
          </p>
          <p className="v3-muted">
            {r.due
              ? "Suggested now"
              : `Suggested ${new Date(r.dueAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}{" "}
            · about every {r.intervalDays} days, based on {r.sampleOrders} paid
            orders.
          </p>
          <p className="v3-muted">
            Review your stock first. Current prices and availability are checked
            when you open the basket.
          </p>
          <ActionLink
            tone="quiet"
            href={`/supplies?supplier=${r.supplierId}&reorder=${r.orderId}`}
          >
            Review reorder
          </ActionLink>
        </Panel>
      ))}
    </Section>
  );
}
