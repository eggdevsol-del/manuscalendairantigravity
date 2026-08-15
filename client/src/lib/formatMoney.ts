/**
 * Money formatting utility — single source of truth.
 * All money display in the app goes through this formatter.
 * Uses Intl.NumberFormat for locale-aware, comma-grouped output.
 *
 * Convention: the app stores amounts in whole dollars (legacy) and cents (new).
 * These helpers accept both and format at the display boundary.
 */

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatterWithCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format whole dollars to a display string.
 * e.g. formatMoney(1998) → "$1,998"
 */
export function formatMoney(dollars: number): string {
  return formatter.format(dollars);
}

/**
 * Format cents to a display string (no decimal if round).
 * e.g. formatCents(199800) → "$1,998"
 * e.g. formatCents(49950) → "$499.50"
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) {
    return formatter.format(dollars);
  }
  return formatterWithCents.format(dollars);
}

/**
 * Convert cents to whole dollars for display.
 */
export function centsToDollars(cents: number): number {
  return Math.round(cents / 100);
}
