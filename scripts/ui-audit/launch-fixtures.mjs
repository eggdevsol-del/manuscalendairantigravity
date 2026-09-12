// Isolated browser fixtures. These requests never reach a live backend.
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
  if (name === "auth.me")
    return role === "client"
      ? client
      : role === "merchant"
        ? {
            ...artist,
            id: "supplier-test",
            role: "merchant",
            name: "Studio Supply",
          }
        : artist;
  if (name === "payouts.nextPayout")
    return {
      availableAmountCents: 124000,
      pendingAmountCents: 45000,
      currency: "AUD",
      nextPayoutAmountCents: null,
    };
  if (name === "merchantAuth.getMerchantProfile")
    return { businessName: "Studio Supply", country: "AU" };
  if (name === "merchantAuth.getDashboardStats")
    return {
      pendingOrders: 2,
      lowStockItems: 3,
      revenueCents: 450000,
      totalOrders: 16,
    };
  if (name === "storefront.getProducts")
    return [
      {
        id: 1,
        title: "Cartridge needles",
        priceCents: 3200,
        inventoryCount: 24,
        isActive: true,
        variants: [],
        fulfillmentType: "shipping",
      },
    ];
  if (name === "storefront.getOrders")
    return [
      {
        id: 1,
        buyerName: "Ella Morgan",
        buyerEmail: "artist@example.test",
        status: "paid",
        totalAmountCents: 3200,
        items: [
          { productName: "Cartridge needles", quantity: 1, priceCents: 3200 },
        ],
        createdAt: "2026-09-10T00:00:00Z",
        fulfillmentMethod: "shipping",
      },
    ];
  if (name === "designBrief.get")
    return {
      brief:
        "Botanical sleeve · black and grey. Peonies wrapping the forearm, with space for a future upper-arm extension.",
      isStale: false,
    };
  if (name === "clientProfile.getClientNotes") return [];
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
        senderId: client.id,
        content: "I love the peonies. Could we leave room to extend it later?",
        messageType: "text",
        createdAt: "2026-09-09T00:00:00Z",
      },
      {
        id: 2,
        senderId: artist.id,
        content: "Absolutely. I’ll build that space into the design.",
        messageType: "text",
        createdAt: "2026-09-09T00:05:00Z",
      },
    ];
  if (name === "booking.checkAvailability")
    return {
      dates: [
        "2026-09-15T00:00:00Z",
        "2026-09-22T00:00:00Z",
        "2026-09-29T00:00:00Z",
      ],
    };
  if (name === "sessionPlans.create") return { id: 13 };
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
        { name: "Botanical sleeve", duration: 180, price: 600, sittings: 3 },
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

export { artist, client, response, calls };
