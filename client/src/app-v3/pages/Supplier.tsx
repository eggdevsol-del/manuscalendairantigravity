import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Package,
  ShoppingBag,
  Settings as SettingsIcon,
  CreditCard,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
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
  Tabs,
} from "../design/primitives";
import { ShopifyCatalogue as ShopifySyncTier } from "./Integrations";
export default function SupplierToday() {
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const stats = trpc.merchantAuth.getDashboardStats.useQuery();
  const data = stats.data;
  return (
    <Screen
      title="Home"
      subtitle={profile.data?.businessName || "Your store at a glance"}
    >
      <Feedback
        loading={stats.isLoading}
        error={stats.error || profile.error}
        onRetry={() => {
          void stats.refetch();
          void profile.refetch();
        }}
      />
      {data && (
        <div className="v3-grid">
          <Section title="Needs you">
            <Row
              title={`${data.pendingOrders} orders to fulfil`}
              detail="Paid orders ready for their next step"
              icon={<Package />}
              href="/merchant/orders"
            />
            <Row
              title={`${data.lowStockItems} products running low`}
              detail="Check availability and stock levels"
              icon={<ShoppingBag />}
              href="/merchant/products"
            />
          </Section>
          <Section title="Tattoi sales">
            <Panel>
              <h2>
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: profile.data?.country === "NZ" ? "NZD" : "AUD",
                }).format(data.revenueCents / 100)}
              </h2>
              <p>Recorded paid and fulfilled orders, before fees.</p>
              <Row
                title="Total orders"
                trailing={<strong>{data.totalOrders}</strong>}
              />
            </Panel>
          </Section>
        </div>
      )}
      <Section title="Manage your sales channel">
        <Row
          title="Catalogue & stock"
          detail="Manage products available to artists"
          href="/merchant/products"
        />
        <Row
          title="Shopify connection"
          detail="Import and review your catalogue"
          href="/settings"
        />
        <Row
          title="Artist conversations"
          detail="Help customers with their orders"
          href="/conversations"
        />
      </Section>
      <SupplierPayments />
      <Row
        title="Store settings"
        detail="Business details, account and integrations"
        icon={<SettingsIcon />}
        href="/settings"
      />
    </Screen>
  );
}
export function SupplierOrders() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"To fulfil" | "Fulfilled" | "All">(
    "To fulfil"
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const query = trpc.storefront.getOrders.useQuery();
  const update = trpc.storefront.updateOrderStatus.useMutation({
    onSuccess: () => {
      void query.refetch();
    },
  });
  const orders = (query.data || []).filter(
    o =>
      (tab === "All" ||
        o.status === (tab === "To fulfil" ? "paid" : "fulfilled")) &&
      `${o.id} ${o.buyerName} ${o.buyerEmail}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const order = query.data?.find(o => o.id === selected);
  return (
    <Screen
      title="Orders"
      subtitle="From paid to delivered"
      wide
      back={user?.role === "merchant" ? undefined : "/artist-profile"}
    >
      <Tabs
        items={["To fulfil", "Fulfilled", "All"] as const}
        value={tab}
        onChange={setTab}
        label="Order status"
      />
      <SearchField
        value={search}
        onChange={setSearch}
        label="Search orders"
        placeholder="Order number or customer"
      />
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      <div className={`v3-client-layout ${selected ? "has-selection" : ""}`}>
        <section className="v3-client-list">
          {orders.map(o => (
            <Row
              key={o.id}
              title={`Order #${o.id}`}
              detail={`${o.buyerName || o.buyerEmail || "Customer"} · ${money(o.totalAmountCents, o.currency)}`}
              onClick={() => setSelected(o.id)}
              trailing={
                <Status tone={o.status === "fulfilled" ? "success" : "neutral"}>
                  {statusLabel(o.status)}
                </Status>
              }
            />
          ))}
          {!query.isLoading && !orders.length && (
            <Feedback
              empty={
                tab === "To fulfil"
                  ? "You’re all caught up. New paid orders will appear here."
                  : "No matching orders."
              }
            />
          )}
        </section>
        <aside className="v3-client-detail">
          {order ? (
            <div className="v3-stack">
              <Action tone="quiet" onClick={() => setSelected(null)}>
                All orders
              </Action>
              <h2 className="v3-detail-title">Order #{order.id}</h2>
              <p className="v3-muted">{bookingDate(order.createdAt)}</p>
              <div>
                <Status>{statusLabel(order.status)}</Status>
              </div>
              <Section title="Items">
                {order.items.map(i => (
                  <Row
                    key={i.id}
                    title={`${i.quantity} × ${i.productName || i.product?.title || "Item"}`}
                    trailing={
                      <strong>
                        {money(
                          i.priceAtPurchaseCents * i.quantity,
                          order.currency
                        )}
                      </strong>
                    }
                  />
                ))}
              </Section>
              <Row
                title="Total"
                trailing={
                  <strong>
                    {money(order.totalAmountCents, order.currency)}
                  </strong>
                }
              />
              <Section title={statusLabel(order.fulfillmentMethod)}>
                <p>{order.buyerName || order.buyerEmail}</p>
                {order.shippingAddress && (
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {order.shippingAddress}
                  </p>
                )}
              </Section>
              {update.error && <p role="alert">{update.error.message}</p>}
              {order.status === "paid" && (
                <Action
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ orderId: order.id, status: "fulfilled" })
                  }
                >
                  {update.isPending ? "Saving…" : "Mark fulfilled"}
                </Action>
              )}
            </div>
          ) : (
            <Feedback empty="Select an order to review its items and delivery details." />
          )}
        </aside>
      </div>
    </Screen>
  );
}
export function SupplierSettings() {
  const query = trpc.merchantAuth.getMerchantProfile.useQuery();
  return (
    <Screen
      title="Store settings"
      subtitle="Your business, payments and connections"
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data && (
        <SupplierProfile key={query.data.id} initial={query.data} />
      )}
      <SupplierPayments />
      <Section title="Shopify">
        <ShopifySyncTier />
      </Section>
      <ActionLink href="/account-settings">
        Account, notifications & sign out
      </ActionLink>
    </Screen>
  );
}
function SupplierProfile({ initial }: { initial: any }) {
  const [form, setForm] = useState({
    businessName: initial.businessName,
    contactName: initial.contactName || "",
    phone: initial.phone || "",
    address: initial.address || "",
  });
  const utils = trpc.useUtils();
  const save = trpc.merchantAuth.updateProfile.useMutation({
    onSuccess: () => {
      void utils.merchantAuth.invalidate();
    },
  });
  return (
    <form
      className="v3-form"
      onSubmit={e => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      {(
        [
          ["businessName", "Business name"],
          ["contactName", "Contact name"],
          ["phone", "Phone"],
          ["address", "Business address"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            required={key === "businessName"}
            type={key === "phone" ? "tel" : "text"}
            value={form[key]}
            onChange={e => {
              save.reset();
              setForm({ ...form, [key]: e.target.value });
            }}
          />
        </label>
      ))}
      {save.error && <p role="alert">{save.error.message}</p>}
      {save.isSuccess && <p role="status">Saved.</p>}
      <Action type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save business details"}
      </Action>
      {initial.status === "active" && (
        <ActionLink href={`/shop/supplier-${initial.id}`} tone="quiet">
          Open public store
        </ActionLink>
      )}
    </form>
  );
}
function SupplierPayments() {
  const status = trpc.merchantAuth.getMerchantStripeStatus.useQuery();
  const connect = trpc.merchantAuth.connectStripe.useMutation({
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const ready = status.data?.chargesEnabled && status.data?.payoutsEnabled;
  return (
    <Section title="Payments & payouts">
      <Panel>
        <div className="v3-inline">
          <CreditCard />
          <h2>{ready ? "Your payments are ready" : "Set up payments"}</h2>
        </div>
        <Feedback
          loading={status.isLoading}
          error={status.error}
          onRetry={() => status.refetch()}
        />
        {!status.isLoading && !status.error && (
          <p>
            {ready
              ? "Your account can accept payments and send payouts."
              : "Complete your business verification with Stripe to accept payments."}
          </p>
        )}
        {!ready && (
          <Action
            disabled={connect.isPending || status.isLoading}
            onClick={() => connect.mutate()}
          >
            {connect.isPending
              ? "Opening Stripe…"
              : status.data?.connected
                ? "Resume Stripe setup"
                : "Connect Stripe"}
          </Action>
        )}
        {connect.error && <p role="alert">{connect.error.message}</p>}
        <Action tone="quiet" onClick={() => status.refetch()}>
          Check payment status
        </Action>
      </Panel>
    </Section>
  );
}
