export const OFFER_FREQUENCIES = [
  ["consecutive", "Consecutive dates"],
  ["weekly", "Weekly"],
  ["biweekly", "Every two weeks"],
  ["monthly", "Monthly"],
] as const;
export type OfferFrequency = (typeof OFFER_FREQUENCIES)[number][0];
/** Every choice must produce the complete project; unavailable choices are omitted. */
export async function feasibleOfferFrequencies<T extends { dates: unknown[] }>(
  sittingCount: number,
  search: (frequency: OfferFrequency) => Promise<T>
) {
  const results = await Promise.allSettled(
    OFFER_FREQUENCIES.map(([frequency]) => search(frequency))
  );
  const feasible: OfferFrequency[] = [];
  let failure: unknown = null;
  results.forEach((result, i) => {
    if (
      result.status === "fulfilled" &&
      result.value.dates.length === sittingCount
    )
      feasible.push(OFFER_FREQUENCIES[i][0]);
    if (result.status === "rejected") {
      const code = (result.reason as { data?: { code?: string } })?.data?.code;
      if (!["BAD_REQUEST", "PRECONDITION_FAILED"].includes(code || ""))
        failure = result.reason;
    }
  });
  return { feasible, failure };
}
