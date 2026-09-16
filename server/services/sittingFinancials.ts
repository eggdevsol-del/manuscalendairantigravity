/** Read-only presentation of persisted appointment amounts. Explicit cents (including zero)
 * win over legacy dollar columns; a missing balance is derived, never assumed settled. */
export function sittingFinancials(row: {
  totalExpectedAmountCents?: number | null;
  totalPaidAmountCents?: number | null;
  remainingBalanceCents?: number | null;
  price?: number | null;
  amountPaid?: number | null;
  depositPaid?: number | null;
  depositAmount?: number | null;
  paymentStatus?: string | null;
}) {
  const estimateCents =
    row.totalExpectedAmountCents ?? Math.round((row.price ?? 0) * 100);
  const paidCents =
    row.totalPaidAmountCents ??
    Math.round(
      (row.amountPaid ?? (row.depositPaid ? row.depositAmount : 0) ?? 0) * 100
    );
  const remainingCents =
    row.remainingBalanceCents ??
    (row.paymentStatus === "fully_paid"
      ? 0
      : Math.max(0, estimateCents - paidCents));
  return { estimateCents, paidCents, remainingCents };
}
