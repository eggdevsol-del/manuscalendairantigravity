import { DetailsSheet } from "../components/DetailsSheet";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { ShoppingBag } from "lucide-react";
import { countsStock, type StoreProduct } from "../design/supplyStore";
import {
  ProductSheet,
  StoreByline,
  StoreShelves,
  TrayPill,
  WeekStage,
  useChairWeek,
} from "../components/SupplyStore";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  SearchField,
  Status,
  Tabs,
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
  const { user } = useAuth();
  const supplier = slug.startsWith("supplier-");
  return query.data ? (
    <CartProvider key={query.data.artistId} storeId={query.data.artistId}>
      <StoreContent slug={slug} store={query.data} />
    </CartProvider>
  ) : (
    <Screen
      publicView={!user}
      title={supplier ? "Supplier store" : "Shop"}
      back={supplier && user?.role === "artist" ? "/supplies" : undefined}
      action={user ? undefined : <ActionLink href="/login">Sign in</ActionLink>}
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
  if (slug.startsWith("supplier-")) return <SupplierShop store={store} slug={slug} />;
  return <ArtistShop store={store} slug={slug} />;
}
/** A supplier's own store, laid out like the supplier catalogues: shelves, the product sheet and the tray. */
function SupplierShop({ store, slug }: { store: Store; slug: string }) {
  const cart = useCart();
  const { user } = useAuth();
  const week = useChairWeek();
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const currency = store.currency || "AUD";
  // Products sold without options become one option with id 0, the cart's "base" line.
  const products: StoreProduct[] = store.products.map(p => ({
    id: p.id,
    title: p.title.trim(),
    category: p.category,
    imageUrl: p.imageUrl,
    variants: p.variants.length
      ? [...p.variants]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map(v => ({
            id: v.id,
            name: v.name,
            priceCents: v.priceCents,
            stock: v.inventoryCount,
          }))
      : [{ id: 0, name: "", priceCents: p.priceCents, stock: p.inventoryCount }],
  }));
  const counts = countsStock(products);
  const held = (productId: number, variantId: number) =>
    cart.items.find(i => i.cartItemId === `${productId}-${variantId || "base"}`)
      ?.quantity || 0;
  const source = selected && store.products.find(p => p.id === selected.id);
  return (
    <Screen
      publicView={!user}
      title={store.artistName}
      subtitle={
        <StoreByline
          name={store.artistName}
          detail={`${products.length} products · Prices in ${currency}`}
        />
      }
      back={user?.role === "artist" ? "/supplies" : undefined}
      className="iosm-ss"
      action={
        <Action
          tone="quiet"
          aria-label={`Your tray, ${cart.totalItems} items`}
          onClick={() => cart.setIsCartOpen(true)}
        >
          <ShoppingBag size={20} />
          {cart.totalItems}
        </Action>
      }
    >
      {week && <WeekStage week={week} />}
      <StoreShelves
        products={products}
        currency={currency}
        storeName={store.artistName}
        counts={counts}
        onOpen={setSelected}
      />
      <p className="v3-muted ivory-shop-fee-note">
        Product prices exclude delivery and the platform fee. Both are shown in
        your tray before payment.
      </p>
      <TrayPill
        lines={cart.items.map(item => ({
          key: item.cartItemId,
          seed: item.productId,
          imageUrl: item.imageUrl,
        }))}
        count={cart.totalItems}
        subtotal={cart.subtotalCents}
        currency={currency}
        note="Before delivery and fees"
        onOpen={() => cart.setIsCartOpen(true)}
      />
      {selected && source && (
        <ProductSheet
          key={selected.id}
          product={selected}
          sub={[
            store.artistName,
            source.fulfillmentType === "both"
              ? "Delivery or pickup"
              : source.fulfillmentType === "digital"
                ? "Digital delivery"
                : source.fulfillmentType === "delivery"
                  ? "Delivery"
                  : "Pickup",
          ].join(" · ")}
          currency={currency}
          counts={counts}
          limit={100}
          about={
            source.description && (
              <DetailsSheet title={<> About this product </>}>
                <p style={{ whiteSpace: "pre-wrap" }}>{source.description}</p>
              </DetailsSheet>
            )
          }
          inTray={variantId => held(source.id, variantId)}
          onAdd={(variant, quantity) => {
            const line = `${source.id}-${variant.id || "base"}`;
            cart.addItem({
              productId: source.id,
              variantId: variant.id || undefined,
              variantName: variant.id ? variant.name : undefined,
              title: source.title,
              priceCents: variant.priceCents,
              shippingCents: source.shippingCents || 0,
              imageUrl: source.imageUrl || null,
              fulfillmentType: source.fulfillmentType,
              maxInventory: Math.min(variant.stock, 100),
              artistId: source.artistId,
            });
            if (quantity > 1) cart.updateQuantity(line, quantity - 1);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      <StorefrontCheckoutFAB
        artistId={store.artistId}
        artistSlug={slug}
        currency={currency}
        onClose={() => {}}
      />
    </Screen>
  );
}
function ArtistShop({ store, slug }: { store: Store; slug: string }) {
  const [search, setSearch] = useState("");
  const cart = useCart();
  const [filter, setFilter] = useState<"All products" | "In stock">(
    "All products"
  );
  const [selected, setSelected] = useState<Store["products"][number] | null>(
    null
  );
  const currency = store.currency || "AUD";
  const products = store.products.filter(
    product =>
      (filter === "All products" ||
        (product.variants.length
          ? product.variants.some(v => v.inventoryCount > 0)
          : product.inventoryCount > 0)) &&
      `${product.title} ${product.description || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  return (
    <Screen
      publicView
      wide
      title="Shopfront"
      subtitle={store.artistName}
      subheader={
        <Tabs
          items={["All products", "In stock"] as const}
          value={filter}
          onChange={setFilter}
          label="Shop products"
        />
      }
      back={`/${encodeURIComponent(slug)}`}
      action={
        <Action tone="secondary" onClick={() => cart.setIsCartOpen(true)}>
          Cart · {cart.totalItems}
        </Action>
      }
    >
      <section className="ivory-shop-intro">
        <span className="v3-eyebrow">Selected by {store.artistName}</span>
        <h2>
          A little of the studio.
          <br />
          Yours to keep.
        </h2>
        <p>
          Original work, everyday essentials and care for your next chapter.
        </p>
      </section>
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
          <button
            key={product.id}
            type="button"
            className="ivory-shop-product"
            onClick={() => setSelected(product)}
            aria-label={`View ${product.title}`}
          >
            <div className="ivory-shop-product-image">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" loading="lazy" />
              ) : (
                <span aria-hidden="true">tattoi</span>
              )}
            </div>
            <span className="ivory-shop-product-name">{product.title}</span>
            <span className="v3-muted">
              {product.variants.length > 1 ? "From " : ""}
              {money(
                product.variants.length
                  ? Math.min(...product.variants.map(v => v.priceCents))
                  : product.priceCents,
                currency
              )}
            </span>
            {(product.variants.length
              ? product.variants.every(v => v.inventoryCount <= 0)
              : product.inventoryCount <= 0) && <Status>Sold out</Status>}
          </button>
        ))}
      </div>
      <p className="v3-muted ivory-shop-fee-note">
        Product prices exclude delivery and the platform fee. Both are shown in
        your cart before payment.
      </p>
      <SheetShell
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || "Product details"}
      >
        {selected && (
          <Product
            key={selected.id}
            product={selected}
            currency={currency}
            onAdded={() => setSelected(null)}
          />
        )}
      </SheetShell>
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
  onAdded,
}: {
  product: Store["products"][number];
  currency: string;
  onAdded: () => void;
}) {
  const { items, addItem } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const variant =
    product.variants.find(item => item.id === variantId) || product.variants[0];
  const price = variant?.priceCents ?? product.priceCents;
  const inventory = Math.min(
    variant?.inventoryCount ?? product.inventoryCount,
    100
  );
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
        <DetailsSheet title={<> About this product </>}>
          <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
        </DetailsSheet>
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
          onClick={() => {
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
            });
            onAdded();
          }}
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
