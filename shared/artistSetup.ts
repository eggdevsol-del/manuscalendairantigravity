export type ArtistSetupStep =
  | "profile"
  | "business"
  | "hours"
  | "services"
  | "bank";
export const ARTIST_SETUP_STEPS = [
  { id: "profile", title: "Your profile & location" },
  { id: "business", title: "Tattooing location" },
  { id: "hours", title: "Working hours" },
  { id: "services", title: "Services" },
  { id: "bank", title: "Bank payouts" },
] as const;
type Profile = {
  name?: string | null;
  avatar?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
};
type Settings = {
  businessAddress?: string | null;
  businessCountry?: string | null;
  workSchedule?: string | null;
  services?: string | null;
  stripeConnectAccountId?: string | null;
};
type StripeStatus = {
  statusAvailable?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  hasBankAccount?: boolean;
  currentlyDue?: string[];
};
const text = (value: unknown) => typeof value === "string" && !!value.trim();
const parse = (value: string | null | undefined) => {
  try {
    return JSON.parse(value || "null");
  } catch {
    return null;
  }
};
const time = (value: unknown) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function artistSetupProgress(
  user: Profile,
  settings: Settings | null | undefined,
  stripe?: StripeStatus | null
) {
  const schedule = parse(settings?.workSchedule);
  const days = Array.isArray(schedule)
    ? schedule
    : schedule && typeof schedule === "object"
      ? Object.values(schedule)
      : [];
  const available = days.filter((d: any) => d?.enabled);
  const hours =
    available.length > 0 &&
    available.every(
      (d: any) =>
        time(d.start || d.startTime) &&
        time(d.end || d.endTime) &&
        (d.start || d.startTime) < (d.end || d.endTime)
    );
  const services = parse(settings?.services);
  const validServices =
    Array.isArray(services) &&
    services.length > 0 &&
    services.every(
      (s: any) =>
        text(s?.name) &&
        typeof s.duration === "number" &&
        s.duration > 0 &&
        Number.isFinite(s.duration) &&
        typeof s.price === "number" &&
        s.price >= 0 &&
        Number.isFinite(s.price) &&
        Number.isInteger(s.sittings ?? 1) &&
        (s.sittings ?? 1) > 0
    );
  const done = {
    profile: [
      user.name,
      user.avatar,
      user.phone,
      user.city,
      user.country,
    ].every(text),
    business:
      text(settings?.businessAddress) &&
      ["AU", "NZ"].includes(settings?.businessCountry || ""),
    hours,
    services: validServices,
    bank:
      !!settings?.stripeConnectAccountId &&
      stripe?.statusAvailable === true &&
      ((stripe.chargesEnabled === true && stripe.payoutsEnabled === true) ||
        (stripe.detailsSubmitted === true &&
          stripe.hasBankAccount === true &&
          Array.isArray(stripe.currentlyDue) &&
          stripe.currentlyDue.length === 0)),
  };
  const steps = ARTIST_SETUP_STEPS.map(s => ({ ...s, done: done[s.id] }));
  return {
    steps,
    nextStep: steps.find(s => !s.done)?.id ?? null,
    complete: steps.every(s => s.done),
    paymentsReady:
      stripe?.chargesEnabled === true && stripe?.payoutsEnabled === true,
  };
}
