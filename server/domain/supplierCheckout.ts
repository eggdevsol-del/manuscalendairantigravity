/** Catalogue checks run before a supplier payment session is created. */
export function validateSupplierItem(
  supplierId: number,
  productId: number,
  quantity: number,
  variant: {
    inventoryCount: number;
    priceCents: number;
    product: { id: number; supplierId: number };
  }
) {
  if (
    variant.product.id !== productId ||
    variant.product.supplierId !== supplierId
  )
    throw new Error(
      "An item does not belong to this supplier. Refresh your order."
    );
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > variant.inventoryCount
  )
    throw new Error("An item has insufficient stock. Review the quantity.");
  if (!Number.isInteger(variant.priceCents) || variant.priceCents <= 0)
    throw new Error("An item has no valid sale price. Contact the supplier.");
}
type Rate = {
  name: string;
  priceCents: number;
  currency?: string | null;
  minOrderSubtotalCents?: number | null;
  maxOrderSubtotalCents?: number | null;
};
type Zone = { countryCodes: string | null; rates: Rate[] };
export function resolveSupplierShipping(
  zones: Zone[],
  country: string,
  currency: string,
  subtotal: number,
  selected?: string
) {
  if (!zones.length && !selected) return 0;
  const rates = zones
    .flatMap(zone => {
      let codes: unknown;
      try {
        codes = JSON.parse(zone.countryCodes || "[]");
      } catch {
        throw new Error("Supplier shipping configuration could not be read.");
      }
      return Array.isArray(codes) &&
        (codes.includes(country) || codes.includes("*"))
        ? zone.rates
        : [];
    })
    .filter(
      rate =>
        (rate.minOrderSubtotalCents == null ||
          subtotal >= rate.minOrderSubtotalCents) &&
        (rate.maxOrderSubtotalCents == null ||
          subtotal <= rate.maxOrderSubtotalCents)
    );
  const rate = rates.find(rate => rate.name === selected);
  if (!rate)
    throw new Error(
      "Choose an available shipping rate for this order and destination."
    );
  if (
    (rate.currency || currency).toUpperCase() !== currency.toUpperCase() ||
    !Number.isInteger(rate.priceCents) ||
    rate.priceCents < 0
  )
    throw new Error("The supplier’s shipping configuration needs attention.");
  return rate.priceCents;
}
