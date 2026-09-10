import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdir, writeFile } from "node:fs/promises";
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
  if (process.env.AUDIT_CASE && process.env.AUDIT_CASE !== test) continue;
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
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
  await context.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.abort();
    if (u.pathname.startsWith("/api/trpc/")) {
      const names = u.pathname.split("/").at(-1).split(",");
      if (route.request().method() === "POST") mutations.push(...names);
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
      return route.fulfill({ json: { version: "2.15.0" } });
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
  await page.locator(".v3-header h1").waitFor();
  try {
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
