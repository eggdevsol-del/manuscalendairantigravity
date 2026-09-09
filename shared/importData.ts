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
});
export type ImportRow = z.infer<typeof importRowSchema>;
export type ImportInput = z.infer<typeof importInputSchema>;
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
};
export const normalEmail = (value: string) => value.trim().toLowerCase();
export function normalPhone(value: string) {
  const n = value.replace(/[^\d+]/g, "");
  return n.startsWith("04")
    ? "+61" + n.slice(1)
    : n.startsWith("0061")
      ? "+" + n.slice(2)
      : n;
}
/** Accept explicit ISO dates or Australian day/month/year; reject locale-dependent parsing. */
export function importLocalTime(date: string, time: string) {
  let day = date.trim();
  const aus = day.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (aus)
    day = `${aus[3]}-${aus[2].padStart(2, "0")}-${aus[1].padStart(2, "0")}`;
  const clock = time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !clock)
    throw new Error("Use YYYY-MM-DD or DD/MM/YYYY and HH:mm (optional AM/PM).");
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (minute > 59 || hour > 23 || (clock[3] && (hour < 1 || hour > 12)))
    throw new Error("Invalid time.");
  if (clock[3]) hour = (hour % 12) + (clock[3].toUpperCase() === "PM" ? 12 : 0);
  const result = `${day}T${String(hour).padStart(2, "0")}:${clock[2]}`;
  if (new Date(result + "Z").toISOString().slice(0, 10) !== day)
    throw new Error("Invalid calendar date.");
  return result;
}
