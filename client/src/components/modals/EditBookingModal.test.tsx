import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { checkBusinessHours } from "@shared/businessHours";
const m = vi.hoisted(() => ({ save: vi.fn(), settings: undefined as any }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutateAsync: m.save }) };
  return {
    trpc: {
      useUtils: () =>
        new Proxy({}, { get: () => ({ invalidate: async () => {} }) }),
      artistSettings: {
        get: { useQuery: () => ({ data: m.settings }) },
        getPublicByArtistId: { useQuery: () => ({ data: undefined }) },
        upsert: mutation,
      },
      clientProfile: { updateClientProfile: mutation },
      appointments: { update: mutation, batchUpdateClientPrices: mutation },
    },
  };
});
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ children }: any) => <div>{children}</div>,
}));
import { EditBookingModal } from "./EditBookingModal";

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// A two-hour sitting, moved to 8:00 pm on a Thursday; hours are 9:00 am to 5:00 pm on weekdays.
const appointment = {
  id: 7,
  artistId: "artist",
  clientId: "client",
  timeZone: zone,
  startTime: new Date("2027-02-03T10:00").toISOString(),
  endTime: new Date("2027-02-03T12:00").toISOString(),
};
const workSchedule = JSON.stringify(
  Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday"].map(day => [
      day,
      { enabled: true, start: "09:00", end: "17:00", type: "work" },
    ])
  )
);
const start = new Date("2027-02-04T20:00"),
  end = new Date("2027-02-04T22:00");
const key = `${start.toISOString()}/${end.toISOString()}`;
const open = () => {
  const done = vi.fn();
  render(
    <EditBookingModal
      isOpen
      onClose={() => {}}
      appointment={appointment}
      onSuccess={done}
    />
  );
  fireEvent.click(screen.getByText("Reschedule"));
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2027-02-04" },
  });
  fireEvent.change(screen.getByLabelText("Time"), {
    target: { value: "20:00" },
  });
  return done;
};
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Confirm reschedule" }));
const refusal = (issueKey: string) =>
  Object.assign(new Error("This sitting is outside your business hours."), {
    data: {
      outsideHours: [
        {
          ...checkBusinessHours(workSchedule, zone, start, end)!,
          key: issueKey,
        },
      ],
    },
  });
beforeEach(() => {
  m.save.mockReset().mockResolvedValue({});
  m.settings = undefined;
});

it("asks before saving when the artist's hours are known, and clears the reminder once confirmed", async () => {
  m.settings = { userId: "artist", workSchedule, timeZone: zone };
  const done = open();
  const group = screen.getByRole("group", {
    name: "Outside your business hours",
  });
  expect(group).toHaveTextContent("Ends 5 h after you close at 5:00 pm");
  expect(
    screen.getByRole("button", { name: "Change the time" })
  ).toBeInTheDocument();
  save();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Confirm this sitting"
  );
  expect(m.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Book anyway/ }));
  expect(screen.queryByRole("alert")).toBeNull();
  save();
  await waitFor(() =>
    expect(m.save).toHaveBeenCalledWith({
      id: 7,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      confirmedOutsideHours: [key],
    })
  );
  await waitFor(() => expect(done).toHaveBeenCalled());
});
it("asks about a server refusal for the time on screen, then saves with that confirmation", async () => {
  m.save.mockRejectedValueOnce(refusal(key));
  const done = open();
  expect(screen.queryByRole("group", { name: /business hours/ })).toBeNull();
  save();
  const group = await screen.findByRole("group", {
    name: "Outside your business hours",
  });
  expect(group).toHaveTextContent("Ends 5 h after you close at 5:00 pm");
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Book anyway/ }));
  save();
  await waitFor(() =>
    expect(m.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmedOutsideHours: [key] })
    )
  );
  await waitFor(() => expect(done).toHaveBeenCalled());
});
it("shows the server's message when the refusal is about a time that is not on screen", async () => {
  m.save.mockRejectedValueOnce(refusal("2027-02-03T14:00:00.000Z/other"));
  open();
  save();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This sitting is outside your business hours."
  );
  expect(screen.queryByRole("group", { name: /business hours/ })).toBeNull();
});
