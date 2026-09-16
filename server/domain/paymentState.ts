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

/** A price edit must update the payable balance without erasing money received. */
export function revisedBookingPrice(
  booking: {
    totalPaidAmountCents?: number | null;
    depositPaid?: number | null;
    depositAmount?: number | null;
  },
  dollars: number
) {
  const expected = Math.round(dollars * 100);
  if (
    !Number.isFinite(dollars) ||
    !Number.isSafeInteger(expected) ||
    expected < 0 ||
    expected > 2147483647
  )
    throw new Error("Enter a valid session price.");
  const paid =
    booking.totalPaidAmountCents ||
    (booking.depositPaid ? Math.round((booking.depositAmount || 0) * 100) : 0);
  if (expected < paid)
    throw new Error(
      "The price cannot be less than the payment already received. Handle any refund before reducing it."
    );
  const remaining = expected - paid;
  return {
    // Legacy whole-dollar column; precise financial amounts live in cents.
    price: Math.round(dollars),
    totalExpectedAmountCents: expected,
    totalPaidAmountCents: paid,
    remainingBalanceCents: remaining,
    paymentStatus:
      remaining === 0
        ? ("fully_paid" as const)
        : paid > 0
          ? ("deposit_paid" as const)
          : ("pending_deposit" as const),
    clientPaid: remaining === 0 ? 1 : 0,
  };
}
