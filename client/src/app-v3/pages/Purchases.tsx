import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
} from "../design/primitives";
import { LiveStage } from "../design/live";
import { Jar, OrderTrack } from "../components/DetailStages";
import { optionName } from "../components/SupplyStore";
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
          {(order.status === "paid" || order.status === "fulfilled") &&
            order.fulfillmentMethod !== "digital" && (
              <OrderStage
                headline={
                  order.status === "fulfilled"
                    ? order.fulfillmentMethod === "pickup"
                      ? "Ready"
                      : "Sent"
                    : "Paid"
                }
                detail={`Ordered ${new Date(order.createdAt).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })} · ${money(order.totalAmountCents, order.currency)} ${order.currency.toUpperCase()}`}
                steps={[
                  "Ordered",
                  "Paid",
                  order.fulfillmentMethod === "pickup" ? "Ready" : "Sent",
                ]}
                reached={order.status === "fulfilled" ? 2 : 1}
              />
            )}
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
  const orderId = Number(
    new URLSearchParams(window.location.search).get("order")
  );
  const query = trpc.supplierOrders.getSupplierOrders.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(
    Number.isInteger(orderId) && orderId > 0 ? orderId : null
  );
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
          <OrderStage
            headline={
              order.status === "pending"
                ? "Confirming payment"
                : order.status === "failed"
                  ? "Payment failed"
                  : order.status === "refunded"
                    ? "Refunded"
                    : order.shopifyDraftOrderId
                      ? `With ${order.supplier?.name || "the supplier"}`
                      : "Paid"
            }
            detail={`Ordered ${new Date(order.createdAt).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })} · ${money(order.totalCents, order.currency)} ${order.currency.toUpperCase()}`}
            steps={
              order.status === "pending" || order.status === "paid"
                ? ["Ordered", "Paid", "With supplier"]
                : null
            }
            reached={
              order.status === "pending" ? 0 : order.shopifyDraftOrderId ? 2 : 1
            }
          />
          <ul className="iosm-ss-lines">
            {order.items.map(item => (
              <li key={item.id}>
                <span className="iosm-ss-tile">
                  <Jar seed={item.supplierProductId} fill={1} />
                  <em>×{item.quantity}</em>
                </span>
                <span className="iosm-ss-line-copy">
                  <b>{item.productTitle}</b>
                  {optionName(item.variantTitle) && (
                    <small>{optionName(item.variantTitle)}</small>
                  )}
                  <em>
                    {money(item.priceCents * item.quantity, order.currency)}
                  </em>
                </span>
              </li>
            ))}
          </ul>
          <Panel>
            <dl className="v3-facts">
              <div>
                <dt>Products</dt>
                <dd>{money(order.subtotalCents, order.currency)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{money(order.shippingCents, order.currency)}</dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd>{money(order.platformFeeCents, order.currency)}</dd>
              </div>
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
          {order.status === "paid" && (
            <ActionLink
              href={`/supplies?supplier=${order.supplierId}&reorder=${order.id}`}
            >
              Order these again
            </ActionLink>
          )}
          {order.supplier?.contactEmail && (
            <a
              className="v3-action v3-action-secondary"
              href={`mailto:${order.supplier.contactEmail}?subject=${encodeURIComponent(`Order #${order.id}`)}`}
            >
              Email {order.supplier.name}
            </a>
          )}
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

/** Where an order is, in large type, with its steps when it is still moving. */
function OrderStage({
  headline,
  detail,
  steps,
  reached,
}: {
  headline: string;
  detail: string;
  steps: string[] | null;
  reached: number;
}) {
  return (
    <LiveStage className="iosm-ss-track" label={`${headline}. ${detail}`}>
      <b>{headline}</b>
      <small>{detail}</small>
      {steps && <OrderTrack steps={steps} reached={reached} />}
    </LiveStage>
  );
}
