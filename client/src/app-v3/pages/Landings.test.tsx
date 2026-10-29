import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "me", name: "Sam Rivers" } }),
}));
vi.mock("@/lib/trpc", () => {
  const q = (key: string) => ({
    useQuery: (input?: { tab?: string }) => ({
      data: m.data[input?.tab ? `${key}:${input.tab}` : key],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
  });
  return {
    trpc: {
      appointments: { getClientBookings: q("bookings") },
      conversations: { list: q("conversations") },
      offers: { list: q("offers") },
      aftercare: { getForBooking: q("aftercare") },
      feed: { getDiscoverFeed: q("feed") },
      merchantAuth: { getMerchantProfile: q("profile") },
      storefront: { getOrders: q("orders"), getProducts: q("products") },
    },
  };
});
// jsdom has no ResizeObserver; the groups only use it to measure themselves.
globalThis.ResizeObserver ||= class {
  observe() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
import ClientHome from "./ClientHome";
import SupplierHome from "./SupplierHome";

const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 9));
});
afterEach(() => vi.useRealTimers());

describe("client landing", () => {
  it("shows the next sitting, healing, forms and requests from real bookings", () => {
    m.data = {
      "bookings:upcoming": {
        appointments: [
          {
            id: 5, conversationId: 2, startsAt: at(7, 10), endsAt: at(7, 16), status: "confirmed",
            projectName: "Botanical sleeve", sessionIndex: 2, sessionTotal: 3, artist: { name: "Rory Vale" },
            pendingFormCount: 1, balanceDueCents: 120000,
          },
        ],
        pendingRequests: [{ id: 1, artistName: "Mia Chen", description: "A small moth", conversationId: 8 }],
        pendingConsults: [],
      },
      "bookings:past": {
        appointments: [{ id: 4, status: "completed", endsAt: at(1, 15), completedAt: at(1, 15), projectName: "Dagger", artist: { name: "Rory Vale" }, conversationId: 2 }],
      },
      aftercare: {
        daysSince: 4,
        totalDays: 30,
        isHealed: false,
        template: { phases: [{ id: 1, fromDay: 1, toDay: 7, label: "Peeling", instruction: "Don't pick" }] },
      },
      conversations: [{ id: 2, otherUser: { name: "Rory Vale" }, unreadCount: 2, lastMessage: { content: "See you Saturday!", messageType: "text" } }],
      feed: {
        cards: [
          { id: 9, artistId: "a", artistName: "Ana Ink", artistCity: "Brisbane", artistSlug: "anaink", keywords: ["Fine line"], tags: [], imageUrl: "/p9.jpg", mediaType: "image" },
          { id: 8, artistId: "a", artistName: "Ana Ink", artistCity: "Brisbane", artistSlug: "anaink", keywords: ["Fine line"], tags: [], imageUrl: "/p8.jpg", mediaType: "image" },
        ],
      },
    };
    render(<ClientHome />);
    // My tattoos: one postcard for each tattoo, with the sittings done.
    expect(
      screen.getByRole("link", { name: "Botanical sleeve with Rory Vale, 0 of 3 sittings done" })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dagger with Rory Vale, 1 of 1 sittings done" })).toBeTruthy();
    // Discover: one card for each artist, opening their page.
    expect(screen.getByRole("link", { name: "Ana Ink, Brisbane" }).getAttribute("href")).toBe("/anaink");
    expect(screen.getByText("Next sitting in 3 days")).toBeTruthy();
    expect(screen.getByText("with Rory Vale · sitting 2 of 3")).toBeTruthy();
    expect(screen.getByText("D4")).toBeTruthy();
    expect(screen.getByText("Day 4 of healing · Peeling")).toBeTruthy();
    expect(screen.getByText("Don't pick")).toBeTruthy();
    expect(screen.getByText("1 form for Botanical sleeve")).toBeTruthy();
    expect(screen.getByText("Waiting on Mia Chen")).toBeTruthy();
    expect(screen.getByText("Rory Vale · 2 new")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
  });
});

describe("supplier landing", () => {
  it("counts orders to pack, low stock and recent sales, and lays out the belt", () => {
    m.data = {
      profile: { businessName: "Black Lantern Supply", status: "draft", lowStockThreshold: 5, country: "AU" },
      orders: [
        { id: 11, status: "paid", totalAmountCents: 25000, currency: "AUD", buyerName: "Rory Vale", createdAt: at(3, 10), items: [{ quantity: 2 }, { quantity: 1 }] },
        { id: 10, status: "fulfilled", totalAmountCents: 9000, currency: "AUD", buyerName: "Mia Chen", createdAt: at(1, 10), items: [] },
      ],
      products: [
        { id: 1, title: "Round liners", inventoryCount: 2, variants: [] },
        { id: 2, title: "Gloves", inventoryCount: 80, variants: [] },
      ],
      conversations: [],
    };
    render(<SupplierHome />);
    expect(screen.getByText("Black Lantern Supply")).toBeTruthy();
    expect(screen.getByText("to pack").previousElementSibling?.textContent).toBe("1");
    expect(screen.getByText("$340")).toBeTruthy();
    expect(screen.getByText("Rory Vale · 3 items")).toBeTruthy();
    const belt = screen.getByLabelText("Orders by stage");
    expect(within(belt).getByText("To pack · 1")).toBeTruthy();
    expect(within(belt).getByText("On the way · 1")).toBeTruthy();
    expect(screen.getByText("Round liners")).toBeTruthy();
    expect(screen.getByText("Not published yet")).toBeTruthy();
  });
});
