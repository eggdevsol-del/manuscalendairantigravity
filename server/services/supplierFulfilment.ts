import { eq } from "drizzle-orm";
import { supplierOrders, merchants, users } from "../../drizzle/schema";
import { createShopifyDraftOrder } from "./shopifyDraftOrder";
import type { getDb } from "./core";
export async function fulfilSupplierOrder(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orderId: number
) {
  if (!Number.isInteger(orderId) || orderId <= 0)
    throw new Error("Invalid supplier order.");
  const [locked] = await db
    .select()
    .from(supplierOrders)
    .where(eq(supplierOrders.id, orderId))
    .for("update");
  if (!locked) throw new Error("Supplier order not found.");
  if (locked.shopifyDraftOrderId || locked.status === "refunded") return;
  if (locked.status !== "paid") throw new Error("Supplier order is not paid.");
  const order = await db.query.supplierOrders.findFirst({
    where: eq(supplierOrders.id, orderId),
    with: { items: true, supplier: true },
  });
  if (!order?.supplier?.merchantId)
    throw new Error("Supplier merchant is unavailable.");
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, order.supplier.merchantId),
  });
  if (!merchant?.shopifyDomain || !merchant.shopifyToken)
    throw new Error("Supplier Shopify connection is incomplete.");
  const artist = await db.query.users.findFirst({
    where: eq(users.id, order.artistId),
  });
  const shipping = order.shippingAddress
    ? JSON.parse(order.shippingAddress)
    : null;
  const address = shipping?.address || shipping;
  const name = shipping?.name || order.shippingName || artist?.name || "";
  const draft = await createShopifyDraftOrder(
    merchant.shopifyDomain,
    merchant.shopifyToken,
    {
      lineItems: order.items.map(item => ({
        shopifyVariantId: item.shopifyVariantId || "",
        quantity: item.quantity,
      })),
      shippingAddress: address
        ? {
            first_name: name.split(" ")[0],
            last_name: name.split(" ").slice(1).join(" "),
            address1: address.line1 || address.address1 || "",
            address2: address.line2 || address.address2,
            city: address.city || "",
            province: address.state || address.province || "",
            zip: address.postal_code || address.zip || "",
            country: address.country || "",
          }
        : undefined,
      note: `Tattoi supplier order ${orderId}. Artist: ${artist?.name || "Unknown"}. Payment recorded in Tattoi.`,
      email: artist?.email || undefined,
      retryTag: `tattoi-supplier-order-${orderId}`,
    }
  );
  await db
    .update(supplierOrders)
    .set({
      shopifyDraftOrderId: draft.draftOrderId,
      shopifyDraftOrderName: draft.draftOrderName,
    })
    .where(eq(supplierOrders.id, orderId));
}
