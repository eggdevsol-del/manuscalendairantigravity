import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdir, writeFile, readFile } from "node:fs/promises";
const appVersion = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8")
).version;
const out = process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-workspace-check";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AUDIT_BROWSER
    ? { executablePath: process.env.AUDIT_BROWSER }
    : {}),
});
const results = [];
const calls = new Set();
const artist = {
  id: "artist-test",
  name: "Ella Morgan",
  role: "artist",
  hasCompletedOnboarding: 1,
};
const client = {
  id: "client-test",
  name: "Mia Chen",
  role: "client",
  hasCompletedOnboarding: 1,
};
const appointment = {
  id: 101,
  conversationId: 12,
  artistId: artist.id,
  clientId: client.id,
  clientName: client.name,
  client,
  artist,
  title: "Botanical sleeve",
  serviceName: "Full day",
  startTime: "2026-09-10T00:00:00Z",
  endTime: "2026-09-10T03:00:00Z",
  timeZone: "Australia/Brisbane",
  status: "confirmed",
  price: 600,
  sessionIndex: 2,
  sessionTotal: 3,
  totalExpectedAmountCents: 60000,
  totalPaidAmountCents: 15000,
  remainingBalanceCents: 45000,
  paymentStatus: "deposit_paid",
  depositPaid: 1,
};
const summary = {
  conversationId: 12,
  artist,
  client,
  location: "Northside Studio, Brisbane",
  sessions: [
    {
      ...appointment,
      startsAt: appointment.startTime,
      endsAt: appointment.endTime,
      estimateCents: 60000,
      paidCents: 15000,
      remainingCents: 45000,
    },
  ],
  forms: [
    {
      id: 7,
      appointmentId: 101,
      title: "Procedure consent",
      status: "pending",
    },
  ],
  plans: [
    { id: 11, status: "pending", estimateCents: 60000, depositCents: 15000 },
  ],
  history: [],
  briefs: [
    {
      id: 1,
      description:
        "Fine-line botanicals, extending the existing forearm piece.",
      placement: "Forearm",
      images: [],
    },
  ],
};
const plan = {
  id: 11,
  conversationId: 12,
  artist,
  status: "pending",
  items: [
    {
      id: 1,
      startsAt: appointment.startTime,
      endsAt: appointment.endTime,
      sessionIndex: 1,
      durationMinutes: 180,
      depositCents: 15000,
      serviceName: "Full day",
      priceCents: 60000,
    },
  ],
  depositTotalCents: 15000,
  platformFeeCents: 510,
  totalEstimateCents: 60000,
};
function response(name, role, test) {
  if (name === "funnel.getLead")
    return {
      id: 501,
      clientName: client.name,
      clientEmail: "fixture@example.invalid",
      status: "new",
      projectDescription: "Botanical sleeve reference",
      conversationId: 12,
      stylePreferences: ["Fine Line"],
      referenceImages: [],
      bodyPlacementImages: [],
    };
  if (name === "storefront.getArtistStorefront")
    return {
      artistId: artist.id,
      artistName: artist.name,
      currency: "AUD",
      products: [
        {
          id: 201,
          artistId: artist.id,
          title: "Aftercare balm",
          description: "Gentle balm for tattoo aftercare",
          priceCents: 2500,
          inventoryCount: 10,
          shippingCents: 500,
          fulfillmentType: "both",
          variants: [],
        },
      ],
      seminars: [],
    };
  if (
    name === "storefront.getPublicSeminars" ||
    name === "storefront.getSeminars"
  )
    return [
      {
        id: 301,
        title: "Fine line workshop",
        description: "Small group workshop",
        date: "2026-10-01T00:00:00Z",
        type: "in_person",
        capacity: 10,
        ticketsSold: 2,
        priceCents: 15000,
        locationUrl: "Northside Studio",
      },
    ];
  if (name === "feed.getDiscoverFeed")
    return {
      cards: [
        {
          id: 401,
          artistName: artist.name,
          artistSlug: "ella",
          artistCity: "Brisbane",
          imageUrl: "/icons/icon-192.png",
          description: "Fine line botanicals",
        },
      ],
      nextCursor: null,
    };
  if (name === "storefront.getOrderStatus")
    return { status: "paid", eventAccess: [] };

  if (name === "funnel.getArtistBySlug")
    return { slug: "ella", hasProducts: false, hasSeminars: false };
  if (name === "studios.getStudioProfile")
    return {
      studio: {
        name: "Northside Studio",
        description: "A calm space for your next tattoo",
      },
      artists: [{ ...artist, publicSlug: "ella" }],
    };
  if (name === "forms.getTemplates")
    return {
      medical: "1. Any medical conditions?",
      consent: "I have reviewed this procedure.",
    };
  if (name === "instagram.getLatestImport") return null;
  if (name === "instagram.verifyUsername")
    return {
      success: true,
      userInfo: { username: "ella", fullName: "Ella Morgan", mediaCount: 25 },
    };
  if (name === "funnel.getPaymentRequestInfo")
    return test === "payment-paid"
      ? { error: "already_paid" }
      : {
          requestId: 1,
          amountCents: 15000,
          status: "pending",
          artistName: artist.name,
          serviceName: "Botanical sleeve",
          sessionDate: appointment.startTime,
          fees: { platformFeeCents: 510, clientTotalCents: 15510 },
        };
  if (name === "funnel.getDepositInfo")
    return {
      status: "deposit_pending",
      artistName: artist.name,
      depositAmount: 15000,
      platformFeeCents: 510,
      clientTotalCents: 15510,
      paymentMethods: { stripe: true, bank: false, cash: false },
    };
  if (name === "funnel.getBalanceInfo")
    return {
      status: "pending",
      artistName: artist.name,
      remainingBalanceCents: 45000,
      platformFeeCents: 1530,
      clientTotalCents: 46530,
      paymentMethods: { stripe: true, bank: false, cash: false },
    };
  if (name === "payouts.payoutHistory")
    return {
      connected: true,
      payouts: [],
      entries: [
        {
          id: 1,
          type: "deposit",
          amountCents: 15000,
          platformFeeCents: 510,
          artistFeeCents: 1500,
          clientName: client.name,
          createdAt: appointment.startTime,
          stripePaymentId: "pi_fixture",
        },
      ],
      hasMore: false,
    };
  if (name === "payouts.refundPreview")
    return {
      amountCents: 15510,
      currency: "aud",
      sessionCount: 2,
      alreadyRefundedCents: 0,
    };
  if (name === "payouts.refundTransaction")
    return {
      success: true,
      amountCents: 15510,
      currency: "aud",
      status: "succeeded",
    };

  if (name === "artistSettings.getStripeConnectStatus")
    return {
      connected: true,
      statusAvailable: true,
      accountType: "custom",
      chargesEnabled: true,
      payoutsEnabled: true,
      currentlyDue: [],
      pendingVerification: false,
    };
  if (name === "artistSettings.getPayoutSchedule")
    return {
      currency: "nzd",
      availableBalance: 25000,
      pendingBalance: 14000,
      interval: "weekly",
      weeklyAnchor: "friday",
      monthlyAnchor: 12,
      delayDays: 2,
      payoutsEnabled: true,
      bankLast4: "1234",
    };
  if (name === "billing.subscriptionStatus")
    return {
      tier: "free",
      tierLabel: "Free",
      stripeSubscriptionId: null,
      renewalDate: null,
    };
  if (name === "billing.artistOffer")
    return { amountCents: 9900, currency: "aud" };
  if (name === "billing.studioOffer")
    return {
      amountCents: 49900,
      currency: "aud",
      interval: "month",
      intervalCount: 1,
    };
  if (name === "studios.getCurrentStudio" && test.startsWith("studio"))
    return {
      id: "studio-fixture",
      name: "Northside Studio",
      role: "owner",
      ownerId: artist.id,
      stripeSubscriptionId: "sub_fixture",
      subscriptionStatus: "active",
    };
  if (name === "studios.getStudioMembers")
    return [
      { id: "member-fixture", user: artist, role: "owner", status: "active" },
    ];
  if (name === "appointments.getStudioCalendar") return [appointment];
  if (name === "funnel.getFunnelSettings")
    return { publicSlug: "ella", funnelEnabled: true };
  if (name === "funnel.checkSlugAvailability") return { available: true };

  if (name === "booking.checkAvailability")
    return { dates: ["2026-09-14T00:00:00Z"], totalCost: 600 };
  if (name === "feed.getPublicArtistProfile")
    return {
      id: artist.id,
      slug: "ella",
      displayName: artist.name,
      avatar: null,
      bio: "Fine-line tattoos in Brisbane",
      showCity: true,
      city: "Brisbane",
      keywords: ["Fine Line"],
      portfolio: [],
    };
  if (name === "funnel.submitPublicBooking")
    return {
      leadToken: "fixture-lead",
      existingUser: test === "public-existing",
      conversationId: 12,
      success: true,
    };
  if (name === "merchantAuth.getDashboardStats")
    return {
      pendingOrders: 2,
      lowStockItems: 1,
      revenueCents: 56000,
      totalProducts: 3,
      totalOrders: 4,
    };
  if (name === "merchantAuth.getMerchantProfile")
    return {
      id: 1,
      businessName: "Example Supply",
      country: "AU",
      status: "active",
    };
  if (name === "merchantAuth.getMerchantStripeStatus")
    return { connected: true, chargesEnabled: true, payoutsEnabled: true };
  if (name === "storefront.getProducts") return [];
  if (name === "projects.clientWorkspace")
    return {
      client,
      conversationId: 12,
      sessions: [{ ...appointment, paidCents: 15000 }],
      forms: summary.forms,
      notes: [],
    };
  if (name === "conversations.getById")
    return {
      id: 12,
      artistId: artist.id,
      clientId: client.id,
      otherUser: role === "client" ? artist : client,
    };
  if (name === "messages.list")
    return [
      {
        id: 1,
        conversationId: 12,
        senderId: client.id,
        content: "Looking forward to the session",
        messageType: "text",
        createdAt: "2026-09-09T00:00:00Z",
      },
    ];
  calls.add(name);
  if (name === "auth.me")
    return role === "public"
      ? null
      : role === "client"
        ? client
        : role === "merchant"
          ? { ...artist, role: "merchant" }
          : artist;
  if (name === "projects.summary") return summary;
  if (name === "dashboard.getArtistOverview")
    return {
      stats: { appointmentsToday: 2, pendingRequests: 0, totalRevenue: 600 },
      nextAppointment: appointment,
      readinessForms: [{ appointmentId: 101, status: "signed" }],
      todayTimeline: [
        appointment,
        {
          ...appointment,
          id: 102,
          clientName: "Oliver James",
          client: { ...client, name: "Oliver James" },
          title: "Geometric shoulder",
          startTime: "2026-09-10T04:00:00Z",
          endTime: "2026-09-10T06:00:00Z",
        },
      ],
    };
  if (
    name === "artistSettings.get" ||
    name === "artistSettings.getPublicByArtistId"
  )
    return {
      userId: artist.id,
      businessName: "Ella Morgan",
      businessAddress: "Northside Studio, Brisbane",
      services: JSON.stringify([
        { name: "Full day", duration: 180, price: 600, sittings: 1 },
      ]),
      workSchedule: "{}",
      publicSlug: "ella-morgan",
      stripeOnboardingComplete: 1,
    };
  if (name === "appointments.getProposalForAppointment") return null;
  if (name === "booking.getCalendarIndicators") return {};
  if (name === "conversations.createClient")
    return { clientId: "new-client", conversationId: 13 };
  if (name === "conversations.getOrCreate") return { id: 12 };
  if (name === "studios.getCurrentStudio") return null;
  if (name === "dashboardTasks.getBusinessTasks")
    return { tasks: [], summary: {}, counts: {} };
  if (name === "dashboardTasks.getSettings") return {};
  if (name === "appointments.getArtistCalendar")
    return [
      appointment,
      {
        ...appointment,
        id: 102,
        clientName: "Oliver James",
        title: "Geometric shoulder",
        startTime: "2026-09-10T04:00:00Z",
        endTime: "2026-09-10T06:00:00Z",
      },
    ];
  if (name === "appointments.getClientBookings")
    return {
      appointments: [
        {
          ...appointment,
          startsAt: appointment.startTime,
          projectName: appointment.title,
          depositPaidCents: 15000,
          estimateCents: 60000,
          balanceDueCents: 45000,
          studioName: "Northside Studio",
          durationMinutes: 180,
          paymentRequest: null,
        },
      ],
      pendingConsults: [],
    };
  if (name === "sessionPlans.getByClient") return [plan];
  if (name === "sessionPlans.getById") return plan;
  if (name === "conversations.getClients")
    return [{ ...client, tlv: 60000, sittings: 2, hasUpcoming: true }];
  if (name === "forms.getPendingForms")
    return [
      {
        id: 7,
        appointmentId: 101,
        title: "Procedure consent",
        status: "pending",
        content: "Sample form for layout testing only.",
        formType: "procedure_consent",
      },
    ];
  if (name.includes("getConversations") || name === "conversations.list")
    return [
      {
        id: 12,
        artistId: artist.id,
        clientId: client.id,
        otherUser: role === "client" ? artist : client,
        lastMessage: "See you on Thursday",
        lastMessageAt: "2026-09-09T00:00:00Z",
        unreadCount: 0,
      },
    ];
  if (name === "auth.getProfile" || name === "clientProfile.getProfile")
    return client;
  if (
    name.includes("Settings") ||
    name.includes("settings") ||
    name.includes("getStatus")
  )
    return {};
  if (name === "funnel.getBalanceInfo")
    return {
      status: "pending",
      remainingBalanceCents: 45000,
      platformFeeCents: 1530,
      clientTotalCents: 46530,
      artistName: artist.name,
    };
  return [];
}

const cases = [
  ["today-phone", 440, 956, "artist", "/dashboard"],
  ["today-tablet", 1180, 820, "artist", "/dashboard"],
  ["calendar-phone", 440, 956, "artist", "/calendar"],
  ["calendar-tablet", 1180, 820, "artist", "/calendar"],
  ["client-bookings", 440, 956, "client", "/bookings"],
  ["client-profile", 820, 1180, "client", "/profile"],
  ["supplier-home", 820, 1180, "merchant", "/dashboard"],
  ["supplier-settings", 440, 956, "merchant", "/settings"],
  ["supplier-orders", 820, 1180, "merchant", "/merchant/orders"],
  ["supplies-directory", 440, 956, "artist", "/supplies"],
  ["supply-orders", 820, 1180, "artist", "/supply-orders"],

  ["guide-artist", 440, 956, "artist", "/settings?section=how-tos"],
  [
    "guide-supplier",
    820,
    1180,
    "merchant",
    "/account-settings?section=how-tos",
  ],
  ["forms-sign", 440, 956, "client", "/projects/12"],
  ["lead", 1180, 820, "artist", "/lead/501"],
  ["shop", 440, 956, "public", "/shop/ella"],
  ["events-public", 820, 1180, "public", "/events/ella"],
  ["events-artist", 440, 956, "artist", "/artist-events"],
  ["discover", 820, 1180, "client", "/discover"],
  ["account-removal", 440, 956, "client", "/settings?section=danger-zone"],

  ["public-start", 440, 956, "public", "/start/ella"],
  ["artist-hub", 820, 1180, "public", "/ella"],
  ["studio-public", 440, 956, "public", "/studio/northside"],
  ["payment-return", 440, 956, "public", "/pay/fixture?status=success"],
  ["payment-paid", 820, 1180, "public", "/pay/fixture?status=success"],
  ["payment-review", 440, 956, "public", "/pay/fixture"],
  ["deposit-link", 440, 956, "public", "/deposit/fixture"],
  ["balance-link", 820, 1180, "public", "/balance/101?token=fixture"],
  ["refund", 440, 956, "artist", "/payout-history"],
  ["forms", 440, 956, "artist", "/settings?section=regulation"],
  ["travel", 820, 1180, "artist", "/settings?section=travel"],
  ["data-import", 440, 956, "artist", "/settings?section=data-import"],
  ["instagram", 440, 956, "artist", "/settings?section=instagram"],
  ["login", 440, 956, "public", "/login"],
  ["signup-supplier", 820, 1180, "public", "/signup?role=supplier"],
  ["recovery", 440, 956, "public", "/forgot-password"],
  ["purchases", 820, 1180, "client", "/purchases"],

  ["bank", 440, 956, "artist", "/bank-payouts"],
  ["plans", 1180, 820, "artist", "/subscriptions"],
  ["studio", 1180, 820, "artist", "/studio"],
  ["studio-invite", 440, 956, "artist", "/studio?view=Team"],
  ["artist-profile", 820, 1180, "artist", "/artist-profile"],
  ["booking-link", 440, 956, "artist", "/settings?section=booking-link"],
  ["proposal", 1180, 820, "artist", "/calendar"],
  ["client", 440, 956, "artist", "/clients"],
  ["reschedule", 440, 956, "artist", "/projects/12"],
  ["thread", 1180, 820, "artist", "/chat/12"],
  ["settings", 440, 956, "artist", "/settings"],
  ["hours", 820, 1180, "artist", "/work-hours"],
  ["product", 440, 956, "merchant", "/merchant/products"],
  ["notifications", 820, 1180, "artist", "/settings?section=notifications"],
  ["deposit", 440, 956, "client", "/bookings"],
  ["public-request", 440, 956, "public", "/book/ella"],
  ["public-existing", 820, 1180, "public", "/book/ella"],
  ["public-error", 440, 956, "public", "/book/ella"],
  ["product-error", 440, 956, "merchant", "/merchant/products"],
];
for (const [test, width, height, role, path] of cases) {
  if (
    process.env.AUDIT_CASE &&
    !process.env.AUDIT_CASE.split(",").includes(test)
  )
    continue;
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    reducedMotion: "reduce",
    timezoneId: "Australia/Brisbane",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem("tattoi-theme-override", "light");
    localStorage.setItem("ui_debug_enabled", "false");
    localStorage.setItem("authToken", "test");
    sessionStorage.setItem("splashShown", "true");
  });
  const mutations = [];
  const writes = [];
  await context.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.abort();
    if (u.pathname.startsWith("/api/trpc/")) {
      const names = u.pathname.split("/").at(-1).split(",");
      if (route.request().method() === "POST") {
        mutations.push(...names);
        const body = route.request().postDataJSON();
        names.forEach((name, index) =>
          writes.push({ name, input: body?.[index]?.json })
        );
      }
      return route.fulfill({
        json: names.map(name => ({
          ...(test.endsWith("-error") &&
          ["funnel.submitPublicBooking", "storefront.createProduct"].includes(
            name
          )
            ? {
                error: {
                  json: {
                    message: "Fixture save failed",
                    code: -32603,
                    data: {
                      code: "INTERNAL_SERVER_ERROR",
                      httpStatus: 500,
                      path: name,
                    },
                  },
                },
              }
            : { result: { data: { json: response(name, role, test) } } }),
        })),
      });
    }
    if (u.pathname === "/api/version")
      return route.fulfill({ json: { version: appVersion } });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-09-09T23:41:00Z") });
  await page.goto((process.env.AUDIT_URL || "http://127.0.0.1:5175") + path);
  const safeTop = width < 600 ? 62 : 24;
  await page.addStyleTag({
    content: ":root{--app-safe-top:" + safeTop + "px;--app-safe-bottom:34px}",
  });
  await page
    .locator(".v3-header h1")
    .filter({ hasNotText: "Opening your workspace" })
    .waitFor();
  try {
    if (test.startsWith("guide-")) {
      await page
        .getByRole("button")
        .filter({
          hasText:
            test === "guide-artist"
              ? "Run your day"
              : "Create and publish a product",
        })
        .click();
      const guide = page.getByLabel("Guided walkthrough", { exact: true });
      await guide.waitFor();
      await guide
        .getByRole("button", { name: "Next step", exact: true })
        .click();
      await guide
        .getByRole("button", { name: "Finish guide", exact: true })
        .waitFor();
      await guide
        .getByRole("button", { name: "Finish guide", exact: true })
        .click();
      if (await guide.count()) throw Error("Guide did not close");
      if (mutations.some(name => name !== "auth.refreshToken"))
        throw Error("Walkthrough changed business data");
    }
    if (test === "account-removal") {
      if (
        !(await page
          .getByRole("button", {
            name: "Permanently delete account",
            exact: true,
          })
          .isDisabled())
      )
        throw Error("Account deletion is not guarded");
    }
    if (test === "shop") {
      await page
        .getByRole("button", { name: "Add to cart", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page
        .getByRole("button", { name: "Continue to payment", exact: true })
        .waitFor();
      if (mutations.includes("storefront.createStorefrontCheckout"))
        throw Error("Adding to cart created a checkout before review");
    }
    if (test === "lead") {
      await page
        .getByRole("button", { name: "Open conversation", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Message", exact: true })
        .waitFor();
      if (!mutations.includes("funnel.updateLeadStatus"))
        throw Error("Request was not marked contacted");
    }
    if (test === "signup-supplier")
      await page.getByLabel("Business name", { exact: true }).waitFor();
    if (test === "forms-sign") {
      await page
        .getByRole("button", {
          name: "Complete your consent forms",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Continue to signature", exact: true })
        .click();
      const checkboxes = page.getByRole("dialog").getByRole("checkbox");
      if (await checkboxes.first().isChecked())
        throw Error("Photo permission was preselected");
      const signButton = page.getByRole("button", {
        name: "Sign this form",
        exact: true,
      });
      if (!(await signButton.isDisabled()))
        throw Error("Unsigned form was ready to submit");
      await checkboxes.last().check();
      const canvas = page.getByLabel("Draw your signature", { exact: true });
      await canvas.scrollIntoViewIfNeeded();
      const rect = await canvas.boundingBox();
      await page.mouse.move(rect.x + 30, rect.y + 70);
      await page.mouse.down();
      await page.mouse.move(rect.x + 100, rect.y + 110, { steps: 15 });
      await page.mouse.move(rect.x + 200, rect.y + 65, { steps: 15 });
      await page.mouse.up();
      await page.setViewportSize({ width: 820, height: 1180 });
      await page.waitForTimeout(200);
      const ink = await canvas.evaluate(element => {
        const data = element
          .getContext("2d")
          .getImageData(0, 0, element.width, element.height).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] < 100 && data[i + 3] > 200) count++;
        return count;
      });
      if (ink < 10) throw Error("Signature was erased on resize");
      await signButton.click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      const signed = writes.find(write => write.name === "forms.signForm");
      if (
        !signed ||
        signed.input?.photoPermission !== false ||
        !signed.input?.signature?.startsWith("data:image/png;base64,")
      )
        throw Error("Incorrect consent payload");
      if (mutations.includes("auth.updateProfile"))
        throw Error("Signature was saved to profile without permission");
    }
    if (test === "payment-return") {
      await page
        .getByText("Waiting for confirmation", { exact: true })
        .waitFor();
      if (await page.getByText("Payment confirmed", { exact: true }).count())
        throw Error("URL parameter falsely confirmed payment");
      if (mutations.includes("funnel.createPaymentRequestCheckout"))
        throw Error("Return link initiated another payment");
    }
    if (test === "payment-paid")
      await page.getByText("Payment received", { exact: true }).waitFor();
    if (test === "artist-hub") {
      if (await page.getByRole("dialog").count())
        throw Error("Artist hub unexpectedly opened intake");
      await page
        .getByRole("button", { name: "Request a booking", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
    }
    if (test === "studio-public") {
      const href = await page
        .getByRole("link")
        .filter({ hasText: artist.name })
        .getAttribute("href");
      if (href !== "/start/ella")
        throw Error("Studio artist link is not the public slug");
    }
    if (test === "refund") {
      await page
        .getByRole("button", { name: "Review refund", exact: true })
        .click();
      await page.getByText(/deposits for all 2 sessions/).waitFor();
      const button = page.getByRole("button", {
        name: "Refund $155.10",
        exact: true,
      });
      if (!(await button.isDisabled()))
        throw Error("Refund review did not require acknowledgement");
      await page.getByRole("checkbox").check();
      await button.click();
      await page
        .getByText("Stripe accepted the refund", { exact: true })
        .waitFor();
      if (!mutations.includes("payouts.refundTransaction"))
        throw Error("Refund did not submit");
    }
    if (test === "instagram") {
      await page.getByLabel("Instagram username", { exact: true }).fill("ella");
      await page
        .getByRole("button", { name: "Check account", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Import portfolio", exact: true })
        .waitFor();
      await page
        .getByLabel("Instagram username", { exact: true })
        .fill("someoneelse");
      if (
        await page
          .getByRole("button", { name: "Import portfolio", exact: true })
          .count()
      )
        throw Error("Stale account offered for import");
    }
    if (test === "bank") {
      await page.getByRole("button", { name: "Change", exact: true }).click();
      if (
        (await page.getByLabel("Payout day", { exact: true }).inputValue()) !==
        "friday"
      )
        throw Error("Saved payout day was not preserved");
      await page
        .getByLabel("Frequency", { exact: true })
        .selectOption("monthly");
      await page.getByLabel("Day of month", { exact: true }).fill("21");
      await page
        .getByRole("button", { name: "Save payout schedule", exact: true })
        .click();
      await page.getByText("Payout schedule saved.", { exact: true }).waitFor();
      if (!mutations.includes("artistSettings.updatePayoutSchedule"))
        throw Error("Schedule did not save");
      await page
        .getByText("NZD · Pending funds are not yet available for payout.", {
          exact: true,
        })
        .waitFor();
    }
    if (test === "plans") {
      await page
        .getByRole("button", { name: "Choose Pro", exact: true })
        .waitFor();
      if (
        await page
          .getByRole("button", { name: "Choose Pro", exact: true })
          .isDisabled()
      )
        throw Error("Available Pro offer cannot be chosen");
      await page
        .getByRole("link", { name: "Set up Studio", exact: true })
        .waitFor();
    }
    if (test === "studio") {
      await page.getByRole("button", { name: /Botanical sleeve/ }).click();
      await page
        .getByRole("link", { name: "Open booking workspace", exact: true })
        .waitFor();
      await page.getByRole("tab", { name: "Team", exact: true }).click();
      await page.getByLabel("Artist email", { exact: true }).waitFor();
    }
    if (test === "studio-invite") {
      await page
        .getByLabel("Artist email", { exact: true })
        .fill("artist@example.invalid");
      await page
        .getByRole("button", { name: "Send invitation", exact: true })
        .click();
      await page.getByText("Invitation sent.", { exact: true }).waitFor();
      if (!mutations.includes("studios.inviteArtist"))
        throw Error("Invitation did not submit");
    }
    if (test === "artist-profile") {
      await page
        .getByLabel("Artist display name", { exact: true })
        .fill("Ella Morgan Tattoo");
      await page
        .getByRole("button", { name: "Save public profile", exact: true })
        .click();
      await page.getByText("Public profile saved.", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
      await page
        .getByRole("button", { name: "Add photo", exact: true })
        .click();
      await page
        .getByLabel("Description", { exact: true })
        .fill("Fixture portfolio draft");
      await page.getByRole("dialog").waitFor();
    }
    if (test === "booking-link") {
      await page.getByLabel("Link name", { exact: true }).fill("new-ella-link");
      if (
        !(
          await page
            .getByLabel("Your saved booking link", { exact: true })
            .inputValue()
        ).endsWith("/book/ella")
      )
        throw Error("Unsaved link offered for sharing");
      await page
        .getByRole("button", { name: "Save booking link", exact: true })
        .click();
      await page.getByText("Booking link saved.", { exact: true }).waitFor();
      if (
        !(
          await page
            .getByLabel("Your saved booking link", { exact: true })
            .inputValue()
        ).endsWith("/book/new-ella-link")
      )
        throw Error("Saved link not updated");
    }
    if (test.startsWith("public-")) {
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", { name: "Send booking request", exact: true })
        .waitFor();
      if (await page.getByLabel("Create password", { exact: true }).count())
        throw Error("Password shown before submitting the request");
      await page
        .getByLabel("What would you like tattooed?", { exact: true })
        .fill("Botanical sleeve with fine line leaves.");
      await page
        .getByRole("checkbox", { name: "Fine Line", exact: true })
        .check();
      await page.getByLabel("First name", { exact: true }).fill("Mia");
      await page.getByLabel("Last name", { exact: true }).fill("Chen");
      await page
        .getByLabel("Email", { exact: true })
        .fill("fixture@example.invalid");
      await page.getByLabel("Phone", { exact: true }).fill("0400000000");
      await page
        .getByLabel("Date of birth", { exact: true })
        .fill("1995-01-01");
      await page.getByLabel("Gender", { exact: true }).selectOption("female");
      await page
        .getByRole("button", { name: "Send booking request", exact: true })
        .click();
      if (test === "public-error") {
        await page
          .getByRole("alert")
          .filter({ hasText: "Fixture save failed" })
          .waitFor();
        if (
          (await page.getByLabel("Email", { exact: true }).inputValue()) !==
          "fixture@example.invalid"
        )
          throw Error("Request details lost after failure");
        if (await page.getByLabel("Create password", { exact: true }).count())
          throw Error("Failed submission offered account creation");
      } else
        await page
          .getByLabel(
            test === "public-existing" ? "Your password" : "Create password",
            { exact: true }
          )
          .waitFor();
      if (!mutations.includes("funnel.submitPublicBooking"))
        throw Error("Request did not submit");
      if (mutations.includes("auth.claimLead"))
        throw Error("Account claimed before the client chose credentials");
    }
    const heading = await page.locator(".v3-header h1").boundingBox();
    if (!heading || heading.y < safeTop)
      throw Error("Header overlaps the safe area");
    if (test === "product" || test === "product-error") {
      await page
        .getByRole("button", { name: "Add product", exact: true })
        .click();
      await page
        .getByLabel("Product name", { exact: true })
        .fill("Example aftercare");
      await page.getByLabel("Price · AUD", { exact: true }).fill("25");
      await page.getByLabel("Quantity available", { exact: true }).fill("10");
      await page
        .getByRole("button", { name: "Save product", exact: true })
        .click();
      if (test === "product-error") {
        await page
          .getByRole("alert")
          .filter({ hasText: "Fixture save failed" })
          .waitFor();
        if (
          (await page
            .getByLabel("Product name", { exact: true })
            .inputValue()) !== "Example aftercare"
        )
          throw Error("Product draft lost after failure");
      } else await page.getByRole("dialog").waitFor({ state: "hidden" });
      if (!mutations.includes("storefront.createProduct"))
        throw Error("Product did not save");
    }
    if (test === "notifications") {
      await page
        .getByRole("button", { name: "Add template", exact: true })
        .click();
      await page.getByLabel("Title", { exact: true }).fill("Preparation");
      await page
        .getByLabel("Message", { exact: true })
        .fill("Please bring your reference images.");
      await page
        .getByRole("button", { name: "Save template", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      if (!mutations.includes("notifications.create"))
        throw Error("Template did not save");
    }
    if (test === "deposit") {
      await page
        .getByRole("button", { name: /Review .*deposit & fee/ })
        .click();
      await page
        .getByRole("button", {
          name: "Continue to secure checkout",
          exact: true,
        })
        .waitFor();
      const dialog = page.getByRole("dialog");
      if (!(await dialog.innerText()).includes("Total due today"))
        throw Error("Checkout does not disclose total");
      const title = await dialog.getByRole("heading").first().boundingBox();
      if (!title || title.y < safeTop)
        throw Error("Checkout header overlaps the safe area");
    }
    if (test === "proposal") {
      await page
        .getByRole("button", { name: "New booking", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Mia Chen", exact: false })
        .last()
        .click();
      await page
        .getByLabel("Service", { exact: true })
        .selectOption("Full day");
      await page
        .getByRole("button", { name: "Find available dates", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Find available dates", exact: true })
        .waitFor();
      await page.getByLabel("Date", { exact: true }).fill("2026-09-14");
      await page
        .getByRole("button", { name: "Review proposal", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Send proposal", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Edit details" }).click();
      await page.getByRole("button", { name: "Add another session" }).click();
      await page
        .getByRole("button", { name: "Review proposal", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Send proposal", exact: true })
        .click();
      await page.waitForURL("**/chat/12");
      if (!mutations.includes("sessionPlans.create"))
        throw Error("No session plan was created");
    }
    if (test === "client") {
      await page
        .getByRole("button", { name: "Mia Chen", exact: false })
        .click();
      await page.getByRole("tab", { name: "Notes", exact: true }).click();
      await page.getByLabel("Private artist note").fill("Example private note");
      await page.getByRole("button", { name: "Save note" }).click();
      await page.waitForTimeout(300);
      if (!mutations.includes("clientProfile.addClientNote"))
        throw Error("Note did not save");
    }
    if (test === "reschedule") {
      await page
        .getByRole("button", { name: "Reschedule", exact: true })
        .click();
      await page.getByLabel("New date").fill("2026-09-14");
      await page.getByRole("button", { name: "Save new time" }).click();
      await page.waitForTimeout(300);
      if (!mutations.includes("appointments.reschedule"))
        throw Error("Reschedule did not save");
    }
    if (test === "thread") {
      await page
        .getByRole("textbox", { name: "Message", exact: true })
        .first()
        .waitFor();
      if (
        (await page
          .getByRole("textbox", { name: "Message", exact: true })
          .count()) !== 1
      )
        throw Error("Duplicate composer");
      await page
        .getByRole("textbox", { name: "Message", exact: true })
        .fill("Example fixture message");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page.waitForTimeout(300);
      if (!mutations.includes("messages.send")) throw Error("Message not sent");
    }
    if (test === "settings") {
      await page
        .getByRole("link", {
          name: "Business details Location, contact information and licence",
        })
        .click();
      await page
        .getByLabel("Business name", { exact: true })
        .fill("Example studio");
      await page.getByRole("button", { name: "Save business details" }).click();
      await page.waitForTimeout(300);
      if (!mutations.includes("artistSettings.upsert"))
        throw Error("Business did not save");
    }
    if (test === "hours") {
      await page.getByRole("tab", { name: "Services", exact: true }).click();
      await page
        .getByRole("button", { name: "Add service", exact: true })
        .click();
      await page.getByLabel("Service name").fill("Example service");
      await page
        .getByRole("button", { name: "Save service", exact: true })
        .click();
      await page.waitForTimeout(300);
      if (!mutations.includes("artistSettings.upsert"))
        throw Error("Service did not save");
    }
    await page.clock.runFor(1800);
    await page
      .getByText("Loading…", { exact: true })
      .first()
      .waitFor({ state: "hidden" });
    await page
      .locator(".v3-header h1")
      .filter({ hasNotText: "Opening your workspace" })
      .waitFor();
    const finalHeader = await page.locator(".v3-header h1").boundingBox();
    if (!finalHeader || finalHeader.y < safeTop)
      throw Error("Final header intrudes into safe area");
    if (mutations.filter(name => name === "auth.refreshToken").length > 1)
      throw Error("Repeated session refresh");
  } catch (e) {
    errors.push(e.message);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1
  );
  await page.screenshot({ path: `${out}/${test}.png` });
  results.push({ test, errors, overflow, mutations });
  console.log(JSON.stringify(results.at(-1)));
  await context.close();
}
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
if (results.some(r => r.errors.length || r.overflow)) process.exitCode = 1;
