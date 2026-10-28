/* Tattoi Swipe — sample records and the business rules they follow.
   Rules mirror the codex/tattoi-ivory-design-system branch:
   shared/fees.ts, server/domain/paymentState.ts, shared/offerRules.ts,
   server/domain/waitlist.ts and app-v3/data/*. All money is in cents. */
(function () {
  "use strict";

  // ── Rules ─────────────────────────────────────────────────
  const TIERS = {
    free: { label: "Free", artistFee: 0.02, priceCents: 0, depositCustomisable: false, upfront: false },
    pro: { label: "Pro", artistFee: 0, priceCents: 9900, depositCustomisable: true, upfront: true },
    top: { label: "Studio", artistFee: 0, priceCents: 49900, depositCustomisable: true, upfront: true },
  };
  const PLATFORM_FEE = 0.034;
  const MIN_PLATFORM_FEE = 500;
  const FREE_DEPOSIT = 25;

  function fees(baseCents, tier) {
    const platform = Math.max(Math.round(baseCents * PLATFORM_FEE), MIN_PLATFORM_FEE);
    const artist = Math.round(baseCents * TIERS[tier].artistFee);
    return { base: baseCents, platform, artist, clientTotal: baseCents + platform, payout: baseCents - artist };
  }
  function depositPercent(S) {
    return TIERS[S.settings.tier].depositCustomisable ? S.settings.depositPct : FREE_DEPOSIT;
  }
  // Deposits for every sitting are bundled into one charge; each sitting then has its own balance.
  function split(dayRateCents, sittings, S) {
    const pct = depositPercent(S);
    const perSitting = Math.round(dayRateCents * (pct / 100));
    return {
      pct,
      depositPerSitting: perSitting,
      deposit: perSitting * sittings,
      balancePerSitting: dayRateCents - perSitting,
      total: dayRateCents * sittings,
    };
  }

  const FREQUENCIES = [
    ["consecutive", "Consecutive dates"],
    ["weekly", "Weekly"],
    ["biweekly", "Every two weeks"],
    ["monthly", "Monthly"],
  ];
  const STYLES = ["Fine line", "Blackwork", "Japanese", "Dotwork", "Geometric", "Traditional", "Neo-traditional", "Watercolour", "Realism", "Ornamental"];
  const PROJECT_TYPES = ["Full sleeve", "Half sleeve", "Back piece", "Chest piece", "Cover-up", "Small piece", "Touch-up", "Something else"];
  const PLACEMENTS = ["Forearm", "Upper arm", "Shoulder", "Chest", "Sternum", "Ribs", "Back", "Thigh", "Calf", "Ankle", "Hand", "Neck"];
  const SIZES = [
    ["Palm-sized", "Under 10 cm"],
    ["Hand-sized", "10–20 cm"],
    ["Large", "20–35 cm"],
    ["Extensive", "Wraps or covers an area"],
  ];
  const BUDGETS = ["Under $500", "$500–$1,000", "$1,000–$2,500", "$2,500–$5,000", "$5,000–$10,000", "$10,000+"];
  const TIMEFRAMES = ["As soon as possible", "Within 1–3 months", "Within 3–6 months", "6+ months from now", "I'm flexible"];
  const OFFER_TERMS = "Vouchers are non-refundable except where required by applicable law. Promotional discounts have no cash value and cannot be exchanged for cash.";
  const AFTERCARE = [
    { from: 0, to: 3, label: "Fresh", text: "Wash gently with unscented soap two or three times a day. Pat dry and apply a thin layer of balm." },
    { from: 4, to: 14, label: "Peeling", text: "Flaking and itching are normal. Don't pick or scratch. Keep it moisturised and out of pools and the sea." },
    { from: 15, to: 30, label: "Settling", text: "The skin can look cloudy while it settles. Keep it out of direct sun." },
    { from: 31, to: 60, label: "Healed", text: "Use SPF 50 whenever it sees the sun. Message your artist about a touch-up if anything looks patchy." },
  ];
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

  // ── Dates ─────────────────────────────────────────────────
  const DAY = 86400000;
  function at(dayOffset, h, m) {
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    d.setDate(d.getDate() + dayOffset);
    return d.getTime();
  }
  function startOfDay(t) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function sameDay(a, b) {
    return startOfDay(a) === startOfDay(b);
  }
  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  }
  function hm(str) {
    const [h, m] = str.split(":").map(Number);
    return { h, m };
  }

  let seq = 1000;
  const uid = (p) => p + (++seq).toString(36);

  // ── Sample records ────────────────────────────────────────
  function seed() {
    const S = {
      v: 6,
      role: null,
      pages: {},
      settings: {
        tier: "free",
        depositPct: 25,
        allowUpfront: false,
        rescheduleHours: 72,
        theme: "system",
        alerts: { messages: true, bookings: true, payments: true, updates: false },
        templates: [
          { id: "t1", name: "Deposit reminder", body: "Hi {name}, a quick reminder that your deposit secures your dates. You can pay it from your booking." },
          { id: "t2", name: "See you tomorrow", body: "Looking forward to tomorrow. Eat a good breakfast, drink water and wear something comfy." },
          { id: "t3", name: "Aftercare", body: "Your aftercare guide is in your booking. Message me any time if something doesn't look right." },
        ],
      },
      artist: {
        id: "a1",
        name: "Rory Vale",
        handle: "roryvale",
        studio: "Black Lantern Tattoo",
        address: "12 Ann Street, Fortitude Valley QLD 4006",
        city: "Brisbane",
        phone: "0412 556 210",
        email: "rory@blacklantern.example",
        licence: "QLD-TL-20418",
        bio: "Fine-line botanicals and soft blackwork. I draw every piece for the body it sits on, so bring photos of the area as well as your references.",
        styles: ["Fine line", "Blackwork", "Ornamental"],
        setup: { profile: false, location: true, hours: true, services: true, payouts: true },
        link: { enabled: true, welcome: "Tell me about your idea. I reply to every request within two working days.", views: 1284, requests: 46, steps: { references: true, placementPhoto: true } },
        instagram: { connected: false, imported: 0 },
        stripe: "ready",
        bank: null,
      },
      services: [
        { id: "s1", name: "Full-day tattoo", mins: 480, price: 200000, sittings: 1 },
        { id: "s2", name: "Half-day tattoo", mins: 240, price: 60000, sittings: 1 },
        { id: "s3", name: "Sleeve project", mins: 480, price: 100000, sittings: 6 },
        { id: "s4", name: "Small piece", mins: 120, price: 30000, sittings: 1 },
      ],
      hours: {
        mon: { on: false, start: "09:30", end: "17:30", breaks: [] },
        tue: { on: true, start: "09:30", end: "17:30", breaks: [{ start: "13:30", end: "14:00" }] },
        wed: { on: true, start: "09:30", end: "17:30", breaks: [{ start: "13:30", end: "14:00" }] },
        thu: { on: true, start: "09:30", end: "17:30", breaks: [{ start: "13:30", end: "14:00" }] },
        fri: { on: true, start: "09:30", end: "17:30", breaks: [{ start: "13:30", end: "14:00" }] },
        sat: { on: true, start: "10:00", end: "15:00", breaks: [] },
        sun: { on: false, start: "10:00", end: "15:00", breaks: [] },
      },
      travel: [{ id: "tr1", city: "Melbourne", place: "Guest spot at Rose & Ash", from: at(38, 0), to: at(42, 0) }],
      blocks: [{ id: "b1", title: "Personal: dentist", start: at(3, 8), mins: 60 }],

      // Everyone in the sample world.
      people: {
        a1: { id: "a1", role: "artist", name: "Rory Vale", city: "Brisbane", styles: ["Fine line", "Blackwork", "Ornamental"], handle: "roryvale", bio: "Fine-line botanicals and soft blackwork.", next: "Next opening in 9 days", x: 0.42, y: 0.46 },
        a2: { id: "a2", role: "artist", name: "Kenji Mori", city: "Gold Coast", styles: ["Japanese", "Neo-traditional"], handle: "kenji.ink", bio: "Irezumi-inspired large-scale work. Koi, peonies, waves and dragons.", next: "Books three months ahead", x: 0.56, y: 0.86 },
        a3: { id: "a3", role: "artist", name: "Sofia Reyes", city: "Brisbane", styles: ["Watercolour", "Fine line"], handle: "sofiareyes.tattoo", bio: "Soft colour washes held by fine linework.", next: "Next opening in 3 weeks", x: 0.16, y: 0.3 },
        a4: { id: "a4", role: "artist", name: "Hana Lee", city: "Byron Bay", styles: ["Dotwork", "Ornamental"], handle: "hana.dots", bio: "Mandalas and ornamental dotwork, hand-poked or machine.", next: "Guest spot in Brisbane next month", x: 0.88, y: 0.74 },
        a5: { id: "a5", role: "artist", name: "Theo Grant", city: "Brisbane", styles: ["Traditional", "Neo-traditional"], handle: "theograntflash", bio: "Bold lines, bright colour, flash days every month.", next: "Walk-ins on Saturdays", x: 0.66, y: 0.58 },
        a6: { id: "a6", role: "artist", name: "Ines Duarte", city: "Sunshine Coast", styles: ["Geometric", "Blackwork"], handle: "ines.geometry", bio: "Sacred geometry and solid blackwork for large areas.", next: "Next opening in 6 weeks", x: 0.1, y: 0.04 },
        a7: { id: "a7", role: "artist", name: "Callum Ward", city: "Brisbane", styles: ["Realism"], handle: "callumward.realism", bio: "Black and grey realism, portraits and textures.", next: "Next opening in 2 months", x: 0.78, y: 0.24 },
        c1: { id: "c1", role: "client", name: "Mia Chen", city: "Brisbane", email: "mia.chen@example.test", phone: "0400 118 302", birthday: "1994-10-29", status: "active" },
        c2: { id: "c2", role: "client", name: "Oliver James", city: "Brisbane", email: "oliver@example.test", phone: "0400 552 019", status: "active" },
        c3: { id: "c3", role: "client", name: "Priya Nair", city: "Brisbane", email: "priya@example.test", phone: "0400 883 271", status: "active" },
        c4: { id: "c4", role: "client", name: "Lena Fischer", city: "Ipswich", email: "lena@example.test", phone: "0400 201 774", status: "active" },
        c5: { id: "c5", role: "client", name: "Marcus Thorne", city: "Brisbane", email: "marcus@example.test", phone: "0400 330 128", status: "past" },
        c6: { id: "c6", role: "client", name: "Ava Morgan", city: "Logan", email: "ava@example.test", phone: "0400 671 905", status: "active" },
        c7: { id: "c7", role: "client", name: "Noah Williams", city: "Brisbane", email: "noah@example.test", phone: "0400 450 662", status: "past" },
        c8: { id: "c8", role: "client", name: "Elena Rodriguez", city: "Gold Coast", email: "elena@example.test", phone: "0400 908 113", status: "enquiry" },
        c9: { id: "c9", role: "client", name: "Jae Park", city: "Brisbane", email: "jae@example.test", phone: "0400 761 450", status: "enquiry" },
        c10: { id: "c10", role: "client", name: "Tom Okafor", city: "Redcliffe", email: "tom@example.test", phone: "0400 129 884", status: "enquiry" },
        c11: { id: "c11", role: "client", name: "Isla Brennan", city: "Brisbane", email: "isla@example.test", phone: "0400 640 301", status: "imported" },
        m1: { id: "m1", role: "supplier", name: "Ink & Iron Supply", contact: "Dana Price", city: "Melbourne" },
      },
      me: { client: "c1", supplier: "m1", artist: "a1" },
      favourites: ["a1", "a3"],
      saved: [],

      projects: [
        { id: "p1", artistId: "a1", clientId: "c1", name: "Botanical sleeve", service: "s3", style: "Fine line", placement: "Left arm", motif: "botanical", seed: "mia-sleeve", brief: "Eucalyptus, banksia and gum blossom winding from shoulder to wrist. Fine line with light whip shading. Leave negative space on the inner wrist.", refs: ["mia-ref-1", "mia-ref-2", "mia-ref-3"] },
        { id: "p2", artistId: "a1", clientId: "c2", name: "Geometric shoulder", service: "s1", style: "Geometric", placement: "Right shoulder", motif: "geo", seed: "oliver-geo", brief: "Hexagram cap with dotwork fade into the upper arm.", refs: ["oliver-ref-1"] },
        { id: "p3", artistId: "a1", clientId: "c3", name: "Fine-line peony", service: "s4", style: "Fine line", placement: "Inner forearm", motif: "botanical", seed: "priya-peony", brief: "Single peony with two buds, no shading.", refs: ["priya-ref-1"] },
        { id: "p4", artistId: "a1", clientId: "c4", name: "Moth on sternum", service: "s2", style: "Blackwork", placement: "Sternum", motif: "blackwork", seed: "lena-moth", brief: "Symmetrical death's-head moth with ornamental wings.", refs: ["lena-ref-1"] },
        { id: "p5", artistId: "a1", clientId: "c5", name: "Moon phases", service: "s2", style: "Dotwork", placement: "Spine", motif: "moons", seed: "marcus-moons", brief: "Seven phases down the spine, stippled.", refs: [] },
        { id: "p6", artistId: "a1", clientId: "c6", name: "Snake on calf", service: "s1", style: "Blackwork", placement: "Calf", motif: "blackwork", seed: "ava-snake", brief: "Coiled snake with a peony, wrapping the calf.", refs: ["ava-ref-1"] },
        { id: "p7", artistId: "a2", clientId: "c1", name: "Koi on forearm", service: "k1", style: "Japanese", placement: "Right forearm", motif: "waves", seed: "mia-koi", brief: "Single koi swimming up through waves.", refs: [] },
        { id: "p8", artistId: "a1", clientId: "c7", name: "Ornamental hand", service: "s4", style: "Ornamental", placement: "Hand", motif: "sacred", seed: "noah-hand", brief: "Ornamental filigree across the back of the hand.", refs: [] },
      ],
      appts: [],
      forms: [],
      convos: [],
      leads: [
        { id: "l1", clientId: "c8", project: "Half sleeve", styles: ["Japanese", "Fine line"], placement: "Upper arm", size: "Large", budget: "$2,500–$5,000", timeframe: "Within 1–3 months", idea: "A crane and peonies with soft wind bars, wrapping the upper arm. I'd like it to stay light and airy.", refs: ["elena-1", "elena-2"], placementPhoto: true, created: at(-2, 19, 40), status: "new" },
        { id: "l2", clientId: "c9", project: "Small piece", styles: ["Fine line"], placement: "Ankle", size: "Palm-sized", budget: "Under $500", timeframe: "As soon as possible", idea: "My grandmother's handwriting, the word 'always', with a small sprig of wattle.", refs: ["jae-1"], placementPhoto: false, created: at(-1, 8, 12), status: "new" },
        { id: "l3", clientId: "c10", project: "Cover-up", styles: ["Blackwork"], placement: "Forearm", size: "Hand-sized", budget: "$1,000–$2,500", timeframe: "Within 3–6 months", idea: "Covering a faded tribal band. Open to anything bold that will hide it well.", refs: ["tom-1"], placementPhoto: true, created: at(-5, 12, 5), status: "new" },
      ],
      tasks: [],
      txns: [],
      payouts: [],
      refunds: [],
      waitlist: [],
      offers: [
        { id: "o1", name: "Spring flash day", kind: "discount", valueType: "percentage", value: 15, eligibility: "new", funding: "gift", availableHours: 48, expiresAt: at(21, 23, 59), sittingMonths: [], colour: "stencil", archived: false, created: at(-6) },
        { id: "o2", name: "Gift voucher", kind: "voucher", valueType: "fixed", value: 20000, eligibility: "unpaid", funding: "sale", availableHours: null, expiresAt: null, validityYears: 3, sittingMonths: [], colour: "ink", archived: false, created: at(-40) },
        { id: "o3", name: "Birthday credit", kind: "voucher", valueType: "fixed", value: 5000, eligibility: "unpaid", funding: "gift", availableHours: null, expiresAt: at(60, 23, 59), validityYears: 3, sittingMonths: [], colour: "rose", archived: false, created: at(-20) },
      ],
      issued: [],
      suppliers: [
        { id: "m1", name: "Ink & Iron Supply", city: "Melbourne", category: "Inks, needles and hygiene", motif: "ink", linked: true, published: true },
        { id: "sp2", name: "Northline Needles", city: "Sydney", category: "Cartridges and machines", motif: "geo", linked: false, published: true },
        { id: "sp3", name: "Saltwater Pigments", city: "Byron Bay", category: "Colour ink", motif: "waves", linked: false, published: true },
        { id: "sp4", name: "Greenroom Aftercare", city: "Brisbane", category: "Aftercare and skincare", motif: "botanical", linked: true, published: true },
      ],
      products: [],
      cart: [],
      supplyOrders: [],
      shop: {
        products: [
          { id: "sh1", name: "Botanical flash print, A3", price: 4500, stock: 18, motif: "botanical" },
          { id: "sh2", name: "Healing balm, 50 g", price: 1800, stock: 6, motif: "product", variant: "tub" },
        ],
        events: [{ id: "e1", title: "Fine-line fundamentals", format: "In person", start: at(26, 10), price: 18000, seats: 12, registered: 7 }],
      },
      studio: null,
      store: { published: true, shopify: { connected: false, lastSync: null, importing: false }, stripe: "ready", business: { name: "Ink & Iron Supply", contact: "Dana Price", address: "4/18 Laurens Street, North Melbourne VIC 3051" } },
      purchases: [],
    };

    // ── Sittings ──
    // Future sample sittings land on the artist's working days, whatever day the prototype opens.
    const wd = (offset, h, m) => {
      let t = at(offset, h, m);
      while (!S.hours[DAY_KEYS[new Date(t).getDay()]].on) t += DAY;
      return t;
    };
    const A = (o) => {
      const a = Object.assign({ id: uid("ap"), artistId: "a1", status: "confirmed", paid: 0, forms: "signed", reschedule: null, arrived: false, finishedAt: null }, o);
      S.appts.push(a);
      return a;
    };
    // Mia: three-sitting botanical sleeve. Bundled deposit paid, sitting 1 balanced.
    A({ clientId: "c1", projectId: "p1", idx: 1, total: 3, start: at(-10, 9, 30), mins: 480, price: 100000, deposit: 25000, paid: 100000, status: "completed", finishedAt: at(-10, 17, 0) });
    A({ clientId: "c1", projectId: "p1", idx: 2, total: 3, start: wd(6, 9, 30), mins: 480, price: 100000, deposit: 25000, paid: 25000, forms: "pending" });
    A({ clientId: "c1", projectId: "p1", idx: 3, total: 3, start: wd(34, 9, 30), mins: 480, price: 100000, deposit: 25000, paid: 25000, forms: "pending" });
    // Today, placed around the current time so a sitting is under way whenever the prototype opens.
    const Q = 15 * 60000;
    const chair = Math.min(Math.max(Math.round((Date.now() - 40 * 60000) / Q) * Q, at(0, 8, 0)), at(0, 19, 30));
    A({ clientId: "c2", projectId: "p2", idx: 1, total: 2, start: chair, mins: 240, price: 60000, deposit: 15000, paid: 15000 });
    A({ clientId: "c2", projectId: "p2", idx: 2, total: 2, start: wd(28, 9, 30), mins: 240, price: 60000, deposit: 15000, paid: 15000 });
    if (chair - 150 * 60000 >= at(0, 8, 0)) A({ clientId: "c3", projectId: "p3", idx: 1, total: 1, start: chair - 150 * 60000, mins: 120, price: 30000, deposit: 7500, paid: 30000, status: "completed", finishedAt: chair - 30 * 60000, forms: "signed" });
    else A({ clientId: "c3", projectId: "p3", idx: 1, total: 1, start: chair + 270 * 60000, mins: 120, price: 30000, deposit: 7500, paid: 7500, forms: "pending" });
    // More of today: fill free slots around the sitting that's under way.
    const busy = S.appts.filter((a) => sameDay(a.start, Date.now())).map((a) => [a.start, a.start + a.mins * 60000]);
    const free = (t, mins) => !busy.some(([s0, e0]) => t < e0 + 15 * 60000 && t + mins * 60000 > s0 - 15 * 60000);
    [
      { clientId: "c11", projectId: "p9", h: 8, m: 0, mins: 90, price: 25000, label: "Wattle sprig" },
      { clientId: "c7", projectId: "p8", h: 10, m: 30, mins: 60, price: 0, label: "touch-up" },
      { clientId: "c9", projectId: "p10", h: 12, m: 30, mins: 120, price: 30000, label: "Handwriting script" },
      { clientId: "c5", projectId: "p5", h: 15, m: 30, mins: 90, price: 0, label: "touch-up" },
      { clientId: "c4", projectId: "p11", h: 17, m: 30, mins: 120, price: 30000, label: "Flash: swallow" },
      { clientId: "c6", projectId: "p12", h: 20, m: 0, mins: 60, price: 15000, label: "Flash: dagger" },
    ].forEach((x) => {
      const t = at(0, x.h, x.m);
      if (!free(t, x.mins)) return;
      busy.push([t, t + x.mins * 60000]);
      if (!S.projects.some((p) => p.id === x.projectId)) S.projects.push({ id: x.projectId, artistId: "a1", clientId: x.clientId, name: x.label, service: "s4", style: "Fine line", placement: "Forearm", motif: "botanical", seed: x.projectId, brief: "", refs: [] });
      const done = t + x.mins * 60000 < Date.now();
      A({ clientId: x.clientId, projectId: x.projectId, idx: 1, total: 1, start: t, mins: x.mins, price: x.price, deposit: Math.round(x.price * 0.25), paid: done ? x.price : Math.round(x.price * 0.25), status: done ? "completed" : "confirmed", finishedAt: done ? t + x.mins * 60000 : null, forms: "signed" });
    });
    // Lena: proposal sent, deposit not yet paid
    A({ clientId: "c4", projectId: "p4", idx: 1, total: 1, start: wd(11, 10, 0), mins: 240, price: 60000, deposit: 15000, paid: 0, status: "proposed", forms: "none" });
    // Marcus: finished three weeks ago
    A({ clientId: "c5", projectId: "p5", idx: 1, total: 1, start: at(-21, 10, 0), mins: 240, price: 60000, deposit: 15000, paid: 60000, status: "completed", finishedAt: at(-21, 14, 10) });
    // Ava: booked far out, on the waitlist for something sooner
    A({ clientId: "c6", projectId: "p6", idx: 1, total: 1, start: wd(47, 9, 30), mins: 480, price: 100000, deposit: 25000, paid: 25000, forms: "pending" });
    // Noah: done months ago
    A({ clientId: "c7", projectId: "p8", idx: 1, total: 1, start: at(-96, 11, 0), mins: 120, price: 30000, deposit: 7500, paid: 30000, status: "completed", finishedAt: at(-96, 13, 0) });
    // Rest of this fortnight
    A({ clientId: "c2", projectId: "p2", idx: 0, total: 0, start: wd(2, 11, 0), mins: 60, price: 0, deposit: 0, paid: 0, status: "confirmed", consult: true });
    // Kenji's proposal to Mia, waiting on her deposit
    A({ artistId: "a2", clientId: "c1", projectId: "p7", idx: 1, total: 2, start: at(19, 10, 0), mins: 360, price: 90000, deposit: 22500, paid: 0, status: "proposed", forms: "none" });
    A({ artistId: "a2", clientId: "c1", projectId: "p7", idx: 2, total: 2, start: at(33, 10, 0), mins: 360, price: 90000, deposit: 22500, paid: 0, status: "proposed", forms: "none" });

    const ap = (client, idx) => S.appts.find((a) => a.clientId === client && a.idx === idx && a.artistId === "a1");
    S.forms.push(
      { id: uid("f"), apptId: ap("c1", 2).id, clientId: "c1", artistId: "a1", kind: "Procedure consent", status: "pending" },
      { id: uid("f"), apptId: ap("c1", 2).id, clientId: "c1", artistId: "a1", kind: "Medical history", status: "pending" },
      { id: uid("f"), apptId: ap("c1", 1).id, clientId: "c1", artistId: "a1", kind: "Procedure consent", status: "signed", signedAt: at(-11, 18) },
      { id: uid("f"), apptId: ap("c3", 1).id, clientId: "c3", artistId: "a1", kind: "Procedure consent", status: ap("c3", 1).forms === "signed" ? "signed" : "pending", signedAt: at(-1, 19) },
      { id: uid("f"), apptId: ap("c2", 1).id, clientId: "c2", artistId: "a1", kind: "Procedure consent", status: "signed", signedAt: at(-1, 20) },
      { id: uid("f"), apptId: ap("c6", 1).id, clientId: "c6", artistId: "a1", kind: "Procedure consent", status: "pending" }
    );

    // ── Conversations ──
    const C = (o) => {
      const c = Object.assign({ id: uid("cv"), unread: {}, note: "", msgs: [] }, o);
      S.convos.push(c);
      return c;
    };
    const M = (c, from, text, when, extra) => c.msgs.push(Object.assign({ id: uid("m"), from, type: "text", text, at: when }, extra || {}));
    const mia = C({ a: "a1", b: "c1", projectId: "p1", note: "Prefers morning starts. Sensitive around the inner elbow, so plan a break before shading there." });
    M(mia, "c1", "Hi Rory! I've been wanting a botanical sleeve for years. Native flowers, fine line, nothing too heavy.", at(-40, 18, 2));
    M(mia, "a1", "Love that. Send me a few photos of your arm from the front and side so I can plan the flow.", at(-40, 19, 30));
    M(mia, "c1", "", at(-39, 9, 12), { type: "image", motif: "botanical", seed: "mia-ref-1" });
    M(mia, "a1", "", at(-38, 15, 0), { type: "proposal", proposal: { projectId: "p1", status: "accepted", service: "Sleeve project", sittings: 3 } });
    M(mia, "system", "Deposit paid, $750.00. Your three sittings are confirmed.", at(-37, 8, 41), { type: "system" });
    M(mia, "a1", "Sitting one done! Your aftercare guide is in your booking.", at(-10, 17, 5));
    M(mia, "c1", "It's healing beautifully. Could we add a few more gum leaves around the elbow next time?", at(-1, 21, 14));
    mia.unread = { a1: 1 };
    const oliver = C({ a: "a1", b: "c2", projectId: "p2" });
    M(oliver, "a1", "See you tomorrow at 9:30. Eat a good breakfast!", at(-1, 16, 0));
    M(oliver, "c2", "Will do. Running about five minutes behind on the bus, sorry.", at(0, 8, 51));
    oliver.unread = { a1: 1 };
    const priya = C({ a: "a1", b: "c3", projectId: "p3" });
    M(priya, "a1", "Your consent form is ready in your booking. Please sign it before you come in.", at(-1, 11, 0));
    const lena = C({ a: "a1", b: "c4", projectId: "p4" });
    M(lena, "c4", "Here's the moth reference I mentioned.", at(-4, 13, 22), { type: "image", motif: "blackwork", seed: "lena-ref-1" });
    M(lena, "a1", "", at(-3, 10, 0), { type: "proposal", proposal: { projectId: "p4", status: "pending", service: "Half-day tattoo", sittings: 1 } });
    const marcus = C({ a: "a1", b: "c5", projectId: "p5" });
    M(marcus, "c5", "Is it normal for the middle phase to look a bit cloudy?", at(-2, 20, 30));
    marcus.unread = { a1: 1 };
    const ava = C({ a: "a1", b: "c6", projectId: "p6" });
    M(ava, "c6", "I joined the waitlist in case anything opens up before December.", at(-8, 9, 0));
    const kenji = C({ a: "a2", b: "c1", projectId: "p7" });
    M(kenji, "c1", "Hi Kenji, I'd love a koi on my right forearm.", at(-6, 12, 0));
    M(kenji, "a2", "", at(-2, 14, 0), { type: "proposal", proposal: { projectId: "p7", status: "pending", service: "Large-scale sitting", sittings: 2 } });
    kenji.unread = { c1: 1 };
    const supply = C({ a: "a1", b: "m1", kind: "supplier" });
    M(supply, "m1", "Thanks for the order! The 0.30 mm liners are back in stock on Thursday.", at(-3, 10, 0));
    M(supply, "a1", "Perfect, I'll add them to my next order.", at(-3, 10, 22));
    const ironbark = C({ a: "ironbark", b: "m1", kind: "supplier", name: "Ironbark Studio" });
    M(ironbark, "ironbark", "Can you split our order into two deliveries? Half to the Newtown studio.", at(-1, 15, 0));
    ironbark.unread = { m1: 1 };

    // ── Waitlist ──
    S.waitlist.push(
      { id: uid("w"), artistId: "a1", clientId: "c6", projectId: "p6", joined: at(-8, 9), status: "waiting", offer: null },
      { id: uid("w"), artistId: "a1", clientId: "c1", projectId: "p1", joined: at(-3, 19), status: "waiting", offer: null }
    );

    // ── Money ──
    const T = (clientId, kind, base, daysAgo, extra) => S.txns.push(Object.assign({ id: uid("tx"), artistId: "a1", clientId, kind, base, at: at(-daysAgo, 11), status: "paid", tier: "free" }, extra || {}));
    T("c1", "Deposit", 75000, 37);
    T("c1", "Balance", 75000, 10);
    T("c2", "Deposit", 30000, 9);
    T("c3", "Deposit", 7500, 6);
    T("c5", "Deposit", 15000, 30);
    T("c5", "Balance", 45000, 21);
    T("c6", "Deposit", 25000, 8);
    T("c7", "Balance", 22500, 96);
    T("c11", "Gift voucher", 20000, 14, { note: "Bought for a friend" });
    if (ap("c3", 1).status === "completed") T("c3", "Balance", 22500, 0);
    S.payouts.push(
      { id: uid("po"), amount: 146300, at: at(-9), status: "paid" },
      { id: uid("po"), amount: 52100, at: at(-2), status: "paid" },
      { id: uid("po"), amount: 31850, at: at(1), status: "in_transit" }
    );

    // ── A busy book: full days at $2,000, three or four days a week, eight weeks back and two months ahead ──
    const extra = [["c12", "Hugo Laurent", "Sydney"], ["c13", "Zara Ahmed", "Brisbane"], ["c14", "Ben Kowalski", "Toowoomba"], ["c15", "Maya Patel", "Brisbane"], ["c16", "Leo Martins", "Gold Coast"], ["c17", "Chloe Tan", "Brisbane"]];
    extra.forEach(([id, name, city]) => (S.people[id] = { id, role: "client", name, city, email: name.split(" ")[0].toLowerCase() + "@example.test", phone: "0400 " + (100 + id.length * 37) + " " + (300 + Number(id.slice(1)) * 11), status: "active" }));
    const big = [
      ["c12", "Japanese back piece", "Back", "waves"], ["c13", "Botanical half sleeve", "Upper arm", "botanical"], ["c14", "Blackwork thigh", "Thigh", "blackwork"],
      ["c15", "Fine-line ribs", "Ribs", "botanical"], ["c16", "Ornamental chest", "Chest", "sacred"], ["c17", "Peony calf", "Calf", "botanical"],
      ["c2", "Geometric shoulder", "Right shoulder", "geo"], ["c8", "Crane half sleeve", "Upper arm", "waves"],
    ].map(([clientId, name, placement, motif], i) => {
      const id = "pb" + i;
      S.projects.push({ id, artistId: "a1", clientId, name, service: "s1", style: "Fine line", placement, motif, seed: id, brief: "", refs: [] });
      return { id, clientId, n: 0 };
    });
    const DAY_RATE = 200000;
    const takenDay = (t) => S.appts.some((a) => a.artistId === "a1" && sameDay(a.start, t));
    let k = 0;
    for (let w = -8; w <= 9; w++) {
      const monday = startOfDay(Date.now()) - ((new Date().getDay() + 6) % 7) * DAY + w * 7 * DAY;
      const want = (w + 20) % 3 === 0 ? 3 : 4;
      let placed = 0;
      for (const dow of [1, 3, 2, 4, 0, 5]) {
        if (placed >= want) break;
        const t0 = monday + dow * DAY;
        const d = new Date(t0);
        if (!S.hours[DAY_KEYS[d.getDay()]].on || sameDay(t0, Date.now()) || takenDay(t0)) continue;
        if (t0 > Date.now() + 63 * DAY) continue;
        const start = new Date(t0).setHours(9, 30, 0, 0);
        const p = big[k++ % big.length];
        p.n++;
        const past = start < Date.now();
        const dep = Math.round(DAY_RATE * 0.25);
        A({ clientId: p.clientId, projectId: p.id, idx: p.n, total: 0, start, mins: 480, price: DAY_RATE, deposit: dep, paid: past ? DAY_RATE : dep, status: past ? "completed" : "confirmed", finishedAt: past ? start + 480 * 60000 : null, forms: past ? "signed" : "pending" });
        const daysAgoStart = Math.round((Date.now() - start) / DAY);
        T(p.clientId, "Deposit", dep, Math.max(1, daysAgoStart + 14));
        if (past) T(p.clientId, "Balance", DAY_RATE - dep, Math.max(0, daysAgoStart));
        placed++;
      }
    }
    // Sitting counts per project, now that every date is known.
    big.forEach((p) => S.appts.filter((a) => a.projectId === p.id).sort((a, b) => a.start - b.start).forEach((a, i, all) => { a.idx = i + 1; a.total = all.length; }));
    // Weekly payouts of what was earned, the latest still on its way.
    for (let w = 8; w >= 1; w--) S.payouts.push({ id: uid("po"), amount: 790000 + ((w * 37) % 5) * 40000, at: at(-w * 7 + 2), status: "paid" });

    // ── Offers issued ──
    S.issued.push(
      { id: uid("i"), offerId: "o3", clientId: "c1", code: "BDAY-MIA50", remaining: 5000, status: "active", at: at(-3), from: "artist" },
      { id: uid("i"), offerId: "o1", clientId: "c7", code: "FLASH-7QK2", remaining: null, status: "active", at: at(-5), from: "artist" },
      { id: uid("i"), offerId: "o2", clientId: "c11", code: "GIFT-RV8D", remaining: 20000, status: "active", at: at(-14), from: "purchase" }
    );

    // ── Supplier catalogues ──
    const P = (supplierId, name, category, variant, variants, min) =>
      S.products.push({ id: uid("pr"), supplierId, name, category, variant, min: min || 8, variants: variants.map(([n, price, stock]) => ({ id: uid("v"), name: n, price, stock })), published: true });
    P("m1", "Lining black ink", "Ink", "bottle", [["30 ml", 1600, 42], ["120 ml", 3400, 6]]);
    P("m1", "Round liner cartridges", "Needles", "box", [["3RL 0.30 mm, box of 20", 4200, 0], ["5RL 0.35 mm, box of 20", 4200, 24], ["9RL 0.35 mm, box of 20", 4400, 15]]);
    P("m1", "Magnum shader cartridges", "Needles", "box", [["9M1, box of 20", 4400, 31], ["13RM, box of 20", 4600, 4]]);
    P("m1", "Nitrile gloves", "Hygiene", "gloves", [["Small, 100", 1800, 60], ["Medium, 100", 1800, 5], ["Large, 100", 1800, 44]]);
    P("m1", "Barrier film roll", "Hygiene", "roll", [["1200 sheets", 2900, 22]]);
    P("m1", "Thermal stencil paper", "Stencils", "box", [["100 sheets", 3800, 12]]);
    P("m1", "Wireless pen machine", "Machines", "pen", [["3.5 mm stroke", 52000, 3]], 2);
    P("m1", "Healing balm", "Aftercare", "tub", [["50 g", 1400, 80]]);
    P("sp2", "Ultra-thin liner cartridges", "Needles", "box", [["1RL, box of 20", 4800, 30], ["3RL, box of 20", 4800, 18]]);
    P("sp2", "Rotary pen machine", "Machines", "pen", [["4.0 mm stroke", 61000, 7]]);
    P("sp3", "Saltwater colour set", "Ink", "bottle", [["12 × 30 ml", 21000, 9]]);
    P("sp3", "Ochre and rust", "Ink", "bottle", [["30 ml", 1900, 25]]);
    P("sp4", "Second-skin film", "Aftercare", "roll", [["15 cm × 2 m", 3600, 40]]);
    P("sp4", "Fragrance-free wash", "Aftercare", "bottle", [["250 ml", 1500, 70]]);

    const pr = (name) => S.products.find((p) => p.name === name);
    const O = (buyer, buyerName, items, daysAgo, status) => {
      const lines = items.map(([name, vi, qty]) => {
        const p = pr(name), v = p.variants[vi];
        return { productId: p.id, variantId: v.id, name: p.name, variantName: v.name, qty, price: v.price };
      });
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      S.supplyOrders.push({ id: uid("so"), number: 1040 + S.supplyOrders.length, supplierId: "m1", buyerId: buyer, buyerName, items: lines, subtotal, shipping: 1200, total: subtotal + 1200, at: at(-daysAgo, 10), status });
    };
    O("a1", "Rory Vale, Black Lantern Tattoo", [["Lining black ink", 1, 2], ["Nitrile gloves", 1, 3]], 12, "delivered");
    O("ironbark", "Ironbark Studio", [["Magnum shader cartridges", 0, 4], ["Barrier film roll", 0, 2]], 1, "paid");
    O("saint", "Saint & Sparrow Tattoo", [["Wireless pen machine", 0, 1]], 0, "paid");
    O("a1", "Rory Vale, Black Lantern Tattoo", [["Round liner cartridges", 1, 2], ["Thermal stencil paper", 0, 1]], 4, "fulfilled");

    S.purchases.push({ id: uid("pu"), kind: "Gift voucher", name: "Gift voucher for Rory Vale", amount: 20000, at: at(-14), status: "Paid" });

    buildTasks(S);
    return S;
  }

  // Attention tasks are derived from the records, the way the app's task engine does it.
  function buildTasks(S) {
    const keep = new Map((S.tasks || []).map((t) => [t.key, t]));
    const tasks = [];
    const add = (key, o) => {
      const prev = keep.get(key);
      if (prev && (prev.done || (prev.snoozedUntil && prev.snoozedUntil > Date.now()))) {
        tasks.push(prev);
        return;
      }
      tasks.push(Object.assign({ key, done: false, snoozedUntil: null }, o));
    };
    const name = (id) => (S.people[id] || {}).name || "Client";
    const first = (id) => name(id).split(" ")[0];
    S.leads.filter((l) => l.status === "new" && (l.artistId || "a1") === "a1").forEach((l) => {
      const age = daysBetween(l.created, Date.now());
      add("lead:" + l.id, { kind: "request", title: `Reply to ${name(l.clientId)}`, context: `${l.project}, ${l.budget}. Requested ${age === 0 ? "today" : age === 1 ? "yesterday" : age + " days ago"}.`, clientId: l.clientId, leadId: l.id, cold: age > 14 });
    });
    S.appts.filter((a) => a.artistId === "a1" && a.status === "proposed").forEach((a) => {
      add("deposit:" + a.projectId, { kind: "deposit", title: `${first(a.clientId)} hasn't paid the deposit`, context: `Proposal for ${projectName(S, a.projectId)} sent. Dates aren't held until it's paid.`, clientId: a.clientId, projectId: a.projectId });
    });
    S.forms.filter((f) => f.artistId === "a1" && f.status === "pending").forEach((f) => {
      const a = S.appts.find((x) => x.id === f.apptId);
      if (!a || daysBetween(Date.now(), a.start) > 7 || a.start < startOfDay(Date.now())) return;
      add("form:" + f.apptId, { kind: "form", title: `${first(f.clientId)} needs to sign a consent form`, context: `${sittingLabel(a)}, ${fmtRel(a.start)}.`, clientId: f.clientId, apptId: a.id });
    });
    S.appts.filter((a) => a.artistId === "a1" && a.status === "completed" && a.finishedAt && daysBetween(a.finishedAt, Date.now()) <= 1).forEach((a) => {
      if (a.paid < a.price) add("balance:" + a.id, { kind: "balance", title: `Collect ${first(a.clientId)}'s balance`, context: `${money(a.price - a.paid)} outstanding after today's sitting.`, clientId: a.clientId, apptId: a.id });
    });
    S.convos.filter((c) => c.a === "a1" && (c.unread.a1 || 0) > 0).forEach((c) => {
      const last = c.msgs[c.msgs.length - 1];
      if (last && last.from !== "a1") add("reply:" + c.id + ":" + last.id, { kind: "reply", title: `${first(c.b)} is waiting on a reply`, context: `“${last.text.slice(0, 70)}${last.text.length > 70 ? "…" : ""}”`, clientId: c.b, convoId: c.id });
    });
    S.waitlist.filter((w) => w.artistId === "a1" && w.status === "waiting").forEach((w) => {
      add("wait:" + w.id, { kind: "waitlist", title: `${first(w.clientId)} wants an earlier sitting`, context: `On your cancellation waitlist for ${projectName(S, w.projectId)}.`, clientId: w.clientId, waitId: w.id, quiet: true });
    });
    S.leads.filter((l) => l.status === "quoted").forEach((l) => add("cold:" + l.id, { kind: "request", title: `Follow up with ${name(l.clientId)}`, context: "No reply since you sent dates.", clientId: l.clientId, cold: true }));
    const lowStock = 0;
    if (!S.artist.setup.payouts) add("setup:payouts", { kind: "setup", title: "Connect payouts", context: "Deposits are held until you add a bank account for payouts.", quiet: true });
    S.tasks = tasks.concat(lowStock ? [] : []);
    // A cold follow-up so the "Gone quiet" group has something real in it.
    if (!S.tasks.some((t) => t.key === "cold:noah")) S.tasks.push(keep.get("cold:noah") || { key: "cold:noah", kind: "followup", title: "Check in with Noah Williams", context: "Healed photos were due 10 weeks ago. Offer a free touch-up check.", clientId: "c7", cold: true, done: false });
  }

  // ── Formatting ────────────────────────────────────────────
  function money(cents, opts) {
    const neg = cents < 0;
    const v = Math.abs(cents) / 100;
    const whole = opts && opts.whole;
    const s = v.toLocaleString("en-AU", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
    return (neg ? "−$" : "$") + s;
  }
  function fmtDate(t, o) {
    return new Date(t).toLocaleDateString("en-AU", Object.assign({ weekday: "short", day: "numeric", month: "short" }, o || {}));
  }
  function fmtTime(t) {
    return new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
  }
  function fmtRel(t) {
    const d = daysBetween(Date.now(), t);
    if (d === 0) return "today at " + fmtTime(t);
    if (d === 1) return "tomorrow at " + fmtTime(t);
    if (d === -1) return "yesterday";
    if (d > 1 && d < 7) return new Date(t).toLocaleDateString("en-AU", { weekday: "long" }) + " at " + fmtTime(t);
    if (d < 0) return -d + " days ago";
    return fmtDate(t);
  }
  function fmtAgo(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "now";
    if (m < 60) return m + " min";
    const h = Math.round(m / 60);
    if (h < 24) return h + " h";
    const d = Math.round(h / 24);
    if (d < 7) return d + " d";
    return fmtDate(t, { weekday: undefined });
  }
  function duration(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + " h" : "") + (h && m ? " " : "") + (m ? m + " min" : "");
  }
  function projectName(S, id) {
    const p = S.projects.find((x) => x.id === id);
    return p ? p.name : "Tattoo project";
  }
  function sittingLabel(a) {
    if (a.consult) return "Consultation";
    return a.total > 1 ? `Sitting ${a.idx} of ${a.total}` : "Single sitting";
  }

  // ── Availability (simplified from shared/bookingAvailability.ts) ──
  function workable(S, dayTime, mins, ignoreId) {
    const d = new Date(dayTime);
    const day = S.hours[DAY_KEYS[d.getDay()]];
    if (!day || !day.on) return null;
    const { h, m } = hm(day.start);
    const start = new Date(d);
    start.setHours(h, m, 0, 0);
    const end = hm(day.end);
    const endT = new Date(d);
    endT.setHours(end.h, end.m, 0, 0);
    const avail = (endT - start) / 60000 - day.breaks.reduce((s, b) => s + (hm(b.end).h * 60 + hm(b.end).m - hm(b.start).h * 60 - hm(b.start).m), 0);
    if (avail < Math.min(mins, 420)) return null;
    const away = S.travel.some((t) => start.getTime() >= startOfDay(t.from) && start.getTime() <= startOfDay(t.to) + DAY - 1);
    if (away) return null;
    const clash = S.appts.some((a) => a.artistId === "a1" && a.id !== ignoreId && !["cancelled", "no-show"].includes(a.status) && sameDay(a.start, start.getTime()));
    if (clash) return null;
    return start.getTime();
  }
  function suggestDates(S, fromTime, frequency, count, mins) {
    const out = [];
    let cursor = startOfDay(fromTime);
    let guard = 0;
    while (out.length < count && guard++ < 400) {
      const ok = workable(S, cursor, mins);
      if (ok && ok > Date.now()) {
        out.push(ok);
        const d = new Date(cursor);
        if (frequency === "consecutive") d.setDate(d.getDate() + 1);
        else if (frequency === "weekly") d.setDate(d.getDate() + 7);
        else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
        else d.setMonth(d.getMonth() + 1);
        cursor = d.getTime();
      } else {
        cursor += DAY;
      }
    }
    return out;
  }
  // Every frequency must produce the complete project; unavailable choices are left out.
  function feasibleFrequencies(S, fromTime, count, mins) {
    if (count <= 1) return [];
    return FREQUENCIES.filter(([f]) => {
      const d = suggestDates(S, fromTime, f, count, mins);
      return d.length === count && d[d.length - 1] - d[0] < 400 * DAY;
    }).map(([f]) => f);
  }

  // ── Project helpers (from app-v3/data/projectProgress.ts) ──
  const inactive = new Set(["completed", "cancelled", "no-show"]);
  function projectSittings(S, projectId) {
    return S.appts.filter((a) => a.projectId === projectId && !a.consult).sort((a, b) => (a.idx || 99) - (b.idx || 99) || a.start - b.start);
  }
  function nextSitting(sittings) {
    const active = sittings.filter((s) => !inactive.has(s.status)).sort((a, b) => a.start - b.start);
    return active.find((s) => s.start + s.mins * 60000 > Date.now()) || active[0];
  }
  function progress(sittings) {
    const completed = sittings.filter((s) => s.status === "completed").length;
    const totals = [...new Set(sittings.map((s) => s.total).filter(Boolean))];
    const total = totals.length === 1 && totals[0] >= sittings.length ? totals[0] : null;
    return { completed, total, remaining: total === null ? null : total - completed, cancelled: sittings.filter((s) => s.status === "cancelled").length, missed: sittings.filter((s) => s.status === "no-show").length };
  }
  function projectMoney(sittings) {
    const live = sittings.filter((s) => s.status !== "cancelled");
    const total = live.reduce((s, a) => s + a.price, 0);
    const paid = live.reduce((s, a) => s + a.paid, 0);
    return { total, paid, outstanding: Math.max(0, total - paid) };
  }
  function aftercareFor(S, clientId) {
    const done = S.appts.filter((a) => a.clientId === clientId && a.status === "completed" && a.finishedAt).sort((a, b) => b.finishedAt - a.finishedAt)[0];
    if (!done) return null;
    const day = daysBetween(done.finishedAt, Date.now());
    if (day > 60) return null;
    const phase = AFTERCARE.find((p) => day >= p.from && day <= p.to) || AFTERCARE[AFTERCARE.length - 1];
    return { appt: done, day, phase, phases: AFTERCARE };
  }

  // ── Persistence ───────────────────────────────────────────
  const KEY = "tattoi-swipe-v6";
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const S = JSON.parse(raw);
        if (S && S.v === 6) {
          seq = Math.max(seq, S.seq || 0);
          return S;
        }
      }
    } catch (e) {
      /* storage unavailable: start fresh */
    }
    return seed();
  }
  function save(S) {
    try {
      S.seq = seq;
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      /* the prototype still works without storage */
    }
  }
  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    return seed();
  }

  window.Data = {
    TIERS, PLATFORM_FEE, MIN_PLATFORM_FEE, FREE_DEPOSIT, FREQUENCIES, STYLES, PROJECT_TYPES, PLACEMENTS, SIZES, BUDGETS, TIMEFRAMES, OFFER_TERMS, AFTERCARE, DAY_KEYS, DAY_NAMES, DAY,
    fees, split, depositPercent, at, startOfDay, sameDay, daysBetween, uid,
    money, fmtDate, fmtTime, fmtRel, fmtAgo, duration, projectName, sittingLabel,
    suggestDates, feasibleFrequencies, workable,
    projectSittings, nextSitting, progress, projectMoney, aftercareFor, buildTasks,
    load, save, reset,
  };
})();
