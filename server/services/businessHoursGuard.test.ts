// @vitest-environment node
import { expect, it, vi } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
vi.mock("./usageActions", () => ({ usageActions: {} }));
vi.mock("./systemLogService", () => ({
  sysLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLog: vi.fn(),
}));
import { publicProcedure, router } from "../_core/trpc";
import { outsideHoursFromError } from "../../shared/businessHours";
import {
  confirmedOutsideHoursInput,
  requireHoursConfirmed,
} from "./businessHoursGuard";

const settings = {
  timeZone: "Australia/Brisbane",
  workSchedule: JSON.stringify({
    monday: { enabled: true, start: "09:00", end: "17:00" },
  }),
};
// Monday 2027-02-01, 4:00–6:00 pm in Brisbane.
const sitting = {
  start: "2027-02-01T06:00:00.000Z",
  end: "2027-02-01T08:00:00.000Z",
};
const key = `${sitting.start}/${sitting.end}`;

it("lets confirmed and in-hours sittings through and refuses the rest", () => {
  expect(() => requireHoursConfirmed(settings, [sitting])).toThrow(
    "Ends 1 h after you close at 5:00 pm"
  );
  expect(() => requireHoursConfirmed(settings, [sitting], [key])).not.toThrow();
  expect(() => requireHoursConfirmed(null, [sitting])).not.toThrow();
  expect(() =>
    requireHoursConfirmed({ ...settings, workSchedule: "{}" }, [sitting])
  ).not.toThrow();
  expect(() =>
    requireHoursConfirmed(settings, [
      { start: "2027-02-01T00:00:00Z", end: "2027-02-01T02:00:00Z" },
    ])
  ).not.toThrow();
});

// The booking screens and the slot finder work in the zone a sitting is booked in, and the saved zone
// defaults to Brisbane for artists who never set it: judging there let Sydney sittings past closing through.
it("judges hours in the zone the sitting is booked in, not the saved zone", () => {
  // Monday 4:00–6:00 pm in Sydney during daylight saving, which is 3:00–5:00 pm in Brisbane.
  const sydney = {
    start: "2027-02-01T05:00:00.000Z",
    end: "2027-02-01T07:00:00.000Z",
  };
  expect(() => requireHoursConfirmed(settings, [sydney])).not.toThrow();
  expect(() =>
    requireHoursConfirmed(settings, [sydney], [], "Australia/Sydney")
  ).toThrow("Ends 1 h after you close at 5:00 pm");
  // Monday 9:00–11:00 am in Sydney is what the slot finder proposes; it must not ask.
  expect(() =>
    requireHoursConfirmed(
      settings,
      [{ start: "2027-01-31T22:00:00.000Z", end: "2027-02-01T00:00:00.000Z" }],
      [],
      "Australia/Sydney"
    )
  ).not.toThrow();
  expect(() =>
    requireHoursConfirmed(settings, [sitting], [], "Not/AZone")
  ).toThrow("Ends 1 h after you close at 5:00 pm");
});

it("sends the per-sitting detail to the client in the error data", async () => {
  const app = router({
    book: publicProcedure
      .input(confirmedOutsideHoursInput)
      .mutation(({ input }) => {
        requireHoursConfirmed(
          settings,
          [{ ...sitting, sessionIndex: 3 }],
          input
        );
        return "booked";
      }),
  });
  const call = async (input?: string[]) => {
    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      router: app,
      createContext: () => ({ user: null, req: {}, res: {} }) as any,
      req: new Request("http://localhost/trpc/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(superjson.serialize(input)),
      }),
    });
    return superjson.deserialize<any>(
      await response.json().then(body => body.error ?? body.result.data)
    );
  };
  const error = await call();
  expect(error.data.code).toBe("PRECONDITION_FAILED");
  expect(error.message).toContain("outside your business hours");
  expect(outsideHoursFromError(error)).toMatchObject([
    { key, reason: "hours", minutesAfter: 60, sessionIndex: 3 },
  ]);
  expect(await call([key])).toBe("booked");
});
