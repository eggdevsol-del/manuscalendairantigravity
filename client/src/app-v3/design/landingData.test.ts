import { describe, expect, it } from "vitest";
import {
  bookedAhead,
  clientProjects,
  daysUntil,
  discoverArtists,
  healingDay,
  isExternalEvent,
  lowStock,
  moneyWeeks,
  nextSittingByClient,
  orderBelt,
  sittingMoney,
  soldSince,
} from "./landingData";

const now = new Date(2026, 10, 4, 15).getTime();
const day = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString();

describe("landing data", () => {
  it("counts calendar days to the next sitting", () => {
    expect(daysUntil(day(4, 18), now)).toBe(0);
    expect(daysUntil(day(5, 9), now)).toBe(1);
    expect(daysUntil(day(14), now)).toBe(10);
  });

  it("finds the newest finished sitting still healing", () => {
    const past = [
      { id: 1, status: "completed", endsAt: day(1), completedAt: day(1) },
      { id: 2, status: "completed", endsAt: day(3) },
      { id: 3, status: "cancelled", endsAt: day(4, 10) },
    ];
    expect(healingDay(past, now)).toMatchObject({ day: 2, sitting: { id: 2 } });
    expect(healingDay(past, new Date(2026, 11, 5).getTime())).toBeNull();
    expect(healingDay([], now)).toBeNull();
  });

  it("splits orders along the belt and totals recent sales", () => {
    const orders = [
      { id: 1, status: "paid", totalAmountCents: 5000, createdAt: day(3) },
      { id: 2, status: "fulfilled", totalAmountCents: 7000, createdAt: day(1) },
      { id: 3, status: "cancelled", totalAmountCents: 9000, createdAt: day(2) },
      { id: 4, status: "fulfilled", totalAmountCents: 1000, createdAt: new Date(2026, 8, 1).toISOString() },
    ];
    const belt = orderBelt(orders);
    expect(belt.toPack.map(o => o.id)).toEqual([1]);
    expect(belt.shipped.map(o => o.id)).toEqual([2, 4]);
    expect(soldSince(orders, now)).toBe(12000);
  });

  it("flags products, or their variants, at or below the threshold", () => {
    const low = lowStock(
      [
        { id: 1, title: "Needles", inventoryCount: 3, variants: [] },
        { id: 2, title: "Ink", variants: [{ name: "Black", inventoryCount: 2 }, { name: "Red", inventoryCount: 40 }] },
        { id: 3, title: "Gloves", inventoryCount: 50 },
      ],
      5
    );
    expect(low.map(l => l.product.title)).toEqual(["Needles", "Ink"]);
    expect(low[1].low.map(v => v.name)).toEqual(["Black"]);
  });

  it("reads a sitting's money the way the server does", () => {
    expect(sittingMoney({ startTime: day(5), totalExpectedAmountCents: 200000, totalPaidAmountCents: 50000 })).toEqual({
      estimateCents: 200000,
      paidCents: 50000,
      remainingCents: 150000,
    });
    // Older rows keep dollars; a recorded balance wins over a derived one.
    expect(sittingMoney({ startTime: day(5), price: 800, depositPaid: 1, depositAmount: 200 })).toMatchObject({ paidCents: 20000, remainingCents: 60000 });
    expect(sittingMoney({ startTime: day(5), price: 800, remainingBalanceCents: 0 }).remainingCents).toBe(0);
  });

  it("totals money still to come over the next eight weeks, and lays out the river's weeks", () => {
    const rows = [
      { startTime: day(6), totalExpectedAmountCents: 100000, totalPaidAmountCents: 25000 },
      { startTime: new Date(2026, 11, 20, 10).toISOString(), totalExpectedAmountCents: 50000, totalPaidAmountCents: 0 },
      { startTime: new Date(2027, 1, 20, 10).toISOString(), totalExpectedAmountCents: 99999, totalPaidAmountCents: 0 },
      { startTime: day(3), totalExpectedAmountCents: 70000, totalPaidAmountCents: 0 },
    ];
    expect(bookedAhead(rows, now)).toBe(75000 + 50000);
    const weeks = moneyWeeks(
      [
        { date: "2026-11-02", netCents: 4000 },
        { date: "2026-11-03", netCents: 1000 },
        { date: "2026-10-27", netCents: 2500 },
      ],
      rows,
      now
    );
    expect(weeks).toHaveLength(18);
    const thisWeek = weeks.find(w => w.w === 0)!;
    expect(thisWeek).toMatchObject({ earned: 5000, booked: 75000 });
    expect(weeks.find(w => w.w === -1)!.earned).toBe(2500);
    expect(weeks.find(w => w.w === 6)!.booked).toBe(50000); // Sunday 20 Dec ends week 6
  });

  it("finds each client's next sitting, soonest first, and spots connected-calendar events", () => {
    const next = nextSittingByClient(
      [
        { clientId: "b", startTime: day(20) },
        { clientId: "a", startTime: day(9) },
        { clientId: "a", startTime: day(6) },
        { clientId: "c", startTime: day(2) },
      ],
      now
    );
    expect(next.map(s => `${s.clientId}:${new Date(s.startTime).getDate()}`)).toEqual(["a:6", "b:20"]);
    expect(isExternalEvent({ id: -4 })).toBe(true);
    expect(isExternalEvent({ id: "google-1" })).toBe(true);
    expect(isExternalEvent({ id: 12 })).toBe(false);
  });
});

describe("client projects", () => {
  const sitting = (
    id: number,
    plan: number | null,
    d: number,
    status: string,
    extra: Record<string, unknown> = {}
  ) => ({
    id,
    sessionPlanId: plan,
    conversationId: 12,
    projectName: plan ? "Back piece" : null,
    serviceName: "Day session",
    title: null,
    imageUrl: null as string | null,
    status,
    startsAt: day(d),
    sessionTotal: plan ? 4 : 1,
    artist: { name: "P Mason" },
    ...extra,
  });

  it("groups a proposal's sittings and counts the ones done", () => {
    const [back, single] = clientProjects([
      sitting(1, 7, 1, "completed", { imageUrl: "/ref.jpg" }),
      sitting(2, 7, 2, "completed"),
      sitting(3, 7, 9, "confirmed"),
      sitting(4, 7, 3, "cancelled"),
      sitting(9, null, 20, "confirmed"),
    ]);
    expect(back).toMatchObject({
      key: "plan:7",
      name: "Back piece",
      artist: "P Mason",
      image: "/ref.jpg",
      done: 2,
      total: 4,
      href: "/projects/12?session=3",
    });
    // A sitting without a proposal stands alone, named by its service.
    expect(single).toMatchObject({ key: "sitting:9", name: "Day session", done: 0, total: 1 });
  });

  it("counts a sitting once when it comes from both tabs", () => {
    const s = sitting(1, 7, 1, "completed");
    expect(clientProjects([s, s])[0].done).toBe(1);
  });

  it("puts tattoos with a sitting to come first, soonest first, then the most recent", () => {
    const order = clientProjects([
      sitting(1, 1, 1, "completed"),
      sitting(2, 2, 2, "completed"),
      sitting(3, 3, 20, "confirmed"),
      sitting(4, 4, 10, "confirmed"),
    ]).map(p => p.key);
    expect(order).toEqual(["plan:4", "plan:3", "plan:2", "plan:1"]);
  });
});

describe("discover artists", () => {
  const card = (id: number, artistId: string, extra: Record<string, unknown> = {}) => ({
    id,
    artistId,
    artistName: artistId === "a" ? "Ana Ink" : "Bo Lines",
    artistAvatar: null,
    artistCity: artistId === "a" ? "Brisbane" : null,
    artistSlug: artistId === "a" ? "anaink" : "bolines",
    keywords: [] as string[],
    tags: ["fineline"],
    imageUrl: `/p${id}.jpg`,
    mediaType: "image",
    ...extra,
  });

  it("shows each artist once with their newest picture", () => {
    const artists = discoverArtists([
      card(1, "a"),
      card(5, "a", { mediaType: "video" }),
      card(3, "a", { keywords: ["Realism", "Black & Grey"] }),
      card(2, "b"),
    ]);
    expect(artists).toHaveLength(2);
    expect(artists[0]).toMatchObject({
      name: "Ana Ink",
      slug: "anaink",
      city: "Brisbane",
      image: "/p3.jpg",
    });
    expect(artists[1].styles).toEqual(["fineline"]);
  });

  it("leaves out artists without a public page", () => {
    expect(discoverArtists([card(1, "a", { artistSlug: null })])).toEqual([]);
  });
});
