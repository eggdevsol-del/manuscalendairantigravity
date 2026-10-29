import { usePractice } from "@/features/practice/PracticeContext";
import { ReorderRecommendations } from "../components/ReorderRecommendations";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, Redirect, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { money } from "@/features/workspace/bookingPresentation";
import { LiveStage, StageNumber } from "../design/live";
import {
  countsStock,
  freeDelivery,
  fromLastOrder,
  matchOrderItem,
  type StoreProduct,
} from "../design/supplyStore";
import {
  FreeDeliveryBar,
  ProductArt,
  ProductSheet,
  StoreByline,
  StoreShelves,
  Suggestions,
  TrayPill,
  WeekStage,
  goalNote,
  optionName,
  useChairWeek,
} from "../components/SupplyStore";
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
type Item = {
  productId: number;
  variantId: number;
  title: string;
  variant: string;
  quantity: number;
  price: number;
  stock: number;
  imageUrl?: string | null;
};
export default function Supplies() {
  const id = Number(new URLSearchParams(useSearch()).get("supplier"));
  if (Number.isInteger(id) && id > 0) return <Catalogue key={id} id={id} />;
  return <Directory />;
}
function Directory() {
  const practice = usePractice();
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
  // Supplier-run stores are slow to load, so start loading the first few while the list is open.
  const utils = trpc.useUtils();
  useEffect(() => {
    for (const s of (query.data || []).filter(s => s.merchantId).slice(0, 3))
      void utils.storefront.getArtistStorefront.prefetch({
        slug: `supplier-${s.merchantId}`,
      });
  }, [query.data, utils]);
  // Every saved cart, priced from each supplier's current catalogue, for the tray.
  const baskets = (query.data || [])
    .map(supplier => ({
      supplier,
      quantities: savedBasket(
        practice ? (practice.cart ?? {}) : null,
        `tattoi-supply-basket:${user?.id}:${supplier.id}`
      ),
    }))
    .filter(b => Object.keys(b.quantities).length > 0);
  const catalogues = trpc.useQueries(t =>
    baskets.map(b =>
      t.suppliers.getSupplierProducts({ supplierId: b.supplier.id })
    )
  );
  const lines: Item[] = baskets.flatMap((b, i) =>
    (catalogues[i]?.data || []).flatMap(product =>
      product.variants.flatMap(v =>
        b.quantities[v.id] > 0 && v.inventoryCount > 0
          ? [
              {
                productId: product.id,
                variantId: v.id,
                title: product.title,
                variant: v.title,
                price: v.priceCents,
                stock: v.inventoryCount,
                quantity: Math.min(b.quantities[v.id], v.inventoryCount),
                imageUrl: product.imageUrl,
              },
            ]
          : []
      )
    )
  );
  const currencies = [
    ...new Set(baskets.map(b => b.supplier.currency || "AUD")),
  ];
  return (
    <Screen
      title="Supplies"
      subtitle="Find what you need for the next session."
      back="/dashboard"
    >
      {query.data && (
        <SupplyTray
          items={lines}
          currency={currencies.length > 1 ? null : currencies[0] || "AUD"}
        />
      )}
      {baskets.map(({ supplier, quantities }) => {
        const count = Object.values(quantities).reduce((sum, n) => sum + n, 0);
        return (
          <Row
            key={`cart-${supplier.id}`}
            title={`${supplier.name} cart`}
            detail={`${count} items · Review current prices and availability`}
            icon={<ShoppingBag />}
            href={`/supplies?supplier=${supplier.id}&cart=1`}
          />
        );
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
        <Link
          key={item.id}
          className="supplier-directory-card"
          href={
            item.merchantId
              ? `/shop/supplier-${item.merchantId}`
              : `/supplies?supplier=${item.id}`
          }
        >
          {item.logoUrl && (
            <img
              className="supplier-directory-image"
              src={item.logoUrl}
              alt=""
              loading="lazy"
              onError={e => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
          <span className="supplier-directory-copy">
            <strong>{item.name}</strong>
            <span>{item.currency || "AUD"}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
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
  const practice = usePractice();
  const supplier = trpc.suppliers.getSupplier.useQuery({ id });
  const query = trpc.suppliers.getSupplierProducts.useQuery({ supplierId: id });
  const { user } = useAuth();
  const basketKey = `tattoi-supply-basket:${user?.id}:${id}`;
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [restoredKey, setRestoredKey] = useState("");
  const [stockAdjusted, setStockAdjusted] = useState(false);
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  useEffect(() => {
    if (!user) return;
    if (practice) {
      setQuantities(practice.cart ?? {});
      setRestoredKey(basketKey);
      return;
    }
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
    if (practice) {
      if (JSON.stringify(quantities) !== JSON.stringify(practice.cart ?? {}))
        practice.saveCart?.(quantities);
      return;
    }
    try {
      sessionStorage.setItem(basketKey, JSON.stringify(quantities));
    } catch {
      /* Cart remains usable when storage is unavailable. */
    }
  }, [basketKey, restoredKey, quantities]);
  // The catalogue as the store shows it: every option with its current price and stock.
  const products: StoreProduct[] = (query.data || []).map(p => ({
    id: p.id,
    title: p.title.trim(),
    category: p.category,
    imageUrl: p.imageUrl,
    variants: p.variants.map(v => ({
      id: v.id,
      name: v.title,
      priceCents: v.priceCents,
      stock: v.inventoryCount,
    })),
  }));
  const counts = countsStock(products);
  // Only identifiers and quantities are retained. Current catalogue data supplies prices and stock.
  const cart: Item[] = (
    restoredKey === basketKey ? query.data || [] : []
  ).flatMap(product =>
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
              imageUrl: product.imageUrl,
            },
          ]
        : []
    )
  );
  useEffect(() => {
    if (!query.data || restoredKey !== basketKey) return;
    const next = Object.fromEntries(
      cart.map(item => [item.variantId, item.quantity])
    );
    if (
      Object.keys(next).length !== Object.keys(quantities).length ||
      Object.entries(next).some(([id, qty]) => quantities[Number(id)] !== qty)
    ) {
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
  /** Raise each option to at least this quantity, never past its stock. */
  const addAtLeast = (lines: { variantId: number; quantity: number; stock: number }[]) =>
    setQuantities(current => {
      const next = { ...current };
      for (const line of lines)
        next[line.variantId] = Math.min(
          Math.max(next[line.variantId] || 0, line.quantity),
          line.stock
        );
      return next;
    });
  const reorderId = Number(new URLSearchParams(useSearch()).get("reorder"));
  const orders = trpc.supplierOrders.getSupplierOrders.useQuery();
  const rhythm = trpc.supplierOrders.getReorderRecommendations.useQuery();
  const rates = trpc.supplierOrders.getShippingRates.useQuery({ supplierId: id });
  const week = useChairWeek();
  const last = orders.data ? fromLastOrder(orders.data, id, products) : null;
  const usual = rhythm.data?.find(r => r.supplierId === id);
  const reordered = useRef(false);
  const [reorderNote, setReorderNote] = useState("");
  useEffect(() => {
    if (
      !reorderId ||
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
    addAtLeast(
      order.items.flatMap(item => {
        const variant = matchOrderItem(products, item)?.variant;
        return variant && variant.stock > 0
          ? [{ variantId: variant.id, quantity: item.quantity, stock: variant.stock }]
          : [];
      })
    );
    setReorderNote(
      "Previous items added where available. Quantities are limited to current stock; review current prices before payment."
    );
    setCheckout(true);
  }, [orders.data, query.data, restoredKey, basketKey, reorderId, id]);
  const [checkout, setCheckout] = useState(
    new URLSearchParams(window.location.search).get("cart") === "1"
  );
  const currency = supplier.data?.currency || "AUD";
  const count = cart.reduce((n, item) => n + item.quantity, 0);
  const subtotal = cart.reduce((n, item) => n + item.price * item.quantity, 0);
  const goal = rates.data ? freeDelivery(rates.data.rates, subtotal) : null;
  // A supplier that runs its own store sells from there; its catalogue here is empty.
  if (supplier.data?.merchantId)
    return <Redirect to={`/shop/supplier-${supplier.data.merchantId}`} replace />;
  const name = supplier.data?.name || "Supplier";
  return (
    <Screen
      title={supplier.data?.name || "Supplier"}
      subtitle={
        supplier.data && (
          <StoreByline
            name={name}
            logoUrl={supplier.data.logoUrl}
            detail={`${query.data ? `${products.length} products · ` : ""}Prices in ${currency}`}
          />
        )
      }
      back="/supplies"
      className="supplier-catalogue iosm-ss"
      action={
        <Action
          tone="quiet"
          aria-label={`Your tray, ${count} items`}
          onClick={() => setCheckout(true)}
        >
          <ShoppingBag size={20} />
          {count}
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
      {week && (
        <WeekStage week={week}>
          {last &&
            (last.lines.every(l => (quantities[l.variant.id] || 0) >= l.quantity) ? (
              <p className="iosm-ss-done">
                Everything from your last order is in your tray.
              </p>
            ) : (
              <Suggestions
                note={`From your last order on ${new Date(last.order.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}.${
                  usual
                    ? usual.due
                      ? ` You restock about every ${usual.intervalDays} days, so you're due.`
                      : ` You restock about every ${usual.intervalDays} days; next around ${new Date(usual.dueAt).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}.`
                    : ""
                }`}
                lines={last.lines}
                currency={currency}
                onAddAll={() =>
                  addAtLeast(
                    last.lines.map(l => ({
                      variantId: l.variant.id,
                      quantity: l.quantity,
                      stock: l.variant.stock,
                    }))
                  )
                }
              />
            ))}
        </WeekStage>
      )}
      {stockAdjusted && (
        <p role="status">
          Some saved items are unavailable or quantities have been reduced to
          current stock. Review your tray before payment.
        </p>
      )}
      {reorderNote && <p role="status">{reorderNote}</p>}
      {query.data && (
        <StoreShelves
          products={products}
          currency={currency}
          storeName={name}
          counts={counts}
          onOpen={setSelected}
        />
      )}
      <TrayPill
        lines={cart.map(item => ({
          key: item.variantId,
          seed: item.productId,
          imageUrl: item.imageUrl,
        }))}
        count={count}
        subtotal={subtotal}
        currency={currency}
        note={goalNote(goal, currency, "Before delivery and fees")}
        onOpen={() => setCheckout(true)}
      />
      {selected && (
        <ProductSheet
          key={selected.id}
          product={selected}
          sub={[selected.category, name].filter(Boolean).join(" · ")}
          currency={currency}
          counts={counts}
          inTray={variantId => quantities[variantId] || 0}
          onAdd={(variant, quantity) =>
            setQuantities(current => ({
              ...current,
              [variant.id]: Math.min((current[variant.id] || 0) + quantity, variant.stock),
            }))
          }
          onClose={() => setSelected(null)}
        />
      )}
      {checkout && supplier.data && (
        <SupplyCheckout
          supplierId={id}
          supplierName={supplier.data.name}
          currency={currency}
          counts={counts}
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

function SupplyCheckout({
  supplierId,
  supplierName,
  currency,
  counts,
  items,
  onQuantity,
  onClose,
  onPaid,
  onConfirmed,
}: {
  supplierId: number;
  supplierName: string;
  currency: string;
  counts: boolean;
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
  // The cheapest rate the order qualifies for, so a free rate is picked once the order reaches it.
  const chosen =
    eligible.find(rate => rate.name === shipping) ??
    [...eligible].sort((a, b) => a.priceCents - b.priceCents)[0];
  const goal = rates.data ? freeDelivery(rates.data.rates, localSubtotal) : null;
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
            <SupplyTray items={items} currency={currency} goal={goal} />
            {!!items.length && (
              <ul className="iosm-ss-lines">
                {items.map(item => (
                  <li key={item.variantId}>
                    <span className="iosm-ss-tile">
                      <ProductArt
                        imageUrl={item.imageUrl}
                        seed={item.productId}
                        fill={1}
                      />
                    </span>
                    <span className="iosm-ss-line-copy">
                      <b>{item.title}</b>
                      {optionName(item.variant) && (
                        <small>{optionName(item.variant)}</small>
                      )}
                      <em>{money(item.price * item.quantity, currency)}</em>
                      {item.quantity >= item.stock && (
                        <small role="status">
                          {counts
                            ? `All ${item.stock} in stock are in your tray.`
                            : "One of each option per order."}
                        </small>
                      )}
                    </span>
                    <span
                      className="iosm-ss-stepper"
                      role="group"
                      aria-label={`${item.title} quantity`}
                    >
                      <button
                        type="button"
                        aria-label={`Remove one ${item.title}`}
                        disabled={create.isPending}
                        onClick={() =>
                          onQuantity(item.variantId, item.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <b>{item.quantity}</b>
                      <button
                        type="button"
                        aria-label={`Add one ${item.title}`}
                        disabled={create.isPending || item.quantity >= item.stock}
                        onClick={() =>
                          onQuantity(item.variantId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
                    value={chosen?.name}
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
                  shippingRateName: chosen?.name,
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

/** The cart as a tray of bottles, one for each line, with the running total. */
function SupplyTray({
  items,
  currency,
  goal = null,
}: {
  items: Item[];
  currency: string | null;
  goal?: { min: number; short: number } | null;
}) {
  const count = items.reduce((n, item) => n + item.quantity, 0);
  const subtotal = items.reduce((n, item) => n + item.price * item.quantity, 0);
  const total = currency
    ? money(subtotal, currency)
    : `${count} item${count === 1 ? "" : "s"}`;
  return (
    <LiveStage
      className="iosm-detail-stage"
      label={`${count} item${count === 1 ? "" : "s"} in your tray, ${total}`}
    >
      <ul className="iosm-ss-shelfline" aria-hidden="true">
        {items.length ? (
          items.slice(0, 8).map(item => (
            <li key={item.variantId} className="iosm-ss-tile">
              <ProductArt imageUrl={item.imageUrl} seed={item.productId} fill={1} />
              <em>×{item.quantity}</em>
            </li>
          ))
        ) : (
          <small>Your tray is empty</small>
        )}
        {items.length > 8 && <small>+{items.length - 8}</small>}
      </ul>
      <StageNumber
        over={`${count} item${count === 1 ? "" : "s"} in your tray`}
        value={total}
        under={
          currency
            ? "Before delivery and checkout fees"
            : "Across suppliers in different currencies"
        }
      />
      {currency && <FreeDeliveryBar goal={goal} currency={currency} />}
    </LiveStage>
  );
}

/** A saved cart: variant ids and quantities only. Prices and stock come from the current catalogue. */
function savedBasket(practiceCart: Record<number, number> | null, key: string) {
  let raw: Record<string, unknown> = {};
  try {
    raw = practiceCart ?? JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([id, qty]) =>
        Number.isInteger(Number(id)) &&
        Number(id) > 0 &&
        typeof qty === "number" &&
        Number.isInteger(qty) &&
        qty > 0
    )
  ) as Record<number, number>;
}
