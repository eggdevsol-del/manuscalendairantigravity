/** Shared display rules. Money stays in cents; server timestamps are UTC. */
export function instant(value: string | Date): Date {
  if (value instanceof Date) return value;
  const normalized = value.replace(" ", "T");
  return new Date(
    /[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : normalized + "Z"
  );
}
export function money(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(cents / 100);
}
export function bookingDate(
  value: string | Date,
  timeZone = "Australia/Brisbane"
) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(instant(value));
}
export function bookingTime(
  value: string | Date,
  timeZone = "Australia/Brisbane"
) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(instant(value));
}
export function statusLabel(status: string) {
  return (
    (
      {
        confirmed: "Confirmed",
        pending: "Awaiting confirmation",
        completed: "Completed",
        cancelled: "Cancelled",
        "no-show": "No show",
        pending_deposit: "Awaiting deposit",
        deposit_paid: "Deposit paid",
        paid: "Paid in full",
      } as Record<string, string>
    )[status] || status.replaceAll("_", " ")
  );
}
