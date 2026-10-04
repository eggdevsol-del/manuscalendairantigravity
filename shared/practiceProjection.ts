import type { PracticeState } from "./practice";
import {
  PRACTICE_SETTINGS,
  PRACTICE_CLIENTS,
  PRACTICE_ARTIST_PROFILE,
} from "./practiceFixtures";
import { mutateBusinessControl } from "./practiceBusinessControls";
import { PRACTICE_REFERENCE } from "./practiceMedia";
/** Guided form steps and production controls project into the same private records. */
export function projectPracticeStep(
  s: PracticeState,
  key: string,
  v: Record<string, string>
) {
  s.sandbox ??= {};
  const b = s.sandbox;
  b.settings ??= {};
  const context = {
    artist: { ...PRACTICE_ARTIST_PROFILE, ...b.artist },
    clients: b.clients ?? PRACTICE_CLIENTS,
    sessions: [],
    messages: [],
    settings: { ...PRACTICE_SETTINGS, ...b.settings },
  };
  const act = (path: string, raw: any) =>
    mutateBusinessControl(s, path, raw, context);
  const services = () =>
    JSON.parse(b.settings.services ?? PRACTICE_SETTINGS.services);
  if (key === "clients.add") {
    b.clients = [
      ...(b.clients ?? PRACTICE_CLIENTS),
      {
        id: `practice-client-${(b.clients ?? PRACTICE_CLIENTS).length}`,
        name: v.name,
        city: v.city,
        email: v.email,
        role: "client",
        bookings: 0,
        lifetimePaid: 0,
        inactiveDays: 0,
      },
    ];
  }
  if (key === "clients.edit")
    b.clientProfile = {
      ...b.clientProfile,
      name: v.name,
      city: v.city,
      phone: v.phone,
      birthday: v.birthday,
    };
  if (key === "clients.notes")
    b.notes = [
      ...(b.notes ?? []),
      {
        id: (b.notes?.length ?? 0) + 1,
        note: v.note,
        createdAt: new Date().toISOString(),
      },
    ];
  if (key === "availability.service-add")
    b.settings.services = JSON.stringify([
      ...services(),
      {
        name: v.name,
        duration: Number(v.duration),
        price: Number(v.price),
        sittings: Number(v.sittings),
      },
    ]);
  if (key === "availability.service-edit")
    b.settings.services = JSON.stringify(
      services().map((a: any) =>
        a.name === v.service ? { ...a, price: Number(v.price) } : a
      )
    );
  if (key === "availability.service-remove")
    b.settings.services = JSON.stringify(
      services().filter((a: any) => a.name !== v.service)
    );
  if (key === "availability.hours" || key === "availability.break") {
    const schedule = JSON.parse(
      b.settings.workSchedule ?? PRACTICE_SETTINGS.workSchedule
    );
    for (const [day, hours] of Object.entries<any>(schedule))
      if (day === "monday" || !v.day) {
        if (key.endsWith("hours")) {
          hours.startTime = v.start;
          hours.endTime = v.end;
        } else hours.breaks = [{ startTime: v.start, endTime: v.end }];
      }
    b.settings.workSchedule = JSON.stringify(schedule);
  }
  if (key === "availability.time-off")
    b.settings.timeOff = JSON.stringify([{ date: v.date, reason: v.reason }]);
  if (key === "forms.template")
    b.templates = { ...b.templates, medicalTemplate: v.wording };
  if (key === "forms.consent")
    b.templates = { ...b.templates, consentTemplate: v.wording };
  if (key === "forms.aftercare") b.aftercare = v.wording;
  if (key === "bank.connect") b.bankConnected = true;
  if (key === "bank.verification") b.bankVerified = true;
  if (key === "bank.schedule")
    b.payoutSchedule = { interval: v.schedule?.toLowerCase() ?? "daily" };
  if (key === "profile.profile")
    b.artist = { ...b.artist, bio: v.bio, city: v.city };
  if (key === "profile.link")
    act("funnel.updateFunnelSettings", { publicSlug: v.slug });
  if (key === "profile.upload")
    act("portfolio.create", { description: v.artwork });
  if (key === "profile.remove")
    b.portfolio = [
      {
        id: 1,
        imageUrl: PRACTICE_REFERENCE,
        displayUrl: PRACTICE_REFERENCE,
        description: "Fictional botanical artwork",
        mediaType: "image",
      },
    ];
  if (key === "imports.import" || key === "imports.retry") {
    b.clients = [
      ...PRACTICE_CLIENTS,
      {
        id: "practice-imported",
        name: "Casey Morgan",
        email: "casey@example.test",
        role: "client",
        city: "Brisbane",
        bookings: 0,
        lifetimePaid: 0,
        inactiveDays: 0,
      },
    ];
  }
  if (key === "supplies.quantity" || key === "supplies.recommendation")
    act("practice.saveCart", { quantities: { 1: Number(v.quantity) } });
  if (key === "supplies.remove") act("practice.saveCart", { quantities: {} });
  if (key === "supplies.delivery")
    act("practice.saveCart", { quantities: { 1: 3 } });
  if (key === "supplies.checkout") {
    act("supplierOrders.createSupplierCheckout", {
      items: [{ variantId: 1, quantity: b.cart?.[1] ?? 3 }],
    });
    act("practice.completeExternal", {});
    b.cart = {};
  }
  if (key === "supplies.tracking")
    b.supplyOrders = (b.supplyOrders ?? []).map((o: any) => ({
      ...o,
      status: "shipped",
      trackingNumber: "DEMO-001",
    }));
  if (key === "shopfront.product")
    act("storefront.createProduct", {
      title: v.name,
      priceCents: Math.round(Number(v.price) * 100),
      inventoryCount: Number(v.stock),
      description: "Fictional practice product",
    });
  if (key === "shopfront.publish")
    b.products = (b.products ?? []).map((p: any) => ({
      ...p,
      isActive: v.published === "true" ? 1 : 0,
    }));
  if (key === "shopfront.event")
    act("storefront.createSeminar", {
      title: v.name,
      date: v.date,
      capacity: 10,
      priceCents: 0,
      description: "Fictional practice event",
    });
  if (key === "shopfront.event-edit")
    b.events = (b.events ?? []).map((e: any) => ({
      ...e,
      status: "cancelled",
    }));
  if (key === "studio.create") act("studios.createStudio", { name: v.name });
  if (key === "studio.invite")
    act("studios.inviteArtist", {
      artistEmail: v.email,
      role: v.role?.toLowerCase(),
    });
  if (key === "studio.roles" && b.studio) b.studio.role = v.role?.toLowerCase();
  if (key === "studio.leave") {
    b.studio = null;
    b.members = [];
  }
  if (key === "settings.account")
    act("auth.updateProfile", { name: v.name, email: v.email });
  if (key === "settings.plans") b.subscription = v.plan?.toLowerCase();
  if (key === "settings.delete") b.removalPreview = true;
}
