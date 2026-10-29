/* A store's own surfaces, as in the prototype: the stock shelf, where each product is a jar you tap and
   then slide to count, and the storefront as it looks on a customer's phone. Values come from the store's
   products; saving stock uses the existing product update. */
import { useEffect, useState } from "react";
import { money } from "@/features/workspace/bookingPresentation";
import { Action } from "../design/primitives";
import { LiveStage, TouchSlider } from "../design/live";
import { Jar } from "./DetailStages";

export type ShelfProduct = {
  id: number;
  title: string;
  priceCents: number;
  inventoryCount: number;
  imageUrl?: string | null;
  isActive?: number | boolean | null;
  variants: { id: number; name: string; priceCents: number; inventoryCount: number }[];
};

/** Stock of a product: its own count, or the sum of its options. */
export const stockOf = (p: ShelfProduct) =>
  p.variants.length
    ? p.variants.reduce((sum, v) => sum + Math.max(0, v.inventoryCount), 0)
    : Math.max(0, p.inventoryCount);

/** The stock shelf. A full jar holds as much as the best-stocked product. Tap a jar, then slide to count
 *  its stock (each option has its own slider), and save. `threshold` marks low stock when the store has one. */
export function StockShelf({
  products,
  threshold,
  saving,
  error,
  onSave,
}: {
  products: ShelfProduct[];
  threshold?: number | null;
  saving: boolean;
  error?: string;
  onSave: (product: ShelfProduct, stock: Record<number, number>) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const most = Math.max(1, ...products.map(stockOf));
  const product = products.find(p => p.id === selected) ?? null;
  // Variant id 0 holds the count of a product without options.
  const lines = product
    ? product.variants.length
      ? product.variants.map(v => ({ id: v.id, name: v.name, stock: v.inventoryCount }))
      : [{ id: 0, name: "Stock", stock: product.inventoryCount }]
    : [];
  useEffect(() => {
    setCounts(Object.fromEntries(lines.map(l => [l.id, Math.max(0, l.stock)])));
  }, [selected, product?.inventoryCount, product?.variants]);
  if (!products.length) return null;
  const low = (p: ShelfProduct) =>
    threshold != null &&
    (p.variants.length
      ? p.variants.some(v => v.inventoryCount <= threshold)
      : p.inventoryCount <= threshold);
  const changed = lines.some(l => counts[l.id] !== Math.max(0, l.stock));
  const shown = (p: ShelfProduct) =>
    p.id === product?.id
      ? lines.reduce((sum, l) => sum + (counts[l.id] ?? 0), 0)
      : stockOf(p);
  return (
    <section className="iosm-shelf-room" aria-label="Stock">
      <LiveStage className="iosm-shelf-stage">
        <div className="iosm-shelf">
          {products.map(p => (
            <button
              key={p.id}
              type="button"
              className="iosm-prod"
              aria-pressed={p.id === selected}
              aria-label={`${p.title.trim()}, ${shown(p)} left${low(p) ? ", low" : ""}`}
              onClick={() => setSelected(p.id === selected ? null : p.id)}
            >
              <Jar seed={p.id} fill={shown(p) / Math.max(most, shown(p))} />
              <b>{p.title.trim()}</b>
              <em>
                {shown(p)} left{low(p) ? " · low" : ""}
              </em>
            </button>
          ))}
        </div>
        <p className="iosm-stage-cap">
          {product ? `Slide to count ${product.title.trim()}.` : "Tap a jar, then slide to count stock."}
        </p>
      </LiveStage>
      {product && (
        <div className="v3-stack">
          {lines.map(l => (
            <TouchSlider
              key={l.id}
              label={l.id ? l.name.trim() : `${product.title.trim()} in stock`}
              value={counts[l.id] ?? 0}
              min={0}
              max={Math.max(most, l.stock) * 2}
              format={v => `${v} left`}
              onChange={v => setCounts(c => ({ ...c, [l.id]: v }))}
            />
          ))}
          {error && <p role="alert">{error}</p>}
          <Action disabled={!changed || saving} onClick={() => onSave(product, counts)}>
            {saving ? "Saving…" : "Save stock"}
          </Action>
        </div>
      )}
    </section>
  );
}

/** The storefront on a customer's phone: the store's name, whether it's open, and its published products. */
export function StorePhone({
  label,
  name,
  status,
  open,
  products,
  currency,
}: {
  label: string;
  name: string;
  status: string;
  open: boolean;
  products: ShelfProduct[];
  currency: string;
}) {
  const published = products.filter(p => !!p.isActive);
  const most = Math.max(1, ...published.map(stockOf));
  return (
    <LiveStage className="iosm-phone-stage" label={label}>
      <span className="iosm-phone">
        <span className="iosm-phone-me">
          <b>{name}</b>
          <small>{status}</small>
        </span>
        {published.length ? (
          <span className="iosm-phone-shop">
            {published.slice(0, 4).map(p => (
              <span key={p.id}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" />
                ) : (
                  <Jar seed={p.id} fill={stockOf(p) / most} />
                )}
                <b>{p.title.trim()}</b>
                <em>{money(p.priceCents, currency)}</em>
              </span>
            ))}
          </span>
        ) : (
          <span className="iosm-phone-step">No published products yet</span>
        )}
        <span className={`iosm-phone-btn${open ? "" : " off"}`}>
          {open ? "Shop" : "Closed"}
        </span>
      </span>
    </LiveStage>
  );
}
