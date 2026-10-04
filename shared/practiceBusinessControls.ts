import { PRACTICE_CLIENT } from "./practiceFixtures";
import { calculateTransactionFees, resolvePaymentTier } from "./fees";
import { importInputSchema } from "./importData";
import { quoteOffer, offerEligibility } from "./offerRules";
import { z } from "zod";
import type { PracticeState } from "./practice";
import { PRACTICE_REFERENCE } from "./practiceMedia";
export const BUSINESS_QUERIES = [
  "dashboard.getArtistOverview",
  "dashboard.getUpcomingWeek",
  "dashboardTasks.getBusinessTasks",
  "dashboardTasks.getSettings",
  "dashboardTasks.shouldShowWeeklySnapshot",
  "dashboardTasks.getWeeklySnapshot",
  "dashboardTasks.getQuickStats",
  "appointments.getArtistCalendar",
  "appointments.getStudioCalendar",
  "appointments.getByConversation",
  "appointments.getProposalForAppointment",
  "funnel.getLeads",
  "funnel.getLead",
  "funnel.getFunnelSettings",
  "funnel.checkSlugAvailability",
  "portfolio.list",
  "payouts.earningsBreakdown",
  "payouts.nextPayout",
  "payouts.payoutHistory",
  "payouts.refundPreview",
  "suppliers.getSuppliers",
  "suppliers.getSupplier",
  "suppliers.getSupplierProducts",
  "supplierOrders.getSupplierOrders",
  "supplierOrders.getShippingRates",
  "supplierOrders.getSupplierOrderStatus",
  "supplierOrders.getReorderRecommendations",
  "storefront.getProducts",
  "storefront.getSeminars",
  "storefront.getOrders",
  "storefront.getPurchases",
  "storefront.getArtistStorefront",
  "studios.getCurrentStudio",
  "studios.getStudioMembers",
  "studios.getPendingInvites",
  "billing.subscriptionStatus",
  "billing.artistOffer",
  "billing.studioOffer",
  "promotions.getAvailableForBooking",
  "appointments.getClientCalendar",
  "sessionPlans.offerOptions",
  "offers.deliveries",
  "messages.references",
  "policies.getByType",
  "booking.getCalendarIndicators",
  "aftercare.getForBooking",
  "notifications.list",
  "instagram.getLatestImport",
  "instagram.getImportStatus",
  "instagram.verifyUsername",
  "waitlist.list",
  "artistSettings.matchClientsByLocation",
  "clientProfile.getClientProfile",
  "clientProfile.getClientNotes",
  "aftercare.getTemplate",
  "policies.list",
  "paymentMethodSettings.get",
  "notificationTemplates.list",
] as const;
export const BUSINESS_MUTATIONS = [
  "practice.clientOutcome",
  "practice.guideProgress",
  "forms.signForm",
  "projects.setProjectName",
  "offers.retryDelivery",
  "appointments.batchUpdateClientPrices",
  "appointments.resolveMysteryAppointments",
  "messages.requestBalance",
  "messages.requestAdditional",
  "artistSettings.getStripeAccountLink",
  "sessionPlans.setOffer",
  "sessionPlans.cancelOfferCheckout",
  "dashboardTasks.completeTask",
  "dashboardTasks.dismissWeeklySnapshot",
  "dashboardTasks.updateSettings",
  "auth.updateProfile",
  "auth.completeOnboarding",
  "auth.deleteAccount",
  "consultations.update",
  "consultations.create",
  "quickActions.create",
  "quickActions.update",
  "quickActions.delete",
  "upload.uploadImage",
  "portfolio.create",
  "portfolio.bulkDelete",
  "funnel.updateFunnelSettings",
  "funnel.updateLeadStatus",
  "clientProfile.updateClientProfile",
  "clientProfile.deleteClientNote",
  "aftercare.updateTemplate",
  "policies.upsert",
  "policies.delete",
  "paymentMethodSettings.upsert",
  "notifications.create",
  "notifications.update",
  "notifications.delete",
  "notificationTemplates.create",
  "notificationTemplates.update",
  "notificationTemplates.delete",
  "storefront.createProduct",
  "storefront.updateProduct",
  "storefront.createSeminar",
  "storefront.updateOrderStatus",
  "studios.createStudio",
  "studios.inviteArtist",
  "studios.removeMember",
  "studios.respondToInvite",
  "billing.createArtistCheckoutSession",
  "billing.createCheckoutSession",
  "billing.createArtistPortalSession",
  "billing.createPortalSession",
  "suppliers.scrapeShopifyStore",
  "supplierOrders.createSupplierCheckout",
  "waitlist.offer",
  "waitlist.leave",
  "waitlist.accept",
  "instagram.startImport",
  "instagram.stopImport",
  "dataImport.preview",
  "dataImport.commit",
  "payouts.refundTransaction",
  "artistSettings.testExternalCalendarUrl",
  "appointments.deleteProposal",
  "appointments.bookProject",
  "practice.completeExternal",
  "practice.recordAction",
  "practice.setStudioRole",
  "practice.saveCart",
] as const;
type Context = {
  artist: any;
  clients: any[];
  sessions: any[];
  messages: any[];
  settings: any;
};
const day = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(
    new Date()
  );
const fixtureProducts = () => [
  {
    id: 1,
    supplierId: 1,
    title: "Practice cartridge needles",
    description: "Fictional practice stock",
    category: "Cartridges",
    imageUrl: PRACTICE_REFERENCE,
    priceCents: 3000,
    inventoryCount: 10,
    isActive: 1,
    fulfillmentType: "delivery",
    shippingCents: 1000,
    variants: [
      {
        id: 1,
        title: "Round liner · 10 pack",
        name: "Round liner · 10 pack",
        priceCents: 3000,
        inventoryCount: 10,
      },
      {
        id: 2,
        title: "Magnum · 10 pack",
        name: "Magnum · 10 pack",
        priceCents: 3500,
        inventoryCount: 8,
      },
    ],
  },
];
const supplier = {
  id: 1,
  name: "Practice Tattoo Supply",
  description: "Fictional supplier for tutorials",
  currency: "AUD",
  logoUrl: PRACTICE_REFERENCE,
  bannerUrl: PRACTICE_REFERENCE,
  imageUrl: PRACTICE_REFERENCE,
  websiteUrl: "https://example.test",
  isActive: 1,
};
const offer = {
  enabled: true,
  available: true,
  currency: "aud",
  priceCents: 9900,
  amountCents: 9900,
  monthlyPriceCents: 9900,
  price: 99,
  trialDays: 30,
  prices: { pro: 9900, top: 19900 },
  plans: [
    { tier: "pro", priceCents: 9900 },
    { tier: "top", priceCents: 19900 },
  ],
  label: "Practice subscription",
};
const entity = (rows: any[], raw: any) => ({
  ...raw,
  id: raw.id ?? Math.max(0, ...rows.map(r => Number(r.id) || 0)) + 1,
});
function requireManager(s: PracticeState) {
  if (!["owner", "manager"].includes(s.sandbox?.studio?.role ?? "owner"))
    throw new Error(
      "Only a practice studio owner or manager can manage the team."
    );
}
export function queryBusinessControl(
  s: PracticeState,
  path: string,
  input: any,
  c: Context
): any {
  const b = s.sandbox ?? {},
    sessions = c.sessions,
    paid = s.booking.paid;
  const ledger = b.ledger ?? [
    {
      id: 1,
      type: "deposit",
      amountCents: paid,
      currency: "aud",
      clientName: s.client.name,
      appointmentId: 1,
      sessionIndex: 1,
      projectName: b.projectName ?? "Botanical forearm",
      stripePaymentId: "practice_payment",
      platformFeeCents: 0,
      artistFeeCents: 0,
      paymentMethod: "Simulated card",
      createdAt: new Date().toISOString(),
      refundedCents: 0,
      refundable: true,
    },
  ];
  switch (path) {
    case "appointments.getClientCalendar":
      return c.sessions;
    case "promotions.getAvailableForBooking":
      return [];
    case "messages.references":
      return c.messages.filter(m => m.messageType === "image");
    case "policies.getByType":
      return (
        (b.policies ?? []).find((p: any) => p.type === input.type) ?? {
          content: "Fictional practice policy",
          depositPercentage: 25,
        }
      );
    case "booking.getCalendarIndicators":
      return [];
    case "aftercare.getForBooking":
      return { content: b.aftercare ?? "Fictional aftercare overview" };
    case "sessionPlans.offerOptions":
      return {
        choices: (b.issued ?? []).map((o: any) => ({
          id: o.id,
          name: o.rules.name,
          reason: null,
        })),
        applied: b.appliedOffer ?? null,
        checkoutStarted: !!b.offerCheckout,
      };
    case "offers.deliveries":
      return (
        b.deliveries ?? [
          {
            id: 1,
            channel: "push",
            status: "failed",
            attempts: 1,
            error: "Simulated delivery failure. Practise retry.",
          },
        ]
      );
    case "dashboard.getUpcomingWeek":
      return {
        sittings: sessions.map(a => ({
          ...a,
          date: a.startsAt.slice(0, 10),
          startTime: a.startsAt,
          clientName: s.client.name,
        })),
        estimateCents: s.booking.price,
        bookedEstimateCents: s.booking.price,
        remainingCents: s.booking.price - paid,
        estimatedEarningsCents: s.booking.price,
        dates: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Australia/Brisbane",
          }).format(d);
        }),
        timeZone: "Australia/Brisbane",
        currency: "AUD",
      };
    case "dashboard.getArtistOverview":
      return {
        nextAppointment: sessions[0],
        appointments: sessions,
        upcomingAppointments: sessions,
        clients: c.clients,
        totalRevenue: paid / 100,
      };
    case "dashboardTasks.getBusinessTasks":
      return {
        tasks: b.tasks ?? [
          {
            taskType: "lead_follow_up",
            taskTier: "tier1",
            title: "Follow up with Alex Taylor",
            context: "Fictional botanical forearm enquiry",
            priorityScore: 90,
            priorityLevel: "high",
            relatedEntityId: "1",
            clientId: c.clients[0].id,
            clientName: s.client.name,
            actionType: "in_app",
            deepLink: "/chat/1",
            conversationId: 1,
          },
        ],
        summary: { total: 1 },
        stats: {},
        businessName: "Practice studio",
      };
    case "dashboardTasks.getSettings":
      return {
        businessName: "Practice studio",
        businessEmail: "artist@example.test",
        ...b.taskSettings,
      };
    case "dashboardTasks.shouldShowWeeklySnapshot":
      return { show: !b.snapshotDismissed, shouldShow: !b.snapshotDismissed };
    case "dashboardTasks.getWeeklySnapshot":
      return {
        completedTasks: b.completedTasks?.length ?? 0,
        bookings: sessions.length,
        revenue: paid / 100,
        completionRate: 100,
      };
    case "dashboardTasks.getQuickStats":
      return {
        totalClients: c.clients.length,
        upcomingAppointments: sessions.length,
        revenue: paid / 100,
      };
    case "appointments.getArtistCalendar":
    case "appointments.getStudioCalendar":
    case "appointments.getByConversation":
      return sessions
        .map(a => ({
          ...a,
          clientName: s.client.name,
          serviceName: a.title,
          price: a.estimateCents / 100,
          totalExpectedAmountCents: a.estimateCents,
          totalPaidAmountCents: a.paidCents,
          remainingBalanceCents: a.remainingCents,
          depositPaid: a.paidCents >= a.depositCents ? 1 : 0,
          appointmentType: "tattoo",
          createdAt: new Date().toISOString(),
          client: c.clients[0],
        }))
        .concat(b.personalAppointments ?? []);
    case "appointments.getProposalForAppointment":
      return null;
    case "funnel.getLeads":
      return {
        leads: [
          {
            id: 1,
            clientName: s.client.name,
            clientEmail: "alex@example.test",
            projectType: "full-day",
            projectDescription:
              s.client.brief || "Black and grey botanical forearm",
            status: b.leadStatus ?? "new",
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
      };
    case "funnel.getLead":
      return {
        id: 1,
        clientName: s.client.name,
        clientEmail: "alex@example.test",
        clientPhone: "0400 000 000",
        conversationId: 1,
        stylePreferences: ["Black and grey"],
        referenceImages: [PRACTICE_REFERENCE],
        bodyPlacementImages: [],
        projectType: "full-day",
        projectDescription: "Fictional botanical forearm enquiry",
        status: b.leadStatus ?? "new",
        references: [PRACTICE_REFERENCE],
        createdAt: new Date().toISOString(),
      };
    case "funnel.getFunnelSettings":
      return { publicSlug: "practice-artist", funnelEnabled: 1, ...b.funnel };
    case "funnel.checkSlugAvailability":
      return {
        available: input?.slug !== "taken",
        suggestions: ["practice-artist-2"],
      };
    case "portfolio.list":
      return (
        b.portfolio ?? [
          {
            id: 1,
            description: "Fictional botanical artwork",
            imageUrl: PRACTICE_REFERENCE,
            displayUrl: PRACTICE_REFERENCE,
            mediaType: "image",
            likes: 0,
          },
        ]
      );
    case "payouts.earningsBreakdown":
      return {
        grossCents: paid,
        artistFeeCents: 0,
        refundsCents: b.refunds ?? 0,
        netCents: Math.max(
          0,
          paid -
            calculateTransactionFees(
              paid,
              resolvePaymentTier(c.settings.subscriptionTier)
            ).artistFeeCents
        ),
        platformFeeCents: paid
          ? calculateTransactionFees(
              paid,
              resolvePaymentTier(c.settings.subscriptionTier)
            ).platformFeeCents
          : 0,
        currency: "aud",
        daily: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 86400000)
            .toISOString()
            .slice(0, 10),
          netCents:
            i === 29
              ? Math.max(
                  0,
                  paid -
                    calculateTransactionFees(
                      paid,
                      resolvePaymentTier(c.settings.subscriptionTier)
                    ).artistFeeCents
                )
              : 0,
        })),
        timeZone: "Australia/Brisbane",
      };
    case "payouts.nextPayout":
      return {
        connected: !!b.bankConnected,
        availableAmountCents: paid,
        pendingAmountCents: 0,
        nextPayoutAmountCents: paid,
        nextPayoutArrivalDate: null,
        currency: "aud",
      };
    case "payouts.payoutHistory":
      return {
        entries: ledger,
        payouts: [],
        hasMore: false,
        total: ledger.length,
      };
    case "payouts.refundPreview": {
      const entry = ledger.find((r: any) => r.id === input.ledgerId);
      if (!entry) throw new Error("Practice transaction not found.");
      const amount = Math.max(
        0,
        entry.amountCents - (entry.refundedCents ?? 0)
      );
      return {
        eligible: amount > 0,
        canRefund: amount > 0,
        amountCents: amount,
        currency: "aud",
        ledgerId: entry.id,
        clientName: s.client.name,
      };
    }
    case "suppliers.getSuppliers":
      return [supplier];
    case "suppliers.getSupplier":
      return supplier;
    case "suppliers.getSupplierProducts":
      return b.supplierProducts ?? fixtureProducts();
    case "supplierOrders.getSupplierOrders":
      return b.supplyOrders ?? [];
    case "supplierOrders.getShippingRates":
      return {
        currency: "AUD",
        rates: [
          {
            id: 1,
            name: "Practice standard delivery",
            amountCents: 1000,
            priceCents: 1000,
            minOrderSubtotalCents: null,
            maxOrderSubtotalCents: null,
            estimatedDeliveryDays: "3–5 days",
          },
        ],
      };
    case "supplierOrders.getSupplierOrderStatus": {
      const order = b.supplyOrders?.find((o: any) => o.id === input.orderId);
      return {
        success: order?.status === "paid",
        status: order?.status ?? "pending",
        orderId: input.orderId,
        order,
      };
    }
    case "supplierOrders.getReorderRecommendations":
      return (b.supplyOrders ?? [])
        .filter((o: any) => o.status === "paid")
        .map((o: any) => ({
          supplierId: 1,
          supplierName: supplier.name,
          lastOrderId: o.id,
          orderId: o.id,
          items: o.items,
          due: true,
          dueAt: new Date().toISOString(),
          intervalDays: 30,
          sampleOrders: 2,
          estimatedTotalCents: o.totalCents,
        }));
    case "storefront.getProducts":
      return b.products ?? fixtureProducts();
    case "storefront.getSeminars":
      return b.events ?? [];
    case "storefront.getOrders":
      return (
        b.storeOrders ?? [
          {
            id: 1,
            buyerName: s.client.name,
            buyerEmail: "alex@example.test",
            status: "paid",
            currency: "AUD",
            totalCents: 9000,
            fulfillmentMethod: "delivery",
            shippingAddress: "Fictional practice address",
            createdAt: new Date().toISOString(),
            items: [
              {
                id: 1,
                name: "Practice cartridge needles",
                quantity: 3,
                priceCents: 3000,
              },
            ],
          },
        ]
      );
    case "storefront.getPurchases":
      return queryBusinessControl(s, "storefront.getOrders", {}, c);
    case "storefront.getArtistStorefront":
      return {
        products: b.products ?? fixtureProducts(),
        seminars: b.events ?? [],
        artist: c.artist,
      };
    case "studios.getCurrentStudio":
      return b.studio ?? null;
    case "studios.getStudioMembers":
      return b.members ?? [];
    case "studios.getPendingInvites":
      return (
        b.invites ?? [
          {
            id: 1,
            studio: {
              id: "practice-invited-studio",
              name: "Fictional guest studio",
            },
            studioId: "practice-invited-studio",
            studioName: "Fictional guest studio",
            role: "artist",
            invitedBy: "Practice owner",
            createdAt: new Date().toISOString(),
          },
        ]
      );
    case "billing.subscriptionStatus":
      return {
        tier: b.subscription ?? "free",
        tierLabel:
          b.subscription === "pro" ? "Pro (practice)" : "Free (practice)",
        status: b.subscription ? "active" : null,
        hasSubscription: !!b.subscription,
        renewalDate: null,
        cancelAtPeriodEnd: false,
      };
    case "billing.artistOffer":
    case "billing.studioOffer":
      return offer;
    case "notifications.list":
    case "notificationTemplates.list":
      return b.notificationTemplates ?? [];
    case "instagram.getLatestImport":
    case "instagram.getImportStatus":
      return b.instagram ?? null;
    case "instagram.verifyUsername":
      return {
        exists: true,
        valid: true,
        username: input?.username ?? "practice_artist",
        fullName: "Practice Artist",
        profilePicUrl: PRACTICE_REFERENCE,
        isPrivate: false,
        postCount: 3,
        followersCount: 100,
      };
    case "waitlist.list":
      return (
        b.waitlist ?? [
          {
            name: s.client.name,
            conversationId: 1,
            id: 1,
            clientId: c.clients[0].id,
            clientName: s.client.name,
            client: c.clients[0],
            status: "waiting",
            preferredDays: JSON.stringify(["monday", "tuesday"]),
            notes: "Fictional client available for full day",
            createdAt: new Date().toISOString(),
          },
        ]
      );
    case "artistSettings.matchClientsByLocation":
      return {
        clients: c.clients.filter(p => !input.city || p.city === input.city),
        total: c.clients.length,
      };
    case "clientProfile.getClientProfile":
      return { ...c.clients[0], ...b.clientProfile };
    case "clientProfile.getClientNotes":
      return b.notes ?? [];
    case "aftercare.getTemplate":
      return {
        template:
          b.aftercare ?? "Practice aftercare wording. Not medical advice.",
      };
    case "policies.list":
      return b.policies ?? [];
    case "paymentMethodSettings.get":
      return b.paymentMethods ?? { cash: true, card: true, bankTransfer: true };
    default:
      throw new Error(`Unregistered practice query: ${path}`);
  }
}
export function mutateBusinessControl(
  s: PracticeState,
  path: string,
  raw: any,
  c: Context
): any {
  s.sandbox ??= {};
  const b = s.sandbox;
  switch (path) {
    case "forms.signForm":
      s.booking.forms = "signed";
      return { success: true };
    case "practice.guideProgress": {
      const value = z
        .object({
          chapterId: z.string().max(80),
          cursor: z.number().int().min(0).max(500),
        })
        .parse(raw);
      if (value.chapterId !== s.chapterId)
        throw new Error(
          "The active practice guide changed. Reload before continuing."
        );
      b.guide = value;
      return { success: true };
    }
    case "practice.clientOutcome": {
      const outcome = z
        .enum([
          "deposit",
          "forms",
          "balance",
          "approve",
          "decline",
          "reference",
          "offer",
        ])
        .parse(raw.outcome);
      if (outcome === "deposit") {
        if (s.booking.status !== "proposal sent")
          throw new Error("Send a proposal first.");
        s.booking.paid = s.booking.deposit;
        s.booking.status = "confirmed";
        if (b.plans?.[0]) {
          b.plans[0].status = "confirmed";
          b.plans[0].requiresDeposit = false;
        }
        for (const offer of b.issued ?? [])
          if (offer.planId === 1) offer.status = "confirmed";
      }
      if (outcome === "offer") {
        const offer = b.issued?.find(
          (item: any) => item.clientId === PRACTICE_CLIENT
        );
        const available = offer || b.issued?.[0];
        if (!available) throw new Error("Issue a practice offer first.");
        available.status = "discussing";
        available.purchaseRequired = false;
        if (available.rules.funding === "sale")
          s.voucher = { balance: available.rules.value, owner: s.client.name };
        s.messages.push({
          from: "Client",
          text: `I’d like to use ${available.rules.name} for a new booking.`,
        });
      }
      if (outcome === "reference") {
        s.client.reference = true;
        s.client.brief =
          "Black-and-grey botanical forearm tattoo, full-day sitting, with Alex’s shared reference.";
        s.messages.push({
          from: "Client",
          text: "Here is my reference image.",
        });
      }
      if (outcome === "forms") s.booking.forms = "signed";
      if (outcome === "balance") {
        if (s.booking.status !== "awaiting final payment")
          throw new Error("Request the final balance first.");
        s.booking.paid = s.booking.price;
        s.booking.status = "completed";
      }
      if (outcome === "approve" || outcome === "decline") {
        if (
          s.booking.status !== "change awaiting client approval" ||
          !s.booking.proposedDate
        )
          throw new Error("Request a reschedule first.");
        if (outcome === "approve") {
          const i = b.rescheduleIndex ?? 0;
          s.booking.dates[i] = s.booking.proposedDate;
          s.booking.price = s.booking.proposedPrice ?? s.booking.price;
          if (b.plans?.[0]?.items?.[i]) {
            const item = b.plans[0].items[i];
            item.startsAt = b.rescheduleStart;
            item.endsAt = new Date(
              +new Date(item.startsAt) + item.durationMinutes * 60000
            ).toISOString();
          }
        }
        delete s.booking.proposedDate;
        delete s.booking.proposedPrice;
        s.booking.status = "confirmed";
      }
      s.messages.push({
        from: "Client",
        text: `Simulated client outcome: ${outcome}`,
      });
      s.notifications.push(
        `Practice ${outcome} confirmation · Push/SMS preview only`
      );
      return { success: true };
    }
    case "projects.setProjectName":
      b.projectName = raw.name ?? raw.projectName;
      return { success: true };
    case "offers.retryDelivery":
      b.deliveries = [
        { id: raw.id, channel: "push", status: "accepted", attempts: 2 },
      ];
      s.notifications.push("Retried mock promotion notification");
      return { success: true };
    case "sessionPlans.cancelOfferCheckout":
      b.offerCheckout = false;
      return { success: true };
    case "sessionPlans.setOffer": {
      const currentItems = b.plans?.[0]?.items ?? c.sessions;
      b.originalPrices ??= currentItems.map((i: any) => i.estimateCents);
      b.originalDeposits ??= currentItems.map((i: any) => i.depositCents);
      const originalItems = currentItems.map((i: any, index: number) => ({
        ...i,
        estimateCents: b.originalPrices[index],
        depositCents: b.originalDeposits[index],
      }));
      if (!raw.offerId) {
        s.booking.price = originalItems.reduce(
          (sum: number, i: any) => sum + i.estimateCents,
          0
        );
        s.booking.deposit = originalItems.reduce(
          (sum: number, i: any) => sum + i.depositCents,
          0
        );
        if (b.plans?.[0]) b.plans[0].items = originalItems;
        b.appliedOffer = null;
        return { success: true };
      }
      const offer = b.issued?.find((o: any) => o.id === raw.offerId);
      if (!offer) throw new Error("Practice offer not found.");
      const items = originalItems;
      const reason = offerEligibility(
        offer.rules,
        offer.issuedAt,
        new Date().toISOString(),
        items.map((i: any) => i.startsAt),
        Date.now(),
        "Australia/Brisbane"
      );
      if (reason) throw new Error(reason);
      const quote = quoteOffer(offer.rules, offer.remainingValue, items);
      b.appliedOffer = {
        offerId: raw.offerId,
        discountCents: quote.discountCents,
        creditCents: quote.creditCents,
      };
      s.booking.price = quote.items.reduce(
        (n: number, i: any) => n + i.estimateCents,
        0
      );
      s.booking.deposit = quote.items.reduce(
        (n: number, i: any) => n + i.depositCents,
        0
      );
      if (b.plans?.[0]) {
        b.plans[0].items = quote.items;
        b.plans[0].totalEstimateCents = s.booking.price;
        b.plans[0].depositTotalCents = s.booking.deposit;
      }
      return { success: true };
    }

    case "messages.requestBalance":
    case "messages.requestAdditional":
      s.booking.status = "awaiting final payment";
      s.notifications.push("Practice payment request");
      return { success: true, id: 1 };
    case "appointments.batchUpdateClientPrices": {
      const amount = z
        .number()
        .int()
        .nonnegative()
        .parse(raw.priceCents ?? raw.totalExpectedAmountCents ?? raw.price);
      s.booking.price = amount;
      return { success: true };
    }
    case "appointments.resolveMysteryAppointments":
      return { success: true, resolved: 0 };
    case "artistSettings.getStripeAccountLink":
      return { url: "https://example.test/practice-stripe" };
    case "practice.recordAction": {
      const v = z
        .object({
          id: z.string().max(160),
          label: z.string().max(250),
          screen: z.string().max(250),
          kind: z.enum([
            "navigation",
            "input",
            "review",
            "mutation",
            "external",
          ]),
        })
        .parse(raw);
      b.actionProgress ??= {};
      b.actionProgress[v.id] = { ...v, at: new Date().toISOString() };
      return { success: true };
    }
    case "practice.saveCart":
      b.cart = z
        .record(z.string(), z.number().int().min(0).max(100))
        .parse(raw.quantities);
      return { success: true };
    case "practice.setStudioRole":
      if (!b.studio) throw new Error("Create or join a practice studio first.");
      if (b.studio)
        b.studio.role = z.enum(["owner", "manager", "artist"]).parse(raw.role);
      return { success: true };
    case "practice.completeExternal": {
      for (const order of b.supplyOrders ?? [])
        if (order.status === "pending") {
          order.status = "paid";
          b.supplierProducts ??= fixtureProducts();
          for (const item of order.items) {
            const variant = b.supplierProducts
              .flatMap((p: any) => p.variants)
              .find((v: any) => v.id === item.variantId);
            if (variant) variant.inventoryCount -= item.quantity;
          }
        }
      if (b.pendingSubscription) {
        b.subscription = b.pendingSubscription;
        b.settings = { ...b.settings, subscriptionTier: b.subscription };
        delete b.pendingSubscription;
      }
      if (b.studioCheckout && b.studio) {
        b.studio.subscriptionStatus = "active";
        b.studio.stripeSubscriptionId = "practice_subscription";
        delete b.studioCheckout;
      }
      s.notifications.push(
        "Simulated payment confirmation · No charge or external notification"
      );
      return { success: true };
    }
    case "dashboardTasks.completeTask":
      b.completedTasks = [...(b.completedTasks ?? []), raw.taskType];
      b.tasks = [];
      return { success: true };
    case "dashboardTasks.dismissWeeklySnapshot":
      b.snapshotDismissed = true;
      return { success: true };
    case "dashboardTasks.updateSettings":
      b.taskSettings = { ...b.taskSettings, ...raw };
      return { success: true };
    case "auth.updateProfile":
      b.artist = { ...b.artist, ...raw };
      return { ...c.artist, ...b.artist };
    case "auth.completeOnboarding":
      b.onboarded = true;
      return { success: true };
    case "auth.deleteAccount":
      b.removalPreview = true;
      return { success: true };
    case "upload.uploadImage":
      return {
        url: PRACTICE_REFERENCE,
        key: "practice-fixture",
        width: 400,
        height: 500,
      };
    case "portfolio.create": {
      const rows =
        b.portfolio ?? queryBusinessControl(s, "portfolio.list", {}, c);
      const row = entity(rows, {
        ...raw,
        imageUrl: PRACTICE_REFERENCE,
        displayUrl: PRACTICE_REFERENCE,
        mediaType: "image",
      });
      b.portfolio = [...rows, row];
      return row;
    }
    case "portfolio.bulkDelete":
      b.portfolio = (
        b.portfolio ?? queryBusinessControl(s, "portfolio.list", {}, c)
      ).filter((r: any) => !raw.ids.includes(r.id));
      return { success: true };
    case "funnel.updateFunnelSettings":
      if (raw.publicSlug === "taken")
        throw new Error("That practice slug is already used.");
      b.funnel = { ...b.funnel, ...raw };
      b.settings = { ...b.settings, ...raw };
      return { success: true };
    case "funnel.updateLeadStatus":
      b.leadStatus = raw.status;
      return { success: true };
    case "clientProfile.updateClientProfile":
      b.clientProfile = { ...b.clientProfile, ...raw };
      if (raw.name) s.client.name = raw.name;
      if (raw.city) s.client.city = raw.city;
      return { success: true };
    case "clientProfile.deleteClientNote":
      b.notes = (b.notes ?? []).filter(
        (n: any) => n.id !== (raw.id ?? raw.noteId)
      );
      return { success: true };
    case "aftercare.updateTemplate":
      b.aftercare = raw.template ?? raw.content;
      return { success: true };
    case "policies.upsert":
    case "quickActions.create":
    case "quickActions.update":
    case "notifications.create":
    case "notifications.update":
    case "notificationTemplates.create":
    case "notificationTemplates.update":
    case "consultations.create":
    case "consultations.update": {
      const key = path.startsWith("quickActions")
        ? "quickActions"
        : path.startsWith("consultations")
          ? "consultations"
          : path.startsWith("policies")
            ? "policies"
            : "notificationTemplates";
      const rows = b[key] ?? [];
      const row = entity(rows, raw);
      b[key] = [...rows.filter((r: any) => r.id !== row.id), row];
      return row;
    }
    case "policies.delete":
    case "quickActions.delete":
    case "notifications.delete":
    case "notificationTemplates.delete": {
      const key = path.startsWith("quickActions")
        ? "quickActions"
        : path.startsWith("policies")
          ? "policies"
          : "notificationTemplates";
      b[key] = (b[key] ?? []).filter((r: any) => r.id !== raw.id);
      return { success: true };
    }
    case "paymentMethodSettings.upsert":
      b.paymentMethods = { ...b.paymentMethods, ...raw };
      return { success: true };
    case "storefront.createProduct":
    case "storefront.updateProduct": {
      const v = z
        .object({
          title: z.string().trim().min(1),
          priceCents: z.number().int().nonnegative(),
          inventoryCount: z.number().int().nonnegative(),
        })
        .passthrough()
        .parse(raw);
      const rows = b.products ?? fixtureProducts();
      const row = entity(rows, {
        ...v,
        variants: raw.variants ?? [],
        imageUrl: PRACTICE_REFERENCE,
      });
      b.products = [...rows.filter((r: any) => r.id !== row.id), row];
      return row;
    }
    case "storefront.createSeminar": {
      const v = z
        .object({
          title: z.string().min(1),
          capacity: z.number().int().positive(),
          priceCents: z.number().int().nonnegative(),
        })
        .passthrough()
        .parse(raw);
      const row = entity(b.events ?? [], { ...v, ticketsSold: 0 });
      b.events = [...(b.events ?? []), row];
      return row;
    }
    case "storefront.updateOrderStatus":
      b.storeOrders = (
        b.storeOrders ?? queryBusinessControl(s, "storefront.getOrders", {}, c)
      ).map((o: any) =>
        o.id === raw.orderId ? { ...o, status: raw.status } : o
      );
      return { success: true };
    case "studios.createStudio": {
      const name = z.string().trim().min(2).parse(raw.name);
      if (b.studio) throw new Error("Already in a practice studio.");
      b.studio = {
        id: "practice-studio",
        name,
        role: "owner",
        subscriptionStatus: null,
      };
      b.members = [
        {
          id: "practice-owner",
          userId: c.artist.id,
          user: c.artist,
          role: "owner",
          status: "active",
        },
      ];
      return b.studio;
    }
    case "studios.inviteArtist":
      requireManager(s);
      {
        const email = z
          .string()
          .email()
          .parse(raw.artistEmail ?? raw.email);
        if ((b.members ?? []).some((m: any) => m.user?.email === email))
          throw new Error("This practice artist already has an invitation.");
        const row = {
          id: `practice-member-${(b.members ?? []).length}`,
          userId: `practice-member-${(b.members ?? []).length}`,
          user: {
            id: `practice-member-${(b.members ?? []).length}`,
            name: "Practice team member",
            email,
          },
          role: z
            .enum(["artist", "manager", "apprentice"])
            .parse(raw.role ?? "artist"),
          status: "pending_invite",
        };
        b.members = [...(b.members ?? []), row];
        s.notifications.push(`Invitation preview to ${email} · No email sent`);
        return row;
      }
    case "studios.removeMember":
      requireManager(s);
      if (raw.userId === c.artist.id || raw.memberId === "practice-owner")
        throw new Error("The practice owner cannot remove themselves.");
      b.members = (b.members ?? []).filter(
        (m: any) => m.userId !== raw.userId && m.id !== raw.memberId
      );
      return { success: true };
    case "studios.respondToInvite": {
      const invite = (
        b.invites ?? queryBusinessControl(s, "studios.getPendingInvites", {}, c)
      ).find((i: any) => i.id === raw.inviteId);
      if (!invite) throw new Error("Practice invitation not found.");
      if (raw.response === "accept")
        b.studio = {
          id: invite.studioId,
          name: invite.studioName,
          role: "artist",
          subscriptionStatus: "active",
        };
      b.invites = [];
      return { success: true };
    }
    case "billing.createArtistCheckoutSession":
      b.pendingSubscription = raw.tier ?? "pro";
      return { clientSecret: "cs_practice_subscription" };
    case "billing.createCheckoutSession":
      requireManager(s);
      b.studioCheckout = true;
      return { clientSecret: "cs_practice_studio" };
    case "billing.createArtistPortalSession":
    case "billing.createPortalSession":
      return { url: "https://example.test/practice-billing" };
    case "suppliers.scrapeShopifyStore":
      b.supplierProducts = fixtureProducts();
      return { supplierId: 1, imported: 1, success: true };
    case "supplierOrders.createSupplierCheckout": {
      const items = z
        .array(
          z.object({
            variantId: z.number().int().positive(),
            quantity: z.number().int().positive().max(100),
          })
        )
        .min(1)
        .parse(raw.items);
      if (new Set(items.map(i => i.variantId)).size !== items.length)
        throw new Error("Combine duplicate variants into a single quantity.");
      const products = b.supplierProducts ?? fixtureProducts();
      const rows = items.map(i => {
        const product = products.find((p: any) =>
          p.variants.some((v: any) => v.id === i.variantId)
        );
        const variant = product?.variants.find(
          (v: any) => v.id === i.variantId
        );
        if (!variant || variant.inventoryCount < i.quantity)
          throw new Error(
            "Practice stock changed. Reduce the quantity and retry."
          );
        return {
          ...i,
          supplierProductId: product.id,
          productTitle: product.title,
          variantName: variant.name,
          unitPriceCents: variant.priceCents,
        };
      });
      const existing = (b.supplyOrders ?? []).find(
        (o: any) =>
          o.status === "pending" &&
          JSON.stringify(o.items) === JSON.stringify(rows)
      );
      if (existing)
        return {
          ...existing,
          orderId: existing.id,
          clientSecret: "cs_practice_supply",
          platformFeeCents: 0,
          supplierCurrency: "AUD",
          exchangeRate: 1,
        };
      const subtotal = rows.reduce(
          (n, i) => n + i.unitPriceCents * i.quantity,
          0
        ),
        fees = calculateTransactionFees(
          subtotal,
          resolvePaymentTier(c.settings.subscriptionTier)
        ),
        id = (b.supplyOrders?.length ?? 0) + 1;
      const order = {
        id,
        supplierId: 1,
        supplierName: supplier.name,
        status: "pending",
        items: rows,
        subtotalCents: subtotal,
        shippingCents: 1000,
        totalCents: subtotal + 1000 + fees.platformFeeCents,
        currency: "AUD",
        createdAt: new Date().toISOString(),
      };
      b.supplyOrders = [...(b.supplyOrders ?? []), order];
      return {
        orderId: id,
        clientSecret: "cs_practice_supply",
        subtotalCents: subtotal,
        shippingCents: 1000,
        totalCents: subtotal + 1000 + fees.platformFeeCents,
        platformFeeCents: fees.platformFeeCents,
        supplierCurrency: "AUD",
        exchangeRate: 1,
        currency: "AUD",
        items: rows,
      };
    }
    case "waitlist.offer":
      b.waitlist = [
        {
          id: 1,
          client: c.clients[0],
          clientId: c.clients[0].id,
          status: "offered",
          ...raw,
        },
      ];
      s.notifications.push("Practice waitlist offer · No message sent");
      return { success: true };
    case "waitlist.leave":
      b.waitlist = [];
      return { success: true };
    case "waitlist.accept":
      s.booking.status = "confirmed";
      s.booking.paid = s.booking.deposit;
      b.waitlist = [];
      return { success: true, clientSecret: "cs_practice_waitlist" };
    case "instagram.startImport":
      b.instagram = {
        id: 1,
        status: "completed",
        progress: 100,
        totalPosts: 3,
        processedPosts: 3,
        importedCount: 3,
        skippedCount: 0,
        createdAt: new Date().toISOString(),
      };
      b.portfolio = Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        imageUrl: PRACTICE_REFERENCE,
        displayUrl: PRACTICE_REFERENCE,
        description: `Fictional Instagram tattoo ${i + 1}`,
        mediaType: "image",
      }));
      return { jobId: 1, id: 1 };
    case "instagram.stopImport":
      if (b.instagram) b.instagram.status = "cancelled";
      return { success: true };
    case "dataImport.preview": {
      const input = importInputSchema.parse(raw);
      return input.rows.map((r, i) => ({
        sourceRow: r.sourceRow ?? i + 2,
        index: i,
        name: r.name,
        status: !r.name
          ? "invalid"
          : i > 0 && r.email === input.rows[0].email
            ? "duplicate"
            : "new",
        detail: !r.name
          ? "Name required"
          : i > 0 && r.email === input.rows[0].email
            ? "Duplicate practice row"
            : "Ready for mock import",
      }));
    }
    case "dataImport.commit": {
      const input = importInputSchema.parse(raw);
      b.clients ??= structuredClone(c.clients);
      const rows = input.rows.map((r, i) => {
        const existing = b.clients.some(
          (p: any) => r.email && p.email === r.email
        );
        if (!existing)
          b.clients.push({
            id: `practice-import-${b.clients.length}`,
            name: r.name,
            email: r.email,
            phone: r.phone,
            role: "client",
            city: "Brisbane",
            bookings: 0,
            lifetimePaid: 0,
            inactiveDays: 0,
          });
        return {
          sourceRow: r.sourceRow ?? i + 2,
          index: i,
          name: r.name,
          status: existing ? "duplicate" : "imported",
          detail: existing
            ? "Already in practice clients"
            : "Added to private practice clients",
        };
      });
      return {
        rows,
        imported: rows.filter(r => r.status === "imported").length,
        skipped: rows.filter(r => r.status === "duplicate").length,
      };
    }
    case "payouts.refundTransaction": {
      const preview = queryBusinessControl(s, "payouts.refundPreview", raw, c);
      if (!preview.eligible || preview.amountCents !== raw.expectedAmountCents)
        throw new Error("Practice refund changed. Review again.");
      b.ledger = queryBusinessControl(
        s,
        "payouts.payoutHistory",
        {},
        c
      ).entries.map((e: any) =>
        e.id === raw.ledgerId ? { ...e, refundedCents: e.amountCents } : e
      );
      s.booking.paid = Math.max(0, s.booking.paid - preview.amountCents);
      b.refunds = (b.refunds ?? 0) + preview.amountCents;
      return {
        success: true,
        status: "succeeded",
        amountCents: preview.amountCents,
        currency: "aud",
      };
    }
    case "artistSettings.testExternalCalendarUrl":
      return {
        success: true,
        eventCount: 1,
        message: "Fixture calendar reachable (simulation only)",
      };
    case "appointments.deleteProposal":
      s.booking.status = "withdrawn";
      return { success: true };
    case "appointments.bookProject":
      throw new Error(
        "Use the practice booking wizard to create this project with its scheduling and price rules."
      );
    default:
      throw new Error(`Unregistered practice mutation: ${path}`);
  }
}
