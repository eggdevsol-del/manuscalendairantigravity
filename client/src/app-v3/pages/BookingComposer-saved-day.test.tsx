import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savedKeys } from "../design/calendarDays";
const store = vi.hoisted(() => ({ saved: {} as Record<string, string> }));
vi.mock("../data/useSavedDays", async () => {
  const { useState } = await import("react");
  return {
    useSavedDays: () => {
      const [, bump] = useState(0);
      return {
        days: store.saved,
        get: (keys: string[]) => keys.map(k => store.saved[k]).find(Boolean) ?? null,
        save: async () => {},
        forget: async (keys: string[]) => {
          for (const k of keys) delete store.saved[k];
          bump(n => n + 1);
        },
      };
    },
  };
});
const saveDay = (keys: string[], day: string) => {
  for (const k of keys) store.saved[k] = day;
};
const savedDay = (keys: string[]) => keys.map(k => store.saved[k]).find(Boolean) ?? null;
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
  store.saved = {};
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
