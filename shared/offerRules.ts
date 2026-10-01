import { z } from "zod";
export const OFFER_TERMS =
  "Vouchers are non-refundable except where required by applicable law. Promotional discounts have no cash value and cannot be exchanged for cash.";
export const offerRulesSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).default(""),
    kind: z.enum(["discount", "voucher"]),
    allowStacking: z.boolean().optional(),
    funding: z.enum(["gift", "sale"]).optional(),
    validityYears: z.number().int().min(3).max(20).nullable().optional(),
    valueType: z.enum(["fixed", "percentage"]),
    value: z.number().int().positive().max(10000000),
    currency: z.enum(["AUD", "NZD"]),
    eligibility: z.enum(["new", "unpaid"]).default("new"),
    expiresAt: z.string().datetime().nullable(),
    sittingMonths: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).max(72).optional(),
    sittingFrom: z.string().datetime().nullable(),
    sittingUntil: z.string().datetime().nullable(),
    backgroundImageUrl: z
      .string()
      .url()
      .startsWith("https://")
      .or(z.literal(""))
      .default(""),
  })
  .superRefine((v, c) => {
    if (v.funding === "sale" && v.kind !== "voucher")
      c.addIssue({
        code: "custom",
        message: "Only gift vouchers can be sold.",
      });
    if (v.valueType === "percentage" && (v.value > 100 || v.kind === "voucher"))
      c.addIssue({
        code: "custom",
        message: "Vouchers use a fixed value; percentages cannot exceed 100.",
      });
    if (v.sittingFrom && v.sittingUntil && v.sittingFrom > v.sittingUntil)
      c.addIssue({
        code: "custom",
        message: "The sitting end must follow its start.",
      });
  });
export type OfferRules = z.infer<typeof offerRulesSchema>;
export const audienceSchema = z.object({
  clientIds: z.array(z.string().min(1).max(64)).max(1000).optional(),
  birthdayMonth: z.number().int().min(1).max(12).optional(),
  city: z.string().trim().min(1).max(255).optional(),
  clientId: z.string().min(1).max(64).optional(),
  minSpendCents: z.number().int().nonnegative().default(0),
  minBookings: z.number().int().nonnegative().default(0),
  inactiveDays: z.number().int().nonnegative().max(3650).default(0),
});
export type OfferAudience = z.infer<typeof audienceSchema>;
export function offerEligibility(
  r: OfferRules,
  published: string,
  created: string,
  starts: string[],
  now = Date.now()
) {
  if (
    ![published, created, ...starts].every(d => Number.isFinite(+new Date(d)))
  )
    return "Booking dates could not be verified.";
  if (r.expiresAt && +new Date(r.expiresAt) <= now)
    return "This offer has expired.";
  if (r.eligibility === "new" && +new Date(created) < +new Date(published))
    return "Available for new bookings made after this offer was issued.";
  if (r.sittingMonths?.length && starts.some(s => !r.sittingMonths!.includes(s.slice(0, 7))))
    return "These sittings fall outside the offer’s selected months.";
  if (
    starts.some(
      s =>
        (r.sittingFrom && +new Date(s) < +new Date(r.sittingFrom)) ||
        (r.sittingUntil && +new Date(s) > +new Date(r.sittingUntil))
    )
  )
    return "These sittings fall outside the offer’s dates.";
  return null;
}
/** Largest-remainder allocation keeps zero-value sittings at zero and conserves cents. */
export function allocateCents(total: number, weights: number[]) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    weights.some(w => !Number.isSafeInteger(w) || w < 0)
  )
    throw new Error("Invalid allocation amounts");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(sum) || total > sum)
    throw new Error("Allocation exceeds available value");
  if (!sum) return weights.map(() => 0);
  const shares = weights.map(w => Math.floor((total * w) / sum));
  let left = total - shares.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, remainder: (total * w) % sum }))
    .filter(x => weights[x.i] > 0)
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i]++;
    left--;
  }
  return shares;
}
export function quoteOffer(
  r: OfferRules,
  remaining: number,
  items: { id: number; estimateCents: number; depositCents: number }[]
) {
  if (
    !items.length ||
    items.some(
      i =>
        !Number.isSafeInteger(i.estimateCents) ||
        i.estimateCents < 0 ||
        !Number.isSafeInteger(i.depositCents) ||
        i.depositCents < 0 ||
        i.depositCents > i.estimateCents
    )
  )
    throw new Error("Invalid booking amounts");
  const original = items.reduce((n, i) => n + i.estimateCents, 0);
  const amount = Math.min(
    original,
    r.valueType === "percentage"
      ? Math.round((original * r.value) / 100)
      : remaining
  );
  const shares = allocateCents(
    amount,
    items.map(i => i.estimateCents)
  );
  const adjusted = items.map((i, index) => {
    const discount = r.kind === "discount" ? shares[index] : 0;
    const creditCents = r.kind === "voucher" ? shares[index] : 0;
    const estimateCents = i.estimateCents - discount;
    const requiredDeposit = i.estimateCents
      ? Math.round((i.depositCents * estimateCents) / i.estimateCents)
      : 0;
    const depositCents = Math.max(0, requiredDeposit - creditCents);
    return { ...i, estimateCents, depositCents, creditCents };
  });
  return {
    amount,
    original,
    discountCents: r.kind === "discount" ? amount : 0,
    creditCents: r.kind === "voucher" ? amount : 0,
    items: adjusted,
    totalEstimateCents: adjusted.reduce((n, i) => n + i.estimateCents, 0),
    depositTotalCents: adjusted.reduce((n, i) => n + i.depositCents, 0),
  };
}
