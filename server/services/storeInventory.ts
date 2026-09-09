import { and, eq, sql } from "drizzle-orm";
import {
  orders,
  orderItems,
  products,
  productVariants,
  seminars,
} from "../../drizzle/schema";
import type { getDb } from "./core";
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
/** Must run in a transaction. Fixed item order keeps competing carts' locks consistent. */
export async function changeOrderInventory(
  db: Database,
  orderId: number,
  direction: 1 | -1
) {
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });
  for (const item of items.sort(
    (a, b) =>
      (a.productId || 0) - (b.productId || 0) ||
      (a.variantId || 0) - (b.variantId || 0) ||
      (a.seminarId || 0) - (b.seminarId || 0)
  )) {
    if (item.seminarId) {
      const [seminar] = await db
        .select()
        .from(seminars)
        .where(eq(seminars.id, item.seminarId))
        .for("update");
      if (!seminar) throw new Error("Event no longer exists.");
      if (
        direction === -1 &&
        seminar.capacity - seminar.ticketsSold < item.quantity
      )
        throw new Error("This event is sold out.");
      await db
        .update(seminars)
        .set({
          ticketsSold: Math.max(
            0,
            seminar.ticketsSold - direction * item.quantity
          ),
        })
        .where(eq(seminars.id, seminar.id));
    } else if (item.productId) {
      if (item.variantId) {
        const [variant] = await db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.productId, item.productId)
            )
          )
          .for("update");
        if (
          !variant ||
          (direction === -1 && variant.inventoryCount < item.quantity)
        )
          throw new Error("Selected variant is out of stock.");
        await db
          .update(productVariants)
          .set({
            inventoryCount: variant.inventoryCount + direction * item.quantity,
          })
          .where(eq(productVariants.id, variant.id));
      } else {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .for("update");
        if (
          !product ||
          (direction === -1 && product.inventoryCount < item.quantity)
        )
          throw new Error("This product is out of stock.");
        await db
          .update(products)
          .set({
            inventoryCount: product.inventoryCount + direction * item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(products.id, product.id));
      }
    }
  }
}
/** New checkouts reserve stock before opening Stripe; duplicate expiry is harmless. */
export async function releaseExpiredStoreOrder(
  db: Database,
  orderId: number,
  sessionId: string
) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (
    !order ||
    order.status !== "pending" ||
    order.stripeCheckoutSessionId !== sessionId
  )
    return;
  await changeOrderInventory(db, orderId, 1);
  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}
