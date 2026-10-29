/* The supplier store, on the wallpaper: the artist's week in the chair, shelves of products with their stock,
   a product sheet with the touch quantity slider and a live total, and the tray bar. Shared by catalogue
   suppliers and supplier-run stores; each page keeps its own cart and checkout. */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { money } from "@/features/workspace/bookingPresentation";
import { getAssetUrl } from "@/lib/assets";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { addDays, parseSchedule, startOfDay } from "../design/calendarDays";
import { isExternalEvent } from "../design/landingData";
import { Jar } from "./DetailStages";
import { LiveStage, StageNumber, TouchSlider } from "../design/live";
import { Action, Feedback, SearchField } from "../design/primitives";
import {
  chairWeek,
  optionsInStock,
  priceFrom,
  shelvesOf,
  stockOf,
  type StoreProduct,
  type StoreVariant,
  type WeekDay,
} from "../design/supplyStore";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const hoursText = (h: number) => String(Math.round(h * 2) / 2);
/** Shopify names the only option of a product "Default Title"; it isn't worth showing. */
export const optionName = (name?: string | null) =>
  !name || name === "Default Title" ? "" : name;

/** An artist's next seven days from their calendar and working hours. Null for anyone else, or while loading. */
export function useChairWeek() {
  const { user } = useAuth();
  const artist = user?.role === "artist";
  const [now] = useState(() => Date.now());
  const range = useMemo(() => {
    const start = startOfDay(now);
    return { start: new Date(start), end: new Date(addDays(start, 7)) };
  }, [now]);
  const calendar = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id ?? "", startDate: range.start, endDate: range.end },
    { enabled: artist && !!user?.id }
  );
  const settings = trpc.artistSettings.get.useQuery(undefined, {
    enabled: artist,
  });
  return artist && calendar.data && settings.isSuccess
    ? chairWeek(
        (calendar.data as any[]).filter(a => !isExternalEvent(a)),
        parseSchedule(settings.data?.workSchedule),
        now
      )
    : null;
}

/** A product's photo, or a jar that fills with how many of its options are in stock. */
export function ProductArt({
  imageUrl,
  seed,
  fill,
  big = false,
}: {
  imageUrl?: string | null;
  seed: number | string;
  fill: number;
  big?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return imageUrl && !failed ? (
    <img
      className="iosm-ss-photo"
      src={imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <Jar seed={seed} fill={fill} big={big} />
  );
}

/** Who you're buying from, under the store's name: their logo (or initial) and what they sell. */
export function StoreByline({
  name,
  logoUrl,
  detail,
}: {
  name: string;
  logoUrl?: string | null;
  detail: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="iosm-ss-byline">
      <span className="iosm-ss-logo" aria-hidden="true">
        {logoUrl && !failed ? (
          <img src={getAssetUrl(logoUrl)} alt="" onError={() => setFailed(true)} />
        ) : (
          name.trim().charAt(0).toUpperCase()
        )}
      </span>
      {detail}
    </span>
  );
}

/** The next seven days: one bar per day, as tall as the day is open and filled with the hours booked. */
export function WeekStage({
  week,
  children,
}: {
  week: WeekDay[];
  children?: ReactNode;
}) {
  const hours = week.reduce((sum, d) => sum + d.hours, 0);
  const sittings = week.reduce((sum, d) => sum + d.sittings, 0);
  const scale = Math.max(1, ...week.map(d => Math.max(d.open, d.hours)));
  const label = week
    .map(
      d =>
        `${new Date(d.day).toLocaleDateString("en-AU", { weekday: "long" })}: ${
          d.hours ? `${hoursText(d.hours)} hours booked` : d.open ? "nothing booked" : "closed"
        }`
    )
    .join(", ");
  return (
    <section className="iosm-ss-week" aria-label="Your next 7 days">
      <div className="iosm-ss-week-head">
        <span>
          <small>Your next 7 days</small>
          <b>
            {hoursText(hours)}
            <em> h in the chair</em>
          </b>
        </span>
        <small>{sittings ? plural(sittings, "sitting") : "Nothing booked yet"}</small>
      </div>
      <ol className="iosm-ss-days" role="img" aria-label={label}>
        {week.map(d => (
          <li key={d.day} className={d.hours ? "on" : d.open ? "" : "off"}>
            <span
              className="iosm-ss-bar"
              style={
                {
                  "--cap": `${(Math.max(d.open, d.hours) / scale) * 100}%`,
                  "--fill": `${(d.hours / Math.max(d.open, d.hours, 1)) * 100}%`,
                } as CSSProperties
              }
            >
              <i />
            </span>
            <b>
              {new Date(d.day).toLocaleDateString("en-AU", { weekday: "narrow" })}
            </b>
            <small>{new Date(d.day).getDate()}</small>
          </li>
        ))}
      </ol>
      {children}
    </section>
  );
}

/** Last order's items, ready to add in one go. */
export function Suggestions({
  note,
  lines,
  currency,
  onAddAll,
}: {
  note: string;
  lines: { product: StoreProduct; variant: StoreVariant; quantity: number }[];
  currency: string;
  onAddAll: () => void;
}) {
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.quantity * l.variant.priceCents, 0);
  return (
    <div className="iosm-ss-suggest">
      <p>{note}</p>
      <ul>
        {lines.slice(0, 3).map(({ product, variant, quantity }) => (
          <li key={variant.id}>
            <span className="iosm-ss-tile">
              <ProductArt
                imageUrl={product.imageUrl}
                seed={product.id}
                fill={optionsInStock(product)}
              />
              <em>×{quantity}</em>
            </span>
            <b>{product.title}</b>
            {optionName(variant.name) && <small>{optionName(variant.name)}</small>}
          </li>
        ))}
      </ul>
      {lines.length > 3 && (
        <small className="iosm-ss-more">and {plural(lines.length - 3, "more item")}</small>
      )}
      <Action onClick={onAddAll}>
        Add all {count} to tray · {money(total, currency)}
      </Action>
    </div>
  );
}

const SHELF = 12;
const PAGE = 60;

/** Search, category chips and the shelves of up to twelve products, each with See all. With a search or a
 *  category picked, matches show as one grid, sixty at a time. */
export function StoreShelves({
  products,
  currency,
  storeName,
  counts = true,
  loading,
  onOpen,
}: {
  products: StoreProduct[];
  currency: string;
  storeName: string;
  /** False when the supplier shares only whether an option is in stock, not how many. */
  counts?: boolean;
  loading?: boolean;
  onOpen: (product: StoreProduct) => void;
}) {
  const [search, setSearchText] = useState("");
  // null shows every category; "" is the shelf of products without one.
  const [category, setCategoryValue] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const setSearch = (value: string) => {
    setSearchText(value);
    setLimit(PAGE);
  };
  const setCategory = (value: string | null) => {
    setCategoryValue(value);
    setLimit(PAGE);
  };
  const categories = shelvesOf(products)
    .map(s => s.title)
    .filter(Boolean);
  const shown = products.filter(
    p =>
      p.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      (category === null || (p.category?.trim() || "") === category) &&
      (!inStock || stockOf(p) > 0)
  );
  const shelves = shelvesOf(shown);
  const flat = !!search.trim() || category !== null || shelves.length < 2;
  const card = (p: StoreProduct) => (
    <ShelfCard
      key={p.id}
      product={p}
      currency={currency}
      counts={counts}
      onOpen={() => onOpen(p)}
    />
  );
  return (
    <>
      <SearchField
        value={search}
        onChange={setSearch}
        label={`Search ${storeName}`}
        placeholder={
          products.length ? `Search ${plural(products.length, "product")}` : "Search"
        }
      />
      <div className="iosm-chips iosm-ss-chips" role="group" aria-label="Show">
        <button
          type="button"
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {categories.map(c => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={inStock}
          onClick={() => {
            setInStock(v => !v);
            setLimit(PAGE);
          }}
        >
          In stock
        </button>
      </div>
      {!loading && !shown.length && (
        <Feedback
          empty={
            products.length
              ? "Nothing here matches. Try another search or category."
              : "This supplier has no products listed yet."
          }
        />
      )}
      {flat ? (
        <>
          <div className="iosm-ss-grid">{shown.slice(0, limit).map(card)}</div>
          {shown.length > limit && (
            <Action tone="secondary" onClick={() => setLimit(n => n + PAGE)}>
              Show more · {shown.length - limit} to go
            </Action>
          )}
        </>
      ) : (
        shelves.map(s => (
          <section key={s.title || "more"} className="iosm-ss-shelf">
            <div className="iosm-ss-shelf-head">
              <h2>{s.title || "More"}</h2>
              {s.products.length > SHELF ? (
                <button
                  type="button"
                  className="iosm-ss-seeall"
                  aria-label={`See all ${s.products.length} in ${s.title || "More"}`}
                  onClick={() => setCategory(s.title)}
                >
                  See all {s.products.length}
                </button>
              ) : (
                <small>{plural(s.products.length, "product")}</small>
              )}
            </div>
            <div className="iosm-ss-row">{s.products.slice(0, SHELF).map(card)}</div>
          </section>
        ))
      )}
    </>
  );
}

function ShelfCard({
  product,
  currency,
  counts,
  onOpen,
}: {
  product: StoreProduct;
  currency: string;
  counts: boolean;
  onOpen: () => void;
}) {
  const stock = stockOf(product);
  const varied = new Set(product.variants.map(v => v.priceCents)).size > 1;
  const price = `${varied ? "From " : ""}${money(priceFrom(product), currency)}`;
  const stockText = !stock
    ? "Sold out"
    : counts && stock < 100
      ? `${stock} left`
      : "In stock";
  return (
    <button
      type="button"
      className="iosm-ss-card"
      aria-label={`${product.title}, ${price}, ${stockText}`}
      onClick={onOpen}
    >
      <span className="iosm-ss-card-art">
        <ProductArt
          imageUrl={product.imageUrl}
          seed={product.id}
          fill={optionsInStock(product)}
        />
      </span>
      <b>{product.title}</b>
      <small>
        {product.variants.length > 1
          ? plural(product.variants.length, "option")
          : product.category || " "}
      </small>
      <span className="iosm-ss-card-foot">
        <em>{price}</em>
        <span className={stock ? "" : "out"}>
          <Jar seed={product.id} fill={optionsInStock(product)} />
          {stockText}
        </span>
      </span>
    </button>
  );
}

/** One product: its options, the quantity on a touch slider and the total as you drag. */
export function ProductSheet({
  product,
  sub,
  currency,
  about,
  inTray,
  limit = Infinity,
  counts = true,
  onAdd,
  onClose,
}: {
  product: StoreProduct;
  sub: string;
  currency: string;
  /** False when the supplier shares only whether an option is in stock, not how many. */
  counts?: boolean;
  about?: ReactNode;
  inTray: (variantId: number) => number;
  /** The most of one option a single order can hold, where the store sets one. */
  limit?: number;
  onAdd: (variant: StoreVariant, quantity: number) => void;
  onClose: () => void;
}) {
  const first =
    product.variants.find(v => v.stock > inTray(v.id)) ?? product.variants[0];
  const [variantId, setVariantId] = useState(first?.id);
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find(v => v.id === variantId) ?? first;
  const held = variant ? inTray(variant.id) : 0;
  const available = variant
    ? Math.max(0, Math.min(variant.stock, limit) - held)
    : 0;
  const qty = Math.min(Math.max(1, quantity), Math.max(1, available));
  const price = variant?.priceCents ?? 0;
  const left = variant ? Math.max(0, variant.stock - held - (available ? qty : 0)) : 0;
  const option = optionName(variant?.name);
  const leftText = !variant || variant.stock <= 0
    ? "Sold out"
    : counts
      ? `${left} left after yours`
      : "In stock";
  return (
    <SheetShell isOpen onClose={onClose} title={product.title}>
      <div className="v3-stack iosm-ss-sheet">
        <LiveStage
          className="iosm-ss-stage"
          label={`${product.title}${option ? `, ${option}` : ""}: ${qty} for ${money(price * qty, currency)}, ${leftText.toLowerCase()}`}
        >
          <div className="iosm-ss-hero">
            <ProductArt
              imageUrl={product.imageUrl}
              seed={product.id}
              fill={optionsInStock(product)}
              big
            />
            <span className="iosm-ss-left">
              <Jar
                seed={product.id}
                fill={!variant?.stock ? 0 : counts ? left / variant.stock : 1}
              />
              <small>{leftText}</small>
            </span>
          </div>
          <StageNumber
            over={`${qty} × ${money(price, currency)}`}
            value={money(price * qty, currency)}
            under={sub}
          />
        </LiveStage>
        {product.variants.length > 1 && (
          <div className="iosm-chips iosm-ss-options" role="group" aria-label="Options">
            {product.variants.map(v => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === variant?.id}
                disabled={v.stock <= 0}
                onClick={() => {
                  setVariantId(v.id);
                  setQuantity(1);
                }}
              >
                {optionName(v.name) || "Standard"}
                <small>{v.stock <= 0 ? "Sold out" : money(v.priceCents, currency)}</small>
              </button>
            ))}
          </div>
        )}
        <TouchSlider
          label="Quantity"
          value={qty}
          min={1}
          max={Math.max(1, available)}
          disabled={available <= 1}
          onChange={setQuantity}
        />
        {held > 0 && (
          <p className="v3-muted">{held} already in your tray</p>
        )}
        {!counts && variant && variant.stock > 0 && (
          <p className="v3-muted">
            This supplier shares whether an item is in stock, not how many, so
            an order takes one of each option.
          </p>
        )}
        {about}
        <Action
          disabled={!variant || !available}
          onClick={() => {
            if (!variant) return;
            onAdd(variant, qty);
            onClose();
          }}
        >
          {!variant || variant.stock <= 0
            ? "Sold out"
            : !available
              ? "All available stock is in your tray"
              : `Add ${qty} to tray · ${money(price * qty, currency)}`}
        </Action>
      </div>
    </SheetShell>
  );
}

/** The tray, floating over the shelves once something is in it. */
export function TrayPill({
  lines,
  count,
  subtotal,
  currency,
  note,
  onOpen,
}: {
  lines: { key: string | number; seed: number; imageUrl?: string | null }[];
  count: number;
  subtotal: number;
  currency: string;
  note: string;
  onOpen: () => void;
}) {
  if (!count) return null;
  return createPortal(
    <button
      type="button"
      className="supplier-cart-dock iosm-ss-pill"
      aria-label={`Open your tray: ${plural(count, "item")}, ${money(subtotal, currency)}`}
      onClick={onOpen}
    >
      <span className="iosm-ss-thumbs" aria-hidden="true">
        {lines.slice(0, 3).map(l => (
          <span key={l.key}>
            <ProductArt imageUrl={l.imageUrl} seed={l.seed} fill={1} />
          </span>
        ))}
      </span>
      <span className="iosm-ss-pill-copy">
        <b>{plural(count, "item")} in your tray</b>
        <small>{note}</small>
      </span>
      <span className="iosm-ss-pill-total">
        {money(subtotal, currency)}
        <ChevronRight size={16} aria-hidden="true" />
      </span>
    </button>,
    document.body
  );
}

/** How far the tray is from the supplier's free delivery. */
export function FreeDeliveryBar({
  goal,
  currency,
}: {
  goal: { min: number; short: number } | null;
  currency: string;
}) {
  if (!goal) return null;
  const share = goal.min ? Math.min(1, Math.max(0, (goal.min - goal.short) / goal.min)) : 1;
  const text =
    goal.short > 0
      ? `${money(goal.short, currency)} more for free delivery`
      : "Free delivery";
  return (
    <div className="iosm-ss-goal" role="img" aria-label={text}>
      <span>
        <i style={{ width: `${share * 100}%` }} />
      </span>
      <small>
        {text}
        {goal.short > 0 && goal.min > 0 && <em>from {money(goal.min, currency)}</em>}
      </small>
    </div>
  );
}

/** The delivery goal as the tray bar's second line. */
export const goalNote = (
  goal: { short: number } | null,
  currency: string,
  fallback: string
) =>
  goal
    ? goal.short > 0
      ? `${money(goal.short, currency)} more for free delivery`
      : "Free delivery on this order"
    : fallback;
