import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savedKeys } from "../design/calendarDays";

const m = vi.hoisted(() => ({
  go: vi.fn(),
  appointments: [] as any[],
  saved: {} as Record<string, string>,
}));
vi.mock("../data/useSavedDays", () => ({
  useSavedDays: () => ({
    days: m.saved,
    get: (keys: string[]) => keys.map(k => m.saved[k]).find(Boolean) ?? null,
    save: async (keys: string[], day: string) => {
      for (const k of keys) m.saved[k] = day;
    },
    forget: async () => {},
  }),
}));
vi.mock("wouter", async original => ({
  ...(await original<typeof import("wouter")>()),
  useLocation: () => ["/calendar", m.go],
  useSearch: () => "",
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "artist", role: "artist" } }),
}));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ isOpen, title, children }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));
vi.mock("../design/primitives", async original => ({
  ...(await original<typeof import("../design/primitives")>()),
  Screen: ({ children }: { children: ReactNode }) => (
    <main className="v3-scroll">{children}</main>
  ),
}));
vi.mock("./BookingComposer", () => ({
  BookingComposer: ({ initialDate }: { initialDate: Date }) => (
    <p>Composer for {initialDate.toString()}</p>
  ),
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({
    useQuery: () => ({ data, isLoading: false, refetch: vi.fn() }),
  });
  return {
    trpc: {
      studios: {
        getCurrentStudio: query(null),
        getStudioMembers: query([]),
      },
      artistSettings: {
        get: query({
          workSchedule: JSON.stringify([
            { day: "Wednesday", enabled: true, start: "10:00", end: "18:00" },
            { day: "Thursday", enabled: true, start: "10:00", end: "18:00" },
          ]),
          services: JSON.stringify([
            { name: "Day session", duration: 480, price: 1600 },
          ]),
        }),
      },
      waitlist: { list: query([]) },
      funnel: {
        getLeads: query({
          leads: [
            {
              id: 3,
              clientId: "sam",
              conversationId: 9,
              clientName: "Sam Rivers",
              projectType: "fine-line",
              budgetLabel: "$800–$1,200",
            },
          ],
        }),
      },
      projects: { summary: query(undefined) },
      appointments: {
        getArtistCalendar: (input: any) => input,
        getStudioCalendar: (input: any) => input,
      },
      useQueries: (build: any) =>
        build({
          appointments: {
            getArtistCalendar: (input: any, opts: any) => ({ input, opts }),
            getStudioCalendar: (input: any, opts: any) => ({ input, opts }),
          },
        }).map(({ input, opts }: any) => ({
          data:
            opts.enabled === false
              ? undefined
              : m.appointments.filter(
                  a =>
                    new Date(a.startTime) >= input.startDate &&
                    new Date(a.startTime) < input.endDate
                ),
          dataUpdatedAt: m.appointments.length,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
    },
  };
});
import Calendar from "./Calendar";

const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 9));
  Element.prototype.scrollTo = vi.fn();
  m.saved = {};
  m.go.mockReset();
  m.appointments = [
    {
      id: 1,
      clientName: "Alex Moreno",
      projectName: "Botanical sleeve",
      sessionIndex: 2,
      sessionTotal: 3,
      startTime: at(4, 10),
      endTime: at(4, 13),
      status: "confirmed",
      depositPaid: true,
      conversationId: 4,
    },
  ];
});
afterEach(() => vi.useRealTimers());

const dayCard = (label: string) =>
  screen.getByRole("region", { name: label });

describe("endless calendar", () => {
  it("shows full day cards with time-sized sittings and fill prompts on free future days", () => {
    render(<Calendar />);
    const today = dayCard("Wednesday 4 November");
    expect(within(today).getByText("Today")).toBeTruthy();
    expect(within(today).getByText("Alex Moreno")).toBeTruthy();
    expect(within(today).getByText("Botanical sleeve, 2 of 3")).toBeTruthy();
    expect(within(today).getByText("Fill the gap · 5h free")).toBeTruthy();
    const card = within(today).getByText("Alex Moreno").closest("button")!;
    expect(card.style.height).toBe("116px");
    expect(within(dayCard("Thursday 5 November")).getByText("Fill this day")).toBeTruthy();
    // Past days are history, not something to fill.
    expect(within(dayCard("Tuesday 3 November")).queryByText(/Fill/)).toBeNull();
  });

  it("saves the day for a request and opens it, and can book the day directly", async () => {
    render(<Calendar />);
    fireEvent.click(within(dayCard("Thursday 5 November")).getByText("Fill this day"));
    const sheet = screen.getByRole("dialog", { name: "Fill this day" });
    expect(within(sheet).getByText(/1,600/)).toBeTruthy();
    fireEvent.click(within(sheet).getByText("Quote Sam for this day"));
    await waitFor(() => expect(m.go).toHaveBeenCalledWith("/lead/3"));
    expect(m.saved[savedKeys(null, 9)[0]]).toBe("2026-11-05");

    fireEvent.click(within(sheet).getByText("Book someone yourself"));
    expect(
      screen.getByText(`Composer for ${new Date(2026, 10, 5, 10).toString()}`)
    ).toBeTruthy();
  });
});
