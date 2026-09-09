export function assertOfferAvailable(
  offer: { status: string; expiresAt: string | null; startsAt: string | null },
  now = new Date()
) {
  if (offer.status !== "offered")
    throw new Error("This offer is no longer available.");
  const utc = (value: string) =>
    new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (
    !offer.expiresAt ||
    !offer.startsAt ||
    !(+utc(offer.expiresAt) > +now) ||
    !(+utc(offer.startsAt) > +now)
  )
    throw new Error(
      "This offer has expired. Ask your artist about another time."
    );
}
