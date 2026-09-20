import { response as base, artist, client } from "./base-fixtures.mjs";
const photo = "/__ivory_artwork.png";
const person = {
  ...artist,
  displayName: "Ella Morgan",
  city: "Brisbane",
  bio: "Fine-line botanicals. Thoughtfully made, just for you.",
  publicSlug: "ella-morgan",
  slug: "ella-morgan",
  avatar: null,
};
export function response(name, role) {
  if(name === "storefront.getOrders") return base(name,role).map(o=>({...o,items:o.items.map(i=>({...i,priceAtPurchaseCents:i.priceCents}))}));
  if (name === "auth.me")
    return role === "public"
      ? null
      : role === "admin"
        ? { ...artist, role: "admin" }
        : base(name, role);
  if (name === "feed.getPublicArtistProfile" || name === "feed.getArtistPublicProfile")
    return {
      ...person,
      artistId: artist.id,
      portfolio: [
        {
          id: 1,
          imageUrl: photo,
          description: "Botanical study",
          mediaType: "image",
        },
      ],
      media: [{ id: 1, imageUrl: photo }],
      styles: ["Fine Line"],
      keywords: ["Fine Line"],
      showStore: true,
      showEvents: true,
    };
  if (
    name === "feed.getDiscoverFeed" ||
    name === "feed.getFeed" ||
    name === "feed.getArtistFeed"
  )
    return {
      cards: [
        {
          id: 1,
          artistId: artist.id,
          artistName: artist.name,
          artistSlug: "ella-morgan",
          artistAvatar: null,
          artistCity: "Brisbane",
          keywords: ["Fine Line"],
          imageUrl: photo,
          description: "A botanical study. Made to grow with you.",
          likeCount: 24,
          isLiked: false,
          mediaType: "image",
        },
      ],
      nextCursor: null,
    };
  if (name === "feed.getArtistPortfolio")
    return [
      {
        id: 1,
        imageUrl: photo,
        description: "Botanical study",
        mediaType: "image",
      },
    ];
  if (name === "studios.getCurrentStudio")
    return {
      id: "studio-test",
      name: "Northside Studio",
      role: "owner",
      stripeSubscriptionId: "fixture",
      subscriptionStatus: "active",
      publicSlug: "northside",
    };
  if (name === "studios.getStudioMembers")
    return [
      { id: "member-1", status: "active", role: "owner", user: artist },
      {
        id: "member-2",
        status: "active",
        role: "artist",
        user: {
          id: "artist-2",
          name: "Oliver Grant",
          email: "oliver@example.test",
        },
      },
    ];
  if (name === "appointments.getStudioCalendar")
    return base("appointments.getArtistCalendar", role);
  if (name === "billing.studioOffer")
    return {
      priceCents: 9900,
      currency: "AUD",
      interval: "month",
      name: "Studio",
    };
  if (
    name === "feed.getPublicStudio" ||
    name === "studios.getPublicStudio" ||
    name === "studios.getStudioProfile"
  )
    return {
      studio: {
        id: "studio-test",
        name: "Northside Studio",
        address: "Brisbane",
      },
      artists: [person],
    };
  if (name === "forms.getProcedureLogs") return [];
  if (name === "notifications.getTemplates")
    return [
      {
        id: 1,
        title: "Healed photo",
        body: "Hi, how is your tattoo healing? I would love to see a healed photo when you are ready.",
        content: "Hi, how is your tattoo healing?",
      },
    ];
  if (name === "artistSettings.get") {
    const x = base(name, role);
    return {
      ...x,
      displayName: artist.name,
      subscriptionTier: "pro",
      bio: person.bio,
      portfolioImages: [{ id: 1, imageUrl: photo }],
      workSchedule: JSON.stringify({
        monday: { enabled: true, start: "09:00", end: "17:00" },
        thursday: { enabled: true, start: "09:00", end: "17:00" },
      }),
    };
  }
  if (name === "conversations.list")
    return base(name, role).map(x => ({
      ...x,
      lastMessage: {
        content: "I love the peonies. Could we leave room to extend it later?",
        messageType: "text",
      },
      unreadCount: 2,
    }));
  if (name === "storefront.getArtistStorefront")
    return {
      artistId: artist.id,
      artistName: artist.name,
      currency: "AUD",
      products: [
        {
          id: 1,
          title: "Botanical art print",
          artistId: artist.id,
          description: "An original studio drawing on archival paper.",
          priceCents: 4500,
          inventoryCount: 12,
          isActive: true,
          fulfillmentType: "delivery",
          imageUrl: photo,
          variants: [],
        },
      ],
    };
  if (name === "storefront.getPublicSeminars") return [];
  if (name === "reconciliation.overview")
    return { plans: [], notifications: [], forms: [] };
  if (name === "errorLog.list") return { errors: [], total: 0 };
  if (name === "funnel.getLead")
    return {
      id: 1,
      clientName: client.name,
      firstName: "Mia",
      lastName: "Chen",
      email: "mia@example.test",
      status: "new",
      description:
        "Fine-line peonies for my forearm, with room to extend later.",
      placement: "Forearm",
      size: "Medium",
      style: "Fine Line",
      referenceImages: [photo],
      bodyPlacementImages: [],
      stylePreferences: ["Fine Line"],
      projectDescription:
        "Fine-line peonies for my forearm, with room to extend later.",
      conversationId: 12,
    };
  if (name === "storefront.getProducts")
    return base(name, role).map(p => ({
      ...p,
      variants: [
        {
          id: 1,
          name: "0.30 mm · Round liner",
          inventoryCount: 24,
          priceCents: 3200,
        },
      ],
    }));
  if (name === "portfolio.list")
    return [
      {
        id: 1,
        imageUrl: photo,
        description: "Botanical study",
        mediaType: "image",
      },
    ];
  if (name === "forms.getTemplates")
    return {
      medicalTemplate:
        "Sample for visual review only.\n1. Do you have any allergies?",
      consentTemplate:
        "Sample for visual review only. Review your artist’s full consent information before signing.",
    };
  if (name === "payouts.earningsBreakdown")
    return {
      grossCents: 60000,
      artistFeeCents: 0,
      refundsCents: 0,
      netCents: 60000,
      platformFeeCents: 2040,
    };
  if (name === "payouts.payoutHistory")
    return {
      payouts: [
        {
          id: "po-fixture",
          amountCents: 60000,
          currency: "AUD",
          arrivalDate: "2026-09-11",
          status: "paid",
          bankLast4: "1234",
        },
      ],
      entries: [
        {
          id: 1,
          type: "deposit",
          clientName: client.name,
          amountCents: 15000,
          platformFeeCents: 510,
          artistFeeCents: 0,
          netCents: 15000,
          createdAt: "2026-09-09T00:00:00Z",
          stripePaymentId: "pi_fixture",
        },
      ],
      hasMore: false,
    };
  if (name === "payouts.refundPreview")
    return { amountCents: 15510, currency: "AUD", sessionCount: 1 };
  if (name === "funnel.getDepositInfo" || name === "funnel.getBalanceInfo")
    return {
      status: "pending",
      projectType: "Botanical sleeve",
      artistName: artist.name,
      depositAmount: 15000,
      depositAmountCents: 15000,
      depositCents: 15000,
      remainingBalanceCents: 45000,
      balanceDueCents: 45000,
      balanceCents: 45000,
      platformFeeCents: name.includes("Deposit") ? 510 : 1530,
      clientTotalCents: name.includes("Deposit") ? 15510 : 46530,
      paymentMethods: { stripe: true, bank: false, cash: false },
    };
  if (name === "funnel.getPaymentRequestInfo")
    return {
      requestId: 1,
      artistName: artist.name,
      amountCents: 45000,
      description: "Botanical sleeve balance",
      fees: { clientTotalCents: 46530, platformFeeCents: 1530 },
    };
  if (name === "projects.clientWorkspace")
    return {
      client: { ...client, email: "mia@example.test", phone: "0400000000" },
      conversationId: 12,
      sessions: base("appointments.getArtistCalendar", role),
      forms: [],
      notes: [],
    };
  if (name === "instagram.getLatestImport") return null;
  return base(name, role);
}
