import { useState } from "react";
import { useRoute } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { CartProvider, useCart } from "@/features/storefront/CartContext";
import { StorefrontCheckoutFAB } from "@/features/storefront/StorefrontCheckoutFAB";
import {
  OrderConfirmation,
  returnedOrder,
  type OrderIdentity,
} from "@/features/storefront/OrderConfirmation";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  SearchField,
  Status,
} from "../design/primitives";
type Store = NonNullable<
  inferRouterOutputs<AppRouter>["storefront"]["getArtistStorefront"]
>;

export function PublicStorefront() {
  const [, params] = useRoute("/shop/:slug");
  const slug = params?.slug || "";
  const query = trpc.storefront.getArtistStorefront.useQuery(
    { slug },
    { enabled: !!slug, retry: false }
  );
  return query.data ? (
    <CartProvider key={query.data.artistId} storeId={query.data.artistId}>
      <StoreContent slug={slug} store={query.data} />
    </CartProvider>
  ) : (
    <Screen
      publicView
      title="Shop"
      action={<ActionLink href="/login">Sign in</ActionLink>}
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {!query.isLoading && !query.error && (
        <Feedback empty="This store isn’t available. Check the link with the seller." />
      )}
    </Screen>
  );
}
function StoreContent({ store, slug }: { store: Store; slug: string }) {
  const [search, setSearch] = useState("");
  const cart = useCart();
  const currency = store.currency || "AUD";
  const products = store.products.filter(product =>
    `${product.title} ${product.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <Screen
      publicView
      wide
      title={store.artistName}
      subtitle="Shop essentials, aftercare and original work."
      back={
        slug.startsWith("supplier-")
          ? undefined
          : `/${encodeURIComponent(slug)}`
      }
      action={
        <Action tone="secondary" onClick={() => cart.setIsCartOpen(true)}>
          Cart · {cart.totalItems}
        </Action>
      }
    >
      <SearchField
        value={search}
        onChange={setSearch}
        label="Search this store"
      />
      {!products.length && (
        <Feedback
          empty={
            search
              ? "No products match your search."
              : "There are no products available right now."
          }
        />
      )}
      <div className="v3-shop-grid">
        {products.map(product => (
          <Product key={product.id} product={product} currency={currency} />
        ))}
      </div>
      <StorefrontCheckoutFAB
        artistId={store.artistId}
        artistSlug={slug}
        currency={currency}
        onClose={() => {}}
      />
    </Screen>
  );
}
function Product({
  product,
  currency,
}: {
  product: Store["products"][number];
  currency: string;
}) {
  const { items, addItem } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const variant =
    product.variants.find(item => item.id === variantId) || product.variants[0];
  const price = variant?.priceCents ?? product.priceCents;
  const inventory = variant?.inventoryCount ?? product.inventoryCount;
  const quantity =
    items.find(
      item => item.productId === product.id && item.variantId === variant?.id
    )?.quantity || 0;
  return (
    <Panel>
      {product.imageUrl && (
        <img
          className="v3-shop-image"
          src={product.imageUrl}
          alt={product.title}
          loading="lazy"
        />
      )}
      <h2>{product.title}</h2>
      {product.description && (
        <details>
          <summary>About this product</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
        </details>
      )}
      <p className="v3-muted">
        {product.fulfillmentType === "both"
          ? "Delivery or pickup"
          : product.fulfillmentType === "digital"
            ? "Digital delivery"
            : product.fulfillmentType === "delivery"
              ? "Delivery"
              : "Studio pickup"}
      </p>
      {!!product.variants.length && (
        <div className="v3-form">
          <label>
            Option
            <select
              aria-label={`${product.title} option`}
              value={variant?.id}
              onChange={e => setVariantId(Number(e.target.value))}
            >
              {product.variants.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name} · {money(option.priceCents, currency)}
                  {option.inventoryCount <= 0 ? " · Sold out" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="v3-inline">
        <strong>
          {money(price, currency)} {currency}
        </strong>
        <Action
          disabled={inventory <= quantity}
          onClick={() =>
            addItem({
              productId: product.id,
              variantId: variant?.id,
              variantName: variant?.name,
              title: product.title,
              priceCents: price,
              shippingCents: product.shippingCents || 0,
              imageUrl: product.imageUrl || null,
              fulfillmentType: product.fulfillmentType,
              maxInventory: inventory,
              artistId: product.artistId,
            })
          }
        >
          {inventory <= 0
            ? "Sold out"
            : inventory <= quantity
              ? "All available stock in cart"
              : "Add to cart"}
        </Action>
      </div>
    </Panel>
  );
}

export function PublicEvents() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug || "";
  const query = trpc.storefront.getPublicSeminars.useQuery(
    { slug },
    { enabled: !!slug, retry: false }
  );
  const checkout = trpc.storefront.createSeminarCheckout.useMutation();
  const [identity, setIdentity] = useState<OrderIdentity | null>(returnedOrder);
  const [secret, setSecret] = useState<string | null>(null);
  const [open, setOpen] = useState(!!identity);
  const [confirming, setConfirming] = useState(!!identity);
  const [total, setTotal] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const cancel = trpc.storefront.cancelStoreCheckout.useMutation();
  async function register(seminarId: number) {
    if (checkout.isPending || cancel.isPending) return;
    if (identity && (selectedEvent === seminarId || confirming)) {
      setOpen(true);
      return;
    }
    try {
      if (identity) {
        const result = await cancel.mutateAsync(identity);
        if (!result.cancelled) {
          setConfirming(true);
          setOpen(true);
          return;
        }
        setIdentity(null);
        setSecret(null);
      }
      const result = await checkout.mutateAsync({ seminarId });
      setSelectedEvent(seminarId);
      setIdentity({ orderId: result.orderId, sessionId: result.sessionId });
      setTotal(result.totalCents);
      if (result.clientSecret) {
        setSecret(result.clientSecret);
        setConfirming(false);
        setOpen(true);
      } else if (result.url) window.location.assign(result.url);
    } catch {}
  }
  return (
    <Screen
      publicView
      title="Events & workshops"
      subtitle="Learn from your artist, in person or online."
      back={`/${encodeURIComponent(slug)}`}
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {!query.isLoading && !query.error && !query.data?.length && (
        <Feedback empty="There are no upcoming events at the moment." />
      )}
      {(checkout.error || cancel.error) && (
        <p role="alert">{(checkout.error || cancel.error)?.message}</p>
      )}
      {identity && (
        <Action tone="secondary" onClick={() => setOpen(true)}>
          {confirming ? "View registration status" : "Resume registration"}
        </Action>
      )}
      {query.data?.map(event => (
        <Panel key={event.id}>
          <Status>
            {event.type === "virtual" ? "Online event" : "In person"}
          </Status>
          <h2>{event.title}</h2>
          <p>{bookingDate(event.date)}</p>
          {event.type === "in_person" && event.locationUrl && (
            <p>{event.locationUrl}</p>
          )}
          <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>
          <p>{money(event.priceCents)} AUD · platform fee shown at checkout</p>
          <Action
            disabled={
              checkout.isPending ||
              cancel.isPending ||
              (event.ticketsSold >= event.capacity &&
                selectedEvent !== event.id)
            }
            onClick={() => register(event.id)}
          >
            {event.ticketsSold >= event.capacity
              ? "Sold out"
              : checkout.isPending && checkout.variables?.seminarId === event.id
                ? "Preparing checkout…"
                : "Review registration"}
          </Action>
        </Panel>
      ))}
      <SheetShell
        isOpen={open}
        title={confirming ? "Registration status" : "Event registration"}
        onClose={() => setOpen(false)}
      >
        {confirming && identity ? (
          <OrderConfirmation identity={identity} />
        ) : (
          secret && (
            <DotsCheckout
              clientSecret={secret}
              amountCents={total}
              onComplete={() => setConfirming(true)}
              onBack={() => setOpen(false)}
            />
          )
        )}
      </SheetShell>
    </Screen>
  );
}
