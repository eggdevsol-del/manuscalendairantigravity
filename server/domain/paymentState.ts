/** Payment settlement never implies that the tattoo session has taken place. */
export function settledBalance(
  booking: {
    totalPaidAmountCents: number | null;
    totalExpectedAmountCents: number | null;
    price?: number | null;
  },
  baseAmountCents: number
) {
  if (!Number.isSafeInteger(baseAmountCents) || baseAmountCents <= 0)
    throw new Error("Invalid payment amount");
  const paid = (booking.totalPaidAmountCents || 0) + baseAmountCents;
  const expected =
    booking.totalExpectedAmountCents ?? (booking.price || 0) * 100;
  const remaining = Math.max(0, expected - paid);
  return {
    totalPaidAmountCents: paid,
    remainingBalanceCents: remaining,
    paymentStatus:
      remaining === 0 ? ("fully_paid" as const) : ("deposit_paid" as const),
    clientPaid: remaining === 0 ? 1 : 0,
    paymentMethod: "stripe" as const,
  };
}
