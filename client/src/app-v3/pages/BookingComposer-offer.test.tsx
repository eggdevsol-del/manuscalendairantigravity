import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ search: vi.fn(), services: [] as any[] }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "artist" } }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    artistSettings: {
      get: {
        useQuery: () => ({
          data: {
            services: JSON.stringify(m.services),
            subscriptionTier: "free",
          },
        }),
      },
    },
    conversations: {
      getClients: { useQuery: () => ({ data: [] }) },
      getById: {
        useQuery: () => ({
          data: { clientId: "client", otherUser: { name: "Client" } },
        }),
      },
      getOrCreate: { useMutation: () => ({}) },
    },
    sessionPlans: { create: { useMutation: () => ({}) } },
    useUtils: () => ({ booking: { checkAvailability: { fetch: m.search } } }),
  },
}));
import { BookingComposer } from "./BookingComposer";
const offer = {
  id: 7,
  rules: {
    name: "February offer",
    description: "",
    kind: "discount" as const,
    valueType: "percentage" as const,
    value: 15,
    currency: "AUD" as const,
    eligibility: "new" as const,
    expiresAt: null,
    sittingMonths: ["2027-02"],
    sittingFrom: null,
    sittingUntil: null,
    backgroundImageUrl: "",
  },
  remainingValue: 15,
  issuedAt: "2026-01-01T00:00:00Z",
  requestedAt: "2026-01-01T00:00:00Z",
  status: "discussing",
  planId: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.services = [];
});
describe("offer-driven service selection", () => {
  it("finds a single sitting automatically and goes straight to review", async () => {
    m.services = [
      { name: "Small tattoo", duration: 60, price: 100, sittings: 1 },
    ];
    m.search.mockResolvedValue({ dates: [new Date("2027-02-01T09:00:00Z")] });
    render(
      <BookingComposer
        conversationId={1}
        offer={offer}
        initialDate={new Date("2027-02-01T09:00:00Z")}
        onSuccess={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Small tattoo"));
    await screen.findByText("4 · Review & send");
    expect(m.search).toHaveBeenCalledTimes(1);
    expect(m.search.mock.calls[0][0]).toMatchObject({
      offerId: 7,
      sittings: 1,
      frequency: "single",
      serviceDuration: 60,
      artistId: "artist",
    });
    expect(screen.getByText("Promotion discount")).toBeTruthy();
  });
  it("checks all frequencies, hides unworkable ones and finds dates on selection", async () => {
    m.services = [{ name: "Sleeve", duration: 60, price: 100, sittings: 6 }];
    m.search.mockImplementation(async (input: any) => {
      if (input.frequency !== "weekly")
        throw { data: { code: "PRECONDITION_FAILED" } };
      return {
        dates: Array.from(
          { length: 6 },
          (_, i) =>
            new Date(`2027-02-${String(i + 1).padStart(2, "0")}T09:00:00Z`)
        ),
      };
    });
    render(
      <BookingComposer
        conversationId={1}
        offer={offer}
        initialDate={new Date("2027-02-01T09:00:00Z")}
        onSuccess={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Sleeve"));
    await screen.findByRole("button", { name: "Weekly" });
    expect(screen.queryByRole("button", { name: "Monthly" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Every two weeks" })
    ).toBeNull();
    expect(m.search).toHaveBeenCalledTimes(4);
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    await screen.findByText("4 · Review & send");
    expect(m.search).toHaveBeenCalledTimes(5);
  });
});
