import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveDay, savedDay, savedKeys } from "../design/calendarDays";
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "artist" } }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    artistSettings: {
      get: {
        useQuery: () => ({
          data: {
            services: JSON.stringify([
              { name: "Day session", duration: 480, price: 1600, sittings: 1 },
            ]),
            workSchedule: JSON.stringify([
              { day: "Thursday", enabled: true, start: "10:30", end: "18:00" },
            ]),
            subscriptionTier: "free",
          },
        }),
      },
    },
    conversations: {
      getClients: { useQuery: () => ({ data: [] }) },
      getById: {
        useQuery: () => ({
          data: { clientId: "sam", otherUser: { name: "Sam Rivers" } },
        }),
      },
      getOrCreate: { useMutation: () => ({}) },
    },
    sessionPlans: { create: { useMutation: () => ({}) } },
    useUtils: () => ({}),
  },
}));
import { BookingComposer } from "./BookingComposer";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 9));
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("the day saved from Fill this day", () => {
  it("is offered when choosing dates and moves the sitting onto it", () => {
    saveDay(savedKeys("sam"), "2026-11-05");
    render(
      <BookingComposer
        conversationId={9}
        initialDate={new Date(2026, 10, 12, 9)}
        onSuccess={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Day session"));
    expect(screen.getByText("The day you saved for Sam")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(screen.getByText("Using the day you saved")).toBeTruthy();
    expect(screen.getByLabelText("Date")).toHaveProperty("value", "2026-11-05");
    expect(screen.getByLabelText("Time")).toHaveProperty("value", "10:30");
  });

  it("can be forgotten", () => {
    saveDay(savedKeys(null, 9), "2026-11-05");
    render(<BookingComposer conversationId={9} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText("Day session"));
    fireEvent.click(screen.getByLabelText("Forget this day"));
    expect(screen.queryByText(/day you saved/)).toBeNull();
    expect(savedDay(savedKeys("sam", 9))).toBeNull();
  });
});
