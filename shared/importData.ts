import { z } from "zod";
export const importRowSchema = z.object({
  sourceRow: z.number().int().min(2).max(100000).optional(),
  name: z.string().trim().max(255),
  email: z.string().trim().max(320).default(""),
  phone: z.string().trim().max(40).default(""),
  date: z.string().max(30).default(""),
  startTime: z.string().max(20).default(""),
  endTime: z.string().max(20).default(""),
  serviceName: z.string().max(255).default(""),
  price: z.number().finite().nonnegative().max(100000).optional(),
});
export const importInputSchema = z.object({
  mode: z.enum(["clients", "appointments"]),
  rows: z.array(importRowSchema).min(1).max(500),
  serviceMap: z.record(z.string(), z.string()).default({}),
  /** Deposit for future imported sittings, as a percentage of each sitting's price. */
  depositPercent: z.number().int().min(0).max(100).optional(),
  /** Whether clients already paid those deposits in the artist's previous system. */
  depositsPaid: z.boolean().default(true),
  /** Cancel existing bookings that overlap an imported one, instead of skipping the import. */
  replaceExisting: z.boolean().default(false),
  /** Make depositPercent the standard deposit for new bookings (plans that allow it). */
  saveDefaultDeposit: z.boolean().default(false),
});
export type ImportRow = z.infer<typeof importRowSchema>;
// Callers may omit the options; processImport applies their defaults.
export type ImportInput = z.input<typeof importInputSchema>;
export type ImportResult = {
  sourceRow?: number;
  index: number;
  name: string;
  status:
    | "new"
    | "matched"
    | "duplicate"
    | "invalid"
    | "conflict"
    | "imported"
    | "failed";
  detail: string;
  /** Appointment imports: whether the sitting has already happened. */
  timing?: "past" | "future";
  priceCents?: number;
  /** Existing bookings this import will cancel, or has cancelled. */
  replaces?: number;
};

/**
 * Payment state for an imported sitting. Sittings that have already ended were settled in the
 * artist's previous system, so they arrive paid in full and completed. Future sittings carry a
 * deposit of depositPercent of the price, already paid unless the artist says otherwise.
 */
export function importedPayment(
  priceCents: number,
  past: boolean,
  depositPercent: number,
  depositsPaid: boolean
) {
  if (past)
    return {
      status: "completed" as const,
      paymentStatus: "fully_paid" as const,
      depositAmount: Math.round(priceCents / 100),
      depositPaid: 1,
      clientPaid: 1,
      amountPaid: Math.round(priceCents / 100),
      totalPaidAmountCents: priceCents,
      remainingBalanceCents: 0,
    };
  const deposit = Math.round((priceCents * depositPercent) / 100);
  const paid = depositsPaid ? deposit : 0;
  return {
    status: "confirmed" as const,
    paymentStatus:
      paid >= priceCents && priceCents > 0
        ? ("fully_paid" as const)
        : paid > 0
          ? ("deposit_paid" as const)
          : ("pending_deposit" as const),
    depositAmount: Math.round(deposit / 100),
    depositPaid: paid > 0 ? 1 : 0,
    clientPaid: 0,
    amountPaid: Math.round(paid / 100),
    totalPaidAmountCents: paid,
    remainingBalanceCents: priceCents - paid,
  };
}

const dollars = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-AU", { maximumFractionDigits: 2 });
/** One line describing what an imported sitting's payments will look like. */
export function importedPaymentNote(
  priceCents: number,
  past: boolean,
  depositPercent: number,
  depositsPaid: boolean
) {
  if (past)
    return priceCents
      ? `Past sitting, marked paid in full (${dollars(priceCents)}).`
      : "Past sitting, marked completed.";
  if (!priceCents) return "Upcoming sitting, no price to take a deposit from.";
  const p = importedPayment(priceCents, false, depositPercent, depositsPaid);
  const dep = dollars(Math.round((priceCents * depositPercent) / 100));
  return depositsPaid
    ? `Upcoming: ${dep} deposit paid, ${dollars(p.remainingBalanceCents)} due on the day.`
    : `Upcoming: ${dep} deposit to request, ${dollars(p.remainingBalanceCents)} due on the day.`;
}
export const normalEmail = (value: string) => value.trim().toLowerCase();
export function normalPhone(value: string) {
  const n = value.replace(/[^\d+]/g, "");
  return n.startsWith("04")
    ? "+61" + n.slice(1)
    : n.startsWith("0061")
      ? "+" + n.slice(2)
      : n;
}
const DATE_ERROR =
  "We couldn't read this date or time. Try a format like 25/12/2026 and 2:30 PM.";
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** Splits "25/12/2026 2:30 PM", "2026-12-25T14:30:00Z" and similar into their date and time parts. */
function splitDateTime(value: string): [string, string] {
  const v = value.trim();
  const iso = v.match(
    /^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}[:.]\d{2}(?::\d{2}(?:\.\d+)?)?)(?:Z|[+-]\d{2}:?\d{2})?$/i
  );
  if (iso) return [iso[1], iso[2]];
  const tail = v.match(
    /^(.*?)[,\s]+(?:at\s+)?(\d{1,2}(?:[:.]\d{2}(?::\d{2})?)?\s*(?:[ap]\.?m\.?)?)$/i
  );
  if (
    tail &&
    /\d/.test(tail[1]) &&
    (/[:.]/.test(tail[2]) || /[ap]\.?m/i.test(tail[2]))
  )
    return [tail[1], tail[2]];
  return [v, ""];
}

/**
 * Reads the date formats calendar apps and spreadsheets export, and returns YYYY-MM-DD.
 * Day-first is assumed for numeric dates (Australia), unless the first number can only be a month's day
 * in month-first order (e.g. 12/25/2026).
 */
export function importDate(value: string): string {
  let v = value
    .trim()
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "")
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    // Excel serial date (days since 30 Dec 1899).
    const dt = new Date(
      Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000
    );
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else if ((r = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    [y, m, d] = [+r[1], +r[2], +r[3]];
  } else if ((r = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    const [a, b] = [+r[1], +r[2]];
    y = fullYear(+r[3]);
    [d, m] = a > 12 || b <= 12 ? [a, b] : [b, a];
  } else if (
    (r = v.match(/^(\d{1,2})[\s-]+([a-z]{3,9})\.?[\s,-]+(\d{2}|\d{4})$/i))
  ) {
    [d, m, y] = [
      +r[1],
      MONTHS[r[2].slice(0, 4).toLowerCase()] ??
        MONTHS[r[2].slice(0, 3).toLowerCase()],
      fullYear(+r[3]),
    ];
  } else if (
    (r = v.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/i))
  ) {
    [m, d, y] = [
      MONTHS[r[1].slice(0, 4).toLowerCase()] ??
        MONTHS[r[1].slice(0, 3).toLowerCase()],
      +r[2],
      fullYear(+r[3]),
    ];
  } else throw new Error(DATE_ERROR);
  if (!m || m > 12 || d < 1 || d > 31) throw new Error(DATE_ERROR);
  const out = `${y}-${pad(m)}-${pad(d)}`;
  if (new Date(out + "T00:00Z").toISOString().slice(0, 10) !== out)
    throw new Error("Invalid calendar date.");
  return out;
}

/** Reads 14:30, 14:30:00, 2:30 PM, 2.30pm, 2pm, 1430, noon, midnight and Excel day fractions; returns HH:mm. */
export function importTime(value: string): string {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (v === "noon" || v === "midday") return "12:00";
  if (v === "midnight") return "00:00";
  if (/^0?\.\d+$/.test(v)) {
    const mins = Math.round(Number(v) * 1440) % 1440;
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  const r =
    v.match(
      /^(\d{1,2})(?:[:.h](\d{2})(?::\d{2}(?:\.\d+)?)?)?\s*([ap])?\.?\s*m?\.?$/
    ) || v.match(/^(\d{2})(\d{2})()$/);
  if (!r || (!r[2] && !r[3] && !/^\d{4}$/.test(v))) throw new Error(DATE_ERROR);
  let hour = Number(r[1]);
  const minute = Number(r[2] || 0);
  if (minute > 59 || hour > 23 || (r[3] && (hour < 1 || hour > 12)))
    throw new Error("Invalid time.");
  if (r[3]) hour = (hour % 12) + (r[3] === "p" ? 12 : 0);
  return `${pad(hour)}:${pad(minute)}`;
}

/**
 * Converts whatever date and time an export contains into local YYYY-MM-DDTHH:mm. A date column that
 * also holds the time, or a time column that holds the whole date and time, both work.
 */
export function importLocalTime(date: string, time: string) {
  let [d, t] = splitDateTime(date);
  const [td, tt] = splitDateTime(time);
  if (tt && td) {
    if (!d) d = td;
    t = tt;
  } else if (time.trim()) t = time;
  if (!d || !t) throw new Error(DATE_ERROR);
  return `${importDate(d)}T${importTime(t)}`;
}
export const IMPORT_DATE_ERRORS = [
  DATE_ERROR,
  "Invalid time.",
  "Invalid calendar date.",
];
