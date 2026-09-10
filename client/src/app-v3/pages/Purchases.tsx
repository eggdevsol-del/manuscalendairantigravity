import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  Feedback,
  Panel,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
} from "../design/primitives";
export default function Purchases() {
  const { user } = useAuth();
  const query = trpc.storefront.getPurchases.useQuery();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const order = query.data?.find(order => order.id === selected);
  const filtered = query.data?.filter(order =>
    `#${order.id} ${order.items.map(item => item.name).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <Screen
      title="Your purchases"
      subtitle="Orders and event registrations."
      back={
        user?.role === "client"
          ? "/profile"
          : user?.role === "merchant"
            ? "/settings"
            : "/business"
      }
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {order ? (
        <Section
          title={`Order #${order.id}`}
          action={
            <Action tone="quiet" onClick={() => setSelected(null)}>
              All purchases
            </Action>
          }
        >
          <Panel>
            <Status>{order.status}</Status>
            <p>
              {bookingDate(order.createdAt)} · {order.fulfillmentMethod}
            </p>
            {order.items.map(item => (
              <Row
                key={item.id}
                title={`${item.quantity} × ${item.name}`}
                trailing={
                  <strong>
                    {money(item.quantity * item.priceCents, order.currency)}
                  </strong>
                }
              />
            ))}
            {order.items
              .filter(item => item.eventAccess)
              .map(item => (
                <Panel key={`access-${item.id}`}>
                  <h2>{item.eventAccess!.title}</h2>
                  <p>{bookingDate(item.eventAccess!.date)}</p>
                  {item.eventAccess!.locationUrl &&
                    (/^https:\/\//i.test(item.eventAccess!.locationUrl) ? (
                      <a
                        className="v3-action v3-action-secondary"
                        href={item.eventAccess!.locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open event details
                      </a>
                    ) : (
                      <p>{item.eventAccess!.locationUrl}</p>
                    ))}
                </Panel>
              ))}
            <dl className="v3-facts">
              <div>
                <dt>Order value</dt>
                <dd>
                  {money(order.totalAmountCents, order.currency)}{" "}
                  {order.currency.toUpperCase()}
                </dd>
              </div>
              {order.trackingNumber && (
                <div>
                  <dt>{order.carrier || "Tracking number"}</dt>
                  <dd>{order.trackingNumber}</dd>
                </div>
              )}
            </dl>
          </Panel>
        </Section>
      ) : (
        <>
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search purchases"
            placeholder="Order number or product"
          />
          {!query.isLoading && !query.error && !filtered?.length && (
            <Panel>
              <p>{search ? "No matching purchases." : "No purchases yet."}</p>
              <p className="v3-muted">
                Paid orders placed while signed in appear here. For guest
                purchases, use the confirmation page saved at checkout.
              </p>
            </Panel>
          )}
          {filtered?.map(order => (
            <Row
              key={order.id}
              title={`Order #${order.id}`}
              detail={`${order.items.map(item => item.name).join(", ")} · ${bookingDate(order.createdAt)}`}
              trailing={<Status>{order.status}</Status>}
              onClick={() => setSelected(order.id)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
export function SupplyOrders() {
  const query = trpc.supplierOrders.getSupplierOrders.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const filtered = query.data?.filter(order =>
    `${order.id} ${order.supplier?.name} ${order.items.map(item => item.productTitle).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const order = query.data?.find(order => order.id === selected);
  return (
    <Screen
      title="Supply orders"
      subtitle="Payment and supplier handoff, kept separate."
      back="/supplies"
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {order ? (
        <Section
          title={`Order #${order.id}`}
          action={
            <Action tone="quiet" onClick={() => setSelected(null)}>
              All orders
            </Action>
          }
        >
          <Panel>
            <h2>{order.supplier?.name || "Supplier"}</h2>
            <Status>
              {order.status === "pending"
                ? "Awaiting payment confirmation"
                : order.status}
            </Status>
            {order.items.map(item => (
              <Row
                key={item.id}
                title={`${item.quantity} × ${item.productTitle}`}
                detail={item.variantTitle}
              />
            ))}
            <dl className="v3-facts">
              <div>
                <dt>Order total</dt>
                <dd>
                  {money(order.totalCents, order.currency)}{" "}
                  {order.currency.toUpperCase()}
                </dd>
              </div>
            </dl>
            {order.status === "paid" && (
              <p>
                {order.shopifyDraftOrderId
                  ? `Supplier draft ${order.shopifyDraftOrderName || order.shopifyDraftOrderId} was created. Shipping confirmation comes from the supplier.`
                  : "Payment is recorded. Supplier handoff is pending. If it does not update, contact support with this order number."}
              </p>
            )}
          </Panel>
        </Section>
      ) : (
        <>
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search supply orders"
          />
          {!query.isLoading && !query.error && !filtered?.length && (
            <Panel>
              <p>No matching supply orders.</p>
            </Panel>
          )}
          {filtered?.map(order => (
            <Row
              key={order.id}
              title={`${order.supplier?.name || "Supplier"} · #${order.id}`}
              detail={`${order.items.length} line items · ${money(order.totalCents, order.currency)} ${order.currency.toUpperCase()}`}
              trailing={<Status>{order.status}</Status>}
              onClick={() => setSelected(order.id)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
