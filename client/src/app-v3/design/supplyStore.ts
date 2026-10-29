/* Pure helpers for the supplier store: the artist's week in the chair, shelves, suggestions from the last
   order and the supplier's free-delivery goal. Kept apart so they can be tested without the API. */
import { addDays, hoursFor, startOfDay, type CalendarSitting } from "./calendarDays";

/** A product as the store shows it. A product sold without options has one option with id 0. */
export type StoreVariant = {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
};
export type StoreProduct = {
  id: number;
  title: string;
  category: string | null;
  imageUrl: string | null;
  variants: StoreVariant[];
};

const HOUR = 3600000;
const ms = (v: string | Date) => new Date(v).getTime();

export const stockOf = (p: StoreProduct) =>
  p.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
export const priceFrom = (p: StoreProduct) =>
  p.variants.length ? Math.min(...p.variants.map(v => v.priceCents)) : 0;
/** Catalogues imported from a Shopify store know only whether an option is available, which is stored as
 *  one in stock. A catalogue counts its stock once any option has more than one. */
export const countsStock = (products: StoreProduct[]) =>
  products.some(p => p.variants.some(v => v.stock > 1));
/** How many of a product's options are in stock, as a share of its options. */
export const optionsInStock = (p: StoreProduct) =>
  p.variants.length
    ? p.variants.filter(v => v.stock > 0).length / p.variants.length
    : 0;

export type WeekDay = {
  day: number;
  /** Hours booked in the chair. */
  hours: number;
  /** Hours open for tattooing in the working schedule. */
  open: number;
  sittings: number;
};

/** Each of the next days from today (seven unless asked for more): hours booked, hours open and sittings. */
export function chairDays(
  sittings: CalendarSitting[],
  schedule: any[],
  now: number,
  count = 7
): WeekDay[] {
  const first = startOfDay(now);
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(first, i);
    const next = addDays(first, i + 1);
    const booked = sittings.filter(
      s =>
        s.status !== "cancelled" &&
        ms(s.startTime) >= day &&
        ms(s.startTime) < next
    );
    const hours =
      booked.reduce(
        (sum, s) =>
          sum +
          Math.max(
            0,
            (s.endTime ? ms(s.endTime) : ms(s.startTime) + 2 * HOUR) -
              ms(s.startTime)
          ),
        0
      ) / HOUR;
    const h = hoursFor(schedule, day);
    const open = h.open ? (h.end - h.start - h.breaks) / 60 : 0;
    return { day, hours, open, sittings: booked.length };
  });
}

/** Days in runs of seven from the first; the last run is shorter when the days run out. */
export const weeksOf = (days: WeekDay[]) =>
  Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
    days.slice(i * 7, i * 7 + 7)
  );

/** Products on shelves by category, in catalogue order. Products without a category share the last shelf. */
export function shelvesOf(products: StoreProduct[]) {
  const shelves = new Map<string, StoreProduct[]>();
  for (const p of products) {
    const key = p.category?.trim() || "";
    shelves.set(key, [...(shelves.get(key) || []), p]);
  }
  return [...shelves]
    .sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1))
    .map(([title, list]) => ({ title, products: list }));
}

type OrderItem = {
  supplierProductId: number;
  variantId: number | null;
  productTitle: string;
  variantTitle: string | null;
  quantity: number;
};
type PastOrder = {
  id: number;
  supplierId: number;
  status: string | null;
  createdAt: string | Date;
  items: OrderItem[];
};

/** An ordered item in today's catalogue. A re-imported catalogue gives products new ids, so an item the ids
 *  no longer find is matched by its product and option names. */
export function matchOrderItem(
  products: StoreProduct[],
  item: Omit<OrderItem, "quantity">
) {
  const product =
    products.find(p => p.id === item.supplierProductId) ??
    products.find(p => p.title === item.productTitle.trim());
  const variant =
    product?.variants.find(v => v.id === item.variantId) ??
    product?.variants.find(v => v.name === (item.variantTitle ?? "")) ??
    (product?.variants.length === 1 ? product.variants[0] : undefined);
  return product ? { product, variant } : null;
}

/** The latest paid order from this supplier, matched to today's catalogue: options still sold and in stock,
 *  at the quantity ordered last time and never more than the stock. */
export function fromLastOrder(
  orders: PastOrder[],
  supplierId: number,
  products: StoreProduct[]
) {
  const order = orders
    .filter(o => o.supplierId === supplierId && o.status === "paid")
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0];
  if (!order) return null;
  const lines = order.items.flatMap(item => {
    const found = matchOrderItem(products, item);
    return found?.variant && found.variant.stock > 0
      ? [
          {
            product: found.product,
            variant: found.variant,
            quantity: Math.min(item.quantity, found.variant.stock),
          },
        ]
      : [];
  });
  return lines.length ? { order, lines } : null;
}

type Rate = {
  name: string;
  priceCents: number;
  minOrderSubtotalCents: number | null;
  maxOrderSubtotalCents: number | null;
};

/** The supplier's own free-delivery rate: reached, or how far the tray is from it. None if they have none. */
export function freeDelivery(rates: Rate[], subtotal: number) {
  const free = rates.filter(
    r =>
      r.priceCents === 0 &&
      (r.maxOrderSubtotalCents === null || subtotal <= r.maxOrderSubtotalCents)
  );
  const reached = free.find(
    r => (r.minOrderSubtotalCents ?? 0) <= subtotal
  );
  if (reached)
    return { name: reached.name, min: reached.minOrderSubtotalCents ?? 0, short: 0 };
  const next = free
    .filter(r => r.minOrderSubtotalCents !== null)
    .sort((a, b) => a.minOrderSubtotalCents! - b.minOrderSubtotalCents!)[0];
  return next
    ? {
        name: next.name,
        min: next.minOrderSubtotalCents!,
        short: next.minOrderSubtotalCents! - subtotal,
      }
    : null;
}
