import { ReorderRecommendations } from "../components/ReorderRecommendations";
import { createPortal } from "react-dom";
import { ShoppingBag } from "lucide-react";
import { HomeTabs } from "../design/HomeTabs";
import { useEffect, useState, useRef } from "react";
import { Link, useSearch } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
} from "../design/primitives";
type Product =
  inferRouterOutputs<AppRouter>["suppliers"]["getSupplierProducts"][number];
type Item = {
  productId: number;
  variantId: number;
  title: string;
  variant: string;
  quantity: number;
  price: number;
  stock: number;
};
export default function Supplies() {
  const id = Number(new URLSearchParams(useSearch()).get("supplier"));
  if (Number.isInteger(id) && id > 0) return <Catalogue key={id} id={id} />;
  return <Directory />;
}
function Directory() {
  const { user } = useAuth();
  const query = trpc.suppliers.getSuppliers.useQuery();
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("");
  const add = trpc.suppliers.scrapeShopifyStore.useMutation({
    onSuccess: () => {
      setUrl("");
      void query.refetch();
    },
  });
  const items = query.data?.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Screen
      title="Supplies"
      subtitle="Find what you need for the next session."
      subheader={<HomeTabs />}
      back="/dashboard"
    >
      {query.data?.map(supplier => {
        let count = 0;
        try {
          count = Object.values(
            JSON.parse(
              sessionStorage.getItem(
                `tattoi-supply-basket:${user?.id}:${supplier.id}`
              ) || "{}"
            )
          ).reduce<number>(
            (sum, value) =>
              sum +
              (typeof value === "number" && Number.isInteger(value) && value > 0
                ? value
                : 0),
            0
          );
        } catch {}
        return count > 0 ? (
          <Row
            key={`cart-${supplier.id}`}
            title={`${supplier.name} cart`}
            detail={`${count} items · Review current prices and availability`}
            icon={<ShoppingBag />}
            href={`/supplies?supplier=${supplier.id}&cart=1`}
          />
        ) : null;
      })}
      <ActionLink href="/supply-orders">Your supply orders</ActionLink>
      <SearchField
        value={search}
        onChange={setSearch}
        label="Search suppliers"
      />
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {!query.isLoading && !query.error && !items?.length && (
        <Panel>
          <p>No suppliers match your search.</p>
        </Panel>
      )}
      {items?.map(item => (
        <Row
          key={item.id}
          title={item.name}
          detail={item.currency || "AUD"}
          icon={<Avatar name={item.name} src={item.logoUrl} />}
          href={item.merchantId ? `/shop/supplier-${item.merchantId}` : `/supplies?supplier=${item.id}`}
        />
      ))}
      <ReorderRecommendations showUpcoming />
      {user?.role === "admin" && (
        <Section title="Import a supplier catalogue">
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              add.mutate({ storeUrl: url });
            }}
          >
            <label>
              Store URL
              <input
                type="url"
                required
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={add.isPending}
              />
            </label>
            {add.error && <p role="alert">{add.error.message}</p>}
            <Action type="submit" disabled={add.isPending}>
              {add.isPending ? "Importing…" : "Import catalogue"}
            </Action>
          </form>
        </Section>
      )}
    </Screen>
  );
}
function Catalogue({ id }: { id: number }) {
  const supplier = trpc.suppliers.getSupplier.useQuery({ id });
  const query = trpc.suppliers.getSupplierProducts.useQuery({ supplierId: id });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const { user } = useAuth();
  const basketKey = `tattoi-supply-basket:${user?.id}:${id}`;
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [restoredKey, setRestoredKey] = useState("");
  const [stockAdjusted, setStockAdjusted] = useState(false);
  useEffect(() => {
    if (!user) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(basketKey) || "{}");
      setQuantities(
        Object.fromEntries(
          Object.entries(saved).filter(
            ([key, value]) =>
              Number.isInteger(Number(key)) &&
              Number(key) > 0 &&
              typeof value === "number" &&
              Number.isInteger(value) &&
              value > 0
          )
        ) as Record<number, number>
      );
    } catch {
      setQuantities({});
    }
    setRestoredKey(basketKey);
  }, [basketKey, user?.id]);
  useEffect(() => {
    if (restoredKey !== basketKey) return;
    try {
      sessionStorage.setItem(basketKey, JSON.stringify(quantities));
    } catch {
      /* Cart remains usable when storage is unavailable. */
    }
  }, [basketKey, restoredKey, quantities]);
  // Only identifiers and quantities are retained. Current catalogue data supplies prices and stock.
  const cart: Item[] = (restoredKey === basketKey ? query.data || [] : []).flatMap(product =>
    product.variants.flatMap(v =>
      quantities[v.id] > 0 && v.inventoryCount > 0
        ? [
            {
              productId: product.id,
              variantId: v.id,
              title: product.title,
              variant: v.title,
              price: v.priceCents,
              stock: v.inventoryCount,
              quantity: Math.min(quantities[v.id], v.inventoryCount),
            },
          ]
        : []
    )
  );
  useEffect(() => {
    if (!query.data || restoredKey !== basketKey) return;
    const next = Object.fromEntries(cart.map(item => [item.variantId, item.quantity]));
    if (Object.keys(next).length !== Object.keys(quantities).length || Object.entries(next).some(([id, qty]) => quantities[Number(id)] !== qty)) {
      setStockAdjusted(true);
      setQuantities(next);
    }
  }, [query.data, quantities, restoredKey, basketKey]);
  const setCart = (update: Item[] | ((current: Item[]) => Item[])) => {
    const next = typeof update === "function" ? update(cart) : update;
    setQuantities(
      Object.fromEntries(next.map(item => [item.variantId, item.quantity]))
    );
  };
  const reorderId = Number(new URLSearchParams(useSearch()).get("reorder"));
  const orders = trpc.supplierOrders.getSupplierOrders.useQuery(undefined, {
    enabled: reorderId > 0,
  });
  const reordered = useRef(false);
  const [reorderNote, setReorderNote] = useState("");
  useEffect(() => {
    if (
      reordered.current ||
      !query.data ||
      !orders.data ||
      restoredKey !== basketKey
    )
      return;
    const order = orders.data.find(
      o => o.id === reorderId && o.supplierId === id && o.status === "paid"
    );
    if (!order) return;
    reordered.current = true;
    const next = { ...quantities };
    for (const item of order.items) {
      const variant = query.data
        .find(p => p.id === item.supplierProductId)
        ?.variants.find(v => v.id === item.variantId);
      if (variant && variant.inventoryCount > 0)
        next[variant.id] = Math.min(
          Math.max(next[variant.id] || 0, item.quantity),
          variant.inventoryCount
        );
    }
    setQuantities(next);
    setReorderNote(
      "Previous items added where available. Quantities are limited to current stock; review current prices before payment."
    );
    setCheckout(true);
  }, [orders.data, query.data, restoredKey, basketKey, reorderId, id]);
  const [checkout, setCheckout] = useState(
    new URLSearchParams(window.location.search).get("cart") === "1"
  );
  const currency = supplier.data?.currency || "AUD";
  const categories = Array.from(
    new Set(
      query.data?.map(p => p.category).filter((s): s is string => !!s) || []
    )
  );
  const products = query.data?.filter(
    p =>
      p.title.toLowerCase().includes(search.toLowerCase()) &&
      (!category || p.category === category) &&
      (!stockOnly || p.variants.some(v => v.inventoryCount > 0))
  );
  return (
    <Screen
      title={supplier.data?.name || "Supplier catalogue"}
      subtitle="Choose a product and variant. Checkout confirms availability."
      back="/supplies"
      wide
      className="supplier-catalogue"
      action={
        <Action
          tone="quiet"
          aria-label={`Cart, ${cart.reduce((n, item) => n + item.quantity, 0)} items`}
          onClick={() => setCheckout(true)}
        >
          <ShoppingBag size={20} />
          {cart.reduce((n, item) => n + item.quantity, 0)}
        </Action>
      }
    >
      <Feedback
        loading={supplier.isLoading || query.isLoading}
        error={supplier.error || query.error}
        onRetry={() => {
          void supplier.refetch();
          void query.refetch();
        }}
      />
      <SearchField
        value={search}
        onChange={setSearch}
        label="Search products"
      />
      <div className="v3-form">
        <label>
          Category
          <select
            aria-label="Category"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">All products</option>
            {categories.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="v3-check-list">
          <label>
            <input
              type="checkbox"
              checked={stockOnly}
              onChange={e => setStockOnly(e.target.checked)}
            />
            In stock only
          </label>
        </div>
      </div>
      {stockAdjusted && <p role="status">Some saved items are unavailable or quantities have been reduced to current stock. Review your cart before payment.</p>}
      {reorderNote && <p role="status">{reorderNote}</p>}
      {!!cart.length && createPortal(
        <div className="supplier-cart-dock">
          <Action onClick={() => setCheckout(true)}>
            <ShoppingBag size={20} /> Cart ·{" "}
            {cart.reduce((n, item) => n + item.quantity, 0)} items ·{" "}
            {money(
              cart.reduce((n, item) => n + item.price * item.quantity, 0),
              currency
            )}
          </Action>
          <small>Before shipping and checkout fees</small>
        </div>, document.body
      )}
      {!query.isLoading && !query.error && !products?.length && (
        <Panel>
          <p>No products match these filters.</p>
        </Panel>
      )}
      <div className="v3-shop-grid supplier-product-grid">
        {products?.map(product => (
          <CatalogueProduct
            key={product.id}
            product={product}
            currency={currency}
            quantities={cart}
            onAdd={item =>
              setCart(current => {
                const present = current.find(
                  i => i.variantId === item.variantId
                );
                return present
                  ? current.map(i =>
                      i.variantId === item.variantId
                        ? {
                            ...i,
                            quantity: Math.min(i.quantity + item.quantity, item.stock),
                          }
                        : i
                    )
                  : [...current, item];
              })
            }
          />
        ))}
      </div>
      {checkout && supplier.data && (
        <SupplyCheckout
          supplierId={id}
          supplierName={supplier.data.name}
          currency={currency}
          items={cart}
          onQuantity={(id, quantity) =>
            setCart(current =>
              quantity === 0
                ? current.filter(item => item.variantId !== id)
                : current.map(item =>
                    item.variantId === id
                      ? { ...item, quantity: Math.min(quantity, item.stock) }
                      : item
                  )
            )
          }
          onClose={() => setCheckout(false)}
          onConfirmed={() => setCart([])}
          onPaid={() => {
            setCart([]);
            setCheckout(false);
          }}
        />
      )}
    </Screen>
  );
}
function CatalogueProduct({
  product,
  currency,
  quantities,
  onAdd,
}: {
  product: Product;
  currency: string;
  quantities: Item[];
  onAdd: (item: Item) => void;
}) {
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find(v => v.id === variantId);
  const count =
    quantities.find(item => item.variantId === variantId)?.quantity || 0;
  return (
    <>
      <button
        className="supplier-product-card"
        data-tour-repeat="supplier-product"
        data-tour-title="Choose supplies"
        data-tour-description="Open a product to choose the correct variant and check stock. Your cart keeps selected quantities while you browse; checkout verifies current prices, shipping and platform fees before payment."
        aria-label={`View ${product.title}`}
        onClick={() => setOpen(true)}
      >
        {product.imageUrl ? (
          <img
            className="v3-shop-image"
            src={product.imageUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="v3-shop-image supplier-image-placeholder">
            <ShoppingBag />
          </div>
        )}
        <strong>{product.title}</strong>
        <span>
          {variant ? money(variant.priceCents, currency) : "Unavailable"}{" "}
          {currency}
        </span>
        <small>
          {product.variants.some(v => v.inventoryCount > 0)
            ? "In stock"
            : "Out of stock"}
        </small>
      </button>
      <SheetShell
        isOpen={open}
        onClose={() => setOpen(false)}
        title={product.title}
      >
        {open && (
          <div className="v3-stack">
            {product.imageUrl && (
              <img
                className="v3-shop-image"
                src={product.imageUrl}
                alt={product.title}
              />
            )}
            <div className="v3-form">
              <label>
                Variant
                <select
                  aria-label={`${product.title} variant`}
                  value={variantId || ""}
                  onChange={e => { setVariantId(Number(e.target.value)); setQuantity(1); }}
                >
                  {product.variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                      {v.inventoryCount <= 0 ? " · Out of stock" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {variant && (
              <p>
                {money(variant.priceCents, currency)} {currency} ·{" "}
                {variant.inventoryCount > 0 ? "In stock" : "Out of stock"}
              </p>
            )}
            <div className="v3-inline supplier-quantity" role="group" aria-label="Quantity">
              <Action tone="secondary" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</Action>
              <label>Quantity <input aria-label="Quantity" type="number" inputMode="numeric" min={1} max={Math.max(1, (variant?.inventoryCount || 0) - count)} value={quantity} style={{width:"4rem",textAlign:"center"}} onChange={e => setQuantity(Math.max(1, Math.min(Math.floor(Number(e.target.value)) || 1, Math.max(1, (variant?.inventoryCount || 0)-count))))} /></label>
              <Action tone="secondary" aria-label="Increase quantity" disabled={!variant || quantity >= variant.inventoryCount-count} onClick={() => setQuantity(q => Math.min(q+1, (variant?.inventoryCount || 0)-count))}>+</Action>
            </div>
            {count > 0 && <p className="v3-muted">{count} already in your cart</p>}
            <Action
              disabled={!variant || count >= variant.inventoryCount || quantity > variant.inventoryCount-count}
              onClick={() => {
                if (!variant) return;
                onAdd({
                  productId: product.id,
                  variantId: variant.id,
                  title: product.title,
                  variant: variant.title,
                  price: variant.priceCents,
                  stock: variant.inventoryCount,
                  quantity,

                });
                setQuantity(1);
                setOpen(false);
              }}
            >
              {!variant || variant.inventoryCount <= 0
                ? "Out of stock"
                : count >= variant.inventoryCount
                  ? "All available stock added"
                  : "Add to cart"}
            </Action>
          </div>
        )}
      </SheetShell>
    </>
  );
}

function SupplyCheckout({
  supplierId,
  supplierName,
  currency,
  items,
  onQuantity,
  onClose,
  onPaid,
  onConfirmed,
}: {
  supplierId: number;
  supplierName: string;
  currency: string;
  items: Item[];
  onQuantity: (id: number, quantity: number) => void;
  onClose: () => void;
  onPaid: () => void;
  onConfirmed: () => void;
}) {
  const [step, setStep] = useState<
    "cart" | "review" | "payment" | "confirming"
  >("cart");
  const rates = trpc.supplierOrders.getShippingRates.useQuery({ supplierId });
  const [shipping, setShipping] = useState("");
  const create = trpc.supplierOrders.createSupplierCheckout.useMutation({
    onSuccess: () => setStep("review"),
  });
  const [timedOut, setTimedOut] = useState(false);
  const confirmation = trpc.supplierOrders.getSupplierOrderStatus.useQuery(
    { orderId: create.data?.orderId || 0 },
    {
      enabled: step === "confirming" && !!create.data,
      refetchInterval: step === "confirming" && !timedOut ? 2000 : false,
    }
  );
  const utils = trpc.useUtils();
  const cleared = useRef(false);
  useEffect(() => {
    if (step !== "confirming") return;
    const timeout = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timeout);
  }, [step]);
  useEffect(() => {
    if (confirmation.data?.success && !cleared.current) {
      cleared.current = true;
      onConfirmed();
      void utils.supplierOrders.getSupplierOrders.invalidate();
      void utils.suppliers.invalidate();
    }
  }, [confirmation.data?.success, utils, onConfirmed]);
  const data = create.data;
  const localSubtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const eligible =
    rates.data?.rates.filter(
      rate =>
        (rate.minOrderSubtotalCents === null ||
          localSubtotal >= rate.minOrderSubtotalCents) &&
        (rate.maxOrderSubtotalCents === null ||
          localSubtotal <= rate.maxOrderSubtotalCents)
    ) || [];
  return (
    <SheetShell
      isOpen
      title={
        confirmation.data?.success
          ? "Payment confirmed"
          : step === "confirming"
            ? "Confirming your order"
            : `Order from ${supplierName}`
      }
      onClose={() => {
        if (!create.isPending)
          confirmation.data?.success ? onPaid() : onClose();
      }}
    >
      <div className="v3-stack">
        {confirmation.data?.success ? (
          <Panel>
            <Status tone="success">Paid</Status>
            <h2>Order #{data?.orderId}</h2>
            <p>
              Your payment is confirmed. Supplier handoff is being processed.
              Shipping confirmation comes from the supplier.
            </p>
            <Link
              className="v3-action v3-action-secondary"
              href="/supply-orders"
              onClick={onPaid}
            >
              View order status
            </Link>
            <Action onClick={onPaid}>Done</Action>
          </Panel>
        ) : step === "confirming" ? (
          <Panel>
            <p role="status">
              Payment was submitted. Please don’t pay again. You can check this
              order in Supply orders.
            </p>
            <Feedback
              error={confirmation.error}
              onRetry={() => confirmation.refetch()}
            />
            <Action tone="secondary" onClick={() => confirmation.refetch()}>
              Check confirmation
            </Action>
            <ActionLink href="/supply-orders">Your supply orders</ActionLink>
          </Panel>
        ) : step === "payment" && data ? (
          <DotsCheckout
            clientSecret={data.clientSecret}
            amountCents={data.totalCents}
            onBack={() => setStep("review")}
            onComplete={() => {
              setStep("confirming");
              setTimedOut(false);
            }}
          />
        ) : step === "review" && data ? (
          <>
            <Panel>
              <dl className="v3-facts">
                <div>
                  <dt>Products</dt>
                  <dd>{money(data.subtotalCents, data.currency)}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>{money(data.shippingCents, data.currency)}</dd>
                </div>
                <div>
                  <dt>Platform fee</dt>
                  <dd>{money(data.platformFeeCents, data.currency)}</dd>
                </div>
                <div>
                  <dt>Total due</dt>
                  <dd>
                    <strong>
                      {money(data.totalCents, data.currency)}{" "}
                      {data.currency.toUpperCase()}
                    </strong>
                  </dd>
                </div>
              </dl>
            </Panel>
            {data.supplierCurrency.toUpperCase() !==
              data.currency.toUpperCase() && (
              <p className="v3-muted">
                Converted from {data.supplierCurrency.toUpperCase()} at the
                checkout rate of {data.exchangeRate}.
              </p>
            )}
            <Action onClick={() => setStep("payment")}>
              Continue to secure checkout
            </Action>
            <Action tone="secondary" onClick={() => setStep("cart")}>
              Edit order
            </Action>
          </>
        ) : (
          <>
            {items.map(item => (
              <Panel key={item.variantId}>
                <Row
                  title={item.title}
                  detail={item.variant}
                  trailing={
                    <strong>
                      {money(item.price * item.quantity, currency)}
                    </strong>
                  }
                />
                <div className="v3-inline supplier-quantity">
                  <Action
                    tone="secondary"
                    aria-label={`Remove one ${item.title}`}
                    disabled={create.isPending}
                    onClick={() =>
                      onQuantity(item.variantId, item.quantity - 1)
                    }
                  >
                    −
                  </Action>
                  <span>{item.quantity}</span>
                  <Action
                    tone="secondary"
                    aria-label={`Add one ${item.title}`}
                    disabled={create.isPending || item.quantity >= item.stock}
                    onClick={() =>
                      onQuantity(item.variantId, item.quantity + 1)
                    }
                  >
                    +
                  </Action>
                </div>
              </Panel>
            ))}
            {!items.length && <p>Your order is empty.</p>}
            <Feedback
              loading={rates.isLoading}
              error={rates.error}
              onRetry={() => rates.refetch()}
            />
            {!!eligible.length && (
              <div className="v3-form">
                <label>
                  Shipping
                  <select
                    aria-label="Shipping"
                    disabled={create.isPending}
                    value={shipping || eligible[0].name}
                    onChange={e => setShipping(e.target.value)}
                  >
                    {eligible.map(rate => (
                      <option key={rate.name} value={rate.name}>
                        {rate.name} · {money(rate.priceCents, rate.currency)}{" "}
                        {rate.currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <p className="v3-muted">
              Review the final shipping, currency and fees before payment.
            </p>
            {create.error && <p role="alert">{create.error.message}</p>}
            <Action
              disabled={
                !items.length ||
                create.isPending ||
                rates.isLoading ||
                rates.isError
              }
              onClick={() =>
                create.mutate({
                  supplierId,
                  items: items.map(({ productId, variantId, quantity }) => ({
                    productId,
                    variantId,
                    quantity,
                  })),
                  shippingRateName: shipping || eligible[0]?.name,
                })
              }
            >
              {create.isPending
                ? "Checking availability…"
                : "Review checkout total"}
            </Action>
          </>
        )}
      </div>
    </SheetShell>
  );
}
