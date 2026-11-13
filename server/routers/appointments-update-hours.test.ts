// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../db", () => ({
  getAppointment: async () => ({
    id: 5,
    artistId: "artist",
    clientId: "client",
    timeZone: "Australia/Brisbane",
    startTime: "2026-11-09T23:00:00.000Z",
    endTime: "2026-11-10T01:00:00.000Z",
  }),
  getArtistSettings: async () => ({
    timeZone: "Australia/Brisbane",
    workSchedule: JSON.stringify({
      tuesday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    }),
  }),
  checkAppointmentOverlap: async () => false,
  updateAppointment: m.update,
}));
import { appointmentsRouter } from "./appointments";
import { outsideHoursFromError } from "../../shared/businessHours";
const caller = () =>
  appointmentsRouter.createCaller({
    user: { id: "artist", role: "artist" },
    req: {},
    res: {},
  } as any);
beforeEach(() => m.update.mockReset().mockResolvedValue({ success: true }));

// The edit sheet sends instants. Re-reading them as wall-clock time in the appointment's zone moved them
// by the server's own offset, so the guard judged, and refused, a time the artist never chose.
it("judges and stores the instant the client sent, whatever zone the server runs in", async () => {
  const zone = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/New_York", "Australia/Brisbane"]) {
      process.env.TZ = tz;
      m.update.mockClear();
      // Tuesday 9:00–11:00 am in Brisbane: inside hours.
      await caller().update({
        id: 5,
        startTime: "2026-11-16T23:00:00.000Z",
        endTime: "2026-11-17T01:00:00.000Z",
      });
      expect(m.update.mock.calls[0][1]).toMatchObject({
        startTime: "2026-11-16T23:00:00.000Z",
        endTime: "2026-11-17T01:00:00.000Z",
      });
    }
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});
it("refuses a move outside hours under the key of the instants the client sent", async () => {
  const input = {
    id: 5,
    startTime: "2026-11-17T06:00:00.000Z",
    endTime: "2026-11-17T08:00:00.000Z",
  };
  const key = `${input.startTime}/${input.endTime}`;
  const error = await caller()
    .update(input)
    .catch(e => e);
  expect(outsideHoursFromError(error)).toMatchObject([
    { key, minutesAfter: 60 },
  ]);
  expect(m.update).not.toHaveBeenCalled();
  await caller().update({ ...input, confirmedOutsideHours: [key] });
  expect(m.update).toHaveBeenCalledOnce();
});
it("still reads a time without an offset as wall-clock time in the appointment's zone", async () => {
  await caller().update({
    id: 5,
    startTime: "2026-11-17T09:00",
    endTime: "2026-11-17T11:00",
  });
  expect(m.update.mock.calls[0][1]).toMatchObject({
    startTime: "2026-11-16T23:00:00.000Z",
    endTime: "2026-11-17T01:00:00.000Z",
  });
});
