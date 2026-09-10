import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.AUDIT_OUTPUT || "/private/tmp/tattoi-workspace-interactions";
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
function response(name, role) {
  calls.add(name);
  if (name === "auth.me") return role === "client" ? client : artist;
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
      balanceDueCents: 45000,
      platformFeeCents: 1530,
      totalCents: 46530,
      artistName: artist.name,
    };
  return [];
}
const cases = [
  ["iphone", 440, 956, 62, 34, "artist", "/calendar"],
  ["ipad", 1180, 820, 24, 20, "artist", "/calendar"],
  ["iphone", 440, 956, 62, 34, "artist", "/clients"],
  ["iphone", 440, 956, 62, 34, "client", "/projects/12"],
  ["iphone", 440, 956, 62, 34, "client", "/bookings"],
];
for (const [device, width, height, top, bottom, role, path] of cases) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    timezoneId: "Australia/Brisbane",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem("tattoi-theme-override", "light");
    localStorage.setItem("authToken", "test");
    localStorage.setItem("ui_debug_enabled", "false");
    sessionStorage.setItem("splashShown", "true");
  });
  await context.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.abort();
    if (u.pathname.startsWith("/api/trpc/")) {
      const names = u.pathname.split("/").at(-1).split(",");
      return route.fulfill({
        json: names.map(name => ({
          result: { data: { json: response(name, role) } },
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
  await page.goto((process.env.AUDIT_URL || "http://127.0.0.1:5174") + path, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(
    ({ top, bottom }) => {
      document.documentElement.style.setProperty("--app-safe-top", `${top}px`);
      document.documentElement.style.setProperty(
        "--app-safe-bottom",
        `${bottom}px`
      );
    },
    { top, bottom }
  );
  await page.waitForTimeout(2000);
  await page.evaluate(
    ({ top, bottom }) => {
      document.documentElement.style.setProperty("--app-safe-top", `${top}px`);
      document.documentElement.style.setProperty(
        "--app-safe-bottom",
        `${bottom}px`
      );
    },
    { top, bottom }
  );
  if (path === "/calendar" && width >= 900) {
    const selected = page
      .getByRole("button")
      .filter({ hasText: "Mia Chen" })
      .first();
    if (await selected.count()) await selected.click();
    await page.waitForTimeout(400);
  }
  try {
    if (path === "/calendar") {
      await page
        .getByRole("button", { name: "New booking", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.getByText("Quick Book", { exact: true }).waitFor();
      await page
        .getByRole("dialog")
        .getByPlaceholder("Search clients...")
        .fill("Mia");
      await page
        .getByRole("dialog")
        .getByText("Mia Chen", { exact: true })
        .click();
      await page.screenshot({ path: `${out}/${device}-new-booking.png` });
    } else if (path === "/clients") {
      await page
        .getByRole("button", { name: "Add client", exact: true })
        .click();
      await page.getByLabel("Full name", { exact: true }).fill("Test Client");
      await page
        .getByLabel("Email (optional)", { exact: true })
        .fill("test@example.test");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Add client", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    } else if (path === "/projects/12") {
      await page
        .getByRole("button", {
          name: "Complete your consent forms",
          exact: true,
        })
        .click();
      await page
        .getByText("Sample form for layout testing only.", { exact: true })
        .waitFor();
    } else if (path === "/bookings") {
      await page
        .getByRole("button", {
          name: "Review dates & pay deposit",
          exact: true,
        })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.getByText("Session plan total", { exact: true }).waitFor();
    }
    await page.waitForTimeout(400);
  } catch (error) {
    errors.push("Interaction: " + error.message.slice(0, 300));
  }
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    headers: [...document.querySelectorAll("h1")]
      .filter(e => e.getBoundingClientRect().height > 0)
      .map(e => ({
        text: e.textContent,
        top: e.getBoundingClientRect().top,
        right: e.getBoundingClientRect().right,
      })),
    text: document.body.innerText.slice(0, 1200),
  }));
  const file = `${device}-${role}-${path.replaceAll("/", "_")}.png`;
  await page.screenshot({ path: `${out}/${file}` });
  results.push({ device, role, path, errors, ...geometry, file });
  console.log(JSON.stringify(results.at(-1)));
  await context.close();
}
await browser.close();
if (results.some(r => r.errors.length || r.overflow)) process.exitCode = 1;
await writeFile(
  `${out}/results.json`,
  JSON.stringify({ results, calls: [...calls] }, null, 2)
);
