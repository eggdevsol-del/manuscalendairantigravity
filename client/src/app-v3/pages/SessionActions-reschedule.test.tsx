import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ save: vi.fn(), settings: undefined as any }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  artistSettings: { get: { useQuery: () => ({ data: m.settings }) } },
  appointments: Object.fromEntries(["update", "reschedule", "cancelSession", "cancelProjectSessions"].map(name => [name, { useMutation: () => ({ mutateAsync: m.save }) }])),
  dashboard: { requestPayment: { useMutation: () => ({ mutateAsync: m.save }) } },
} }));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({ SheetShell: ({ isOpen, children }: any) => isOpen ? <div>{children}</div> : null }));
vi.mock("../components/DetailsSheet", () => ({ DetailsSheet: () => null }));
import { SessionActions } from "./SessionActions";
const session = { id: 4, startsAt: "2027-02-02T23:00:00Z", endsAt: "2027-02-03T06:00:00Z", timeZone: "Australia/Brisbane", status: "confirmed", remainingCents: 90000 };
beforeEach(() => { m.save.mockReset().mockResolvedValue({}); m.settings = undefined; });
it("submits a native input edit without waiting for change or blur", async () => {
  render(<SessionActions session={session} initialMode="reschedule" onChange={() => {}} />);
  fireEvent.input(screen.getByLabelText("New date"), { target: { value: "2027-02-04" } });
  fireEvent.input(screen.getByLabelText("New time"), { target: { value: "10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ newStartTime: "2027-02-04T00:00:00.000Z", newEndTime: "2027-02-04T07:00:00.000Z" })));
});
it("blocks an unchanged time without creating a reschedule", async () => {
  render(<SessionActions session={session} initialMode="reschedule" onChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a different date or time");
  expect(m.save).not.toHaveBeenCalled();
});
// Brisbane, Monday to Friday, 9:00 am to 5:00 pm. The sitting is seven hours long.
const weekdays = JSON.stringify(Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday"].map(day => [day, { enabled: true, start: "09:00", end: "17:00", type: "work" }])));
const move = (date: string, time: string) => {
  fireEvent.input(screen.getByLabelText("New date"), { target: { value: date } });
  fireEvent.input(screen.getByLabelText("New time"), { target: { value: time } });
};
it("asks before moving a sitting past closing, then sends that sitting's confirmation", async () => {
  m.settings = { workSchedule: weekdays, timeZone: "Australia/Brisbane" };
  render(<SessionActions session={session} initialMode="reschedule" onChange={() => {}} />);
  move("2027-02-04", "12:00");
  const group = screen.getByRole("group", { name: "Outside your business hours" });
  expect(group).toHaveTextContent("Thu 4 Feb, 12:00 pm – 7:00 pm");
  expect(group).toHaveTextContent("Ends 2 h after you close at 5:00 pm");
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Confirm this sitting");
  expect(m.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Book anyway/ }));
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ newStartTime: "2027-02-04T02:00:00.000Z", confirmedOutsideHours: ["2027-02-04T02:00:00.000Z/2027-02-04T09:00:00.000Z"] })));
});
it("asks again when the time changes after a confirmation", async () => {
  m.settings = { workSchedule: weekdays, timeZone: "Australia/Brisbane" };
  render(<SessionActions session={session} initialMode="reschedule" onChange={() => {}} />);
  move("2027-02-04", "12:00");
  fireEvent.click(screen.getByRole("button", { name: /^Book anyway/ }));
  move("2027-02-04", "13:00");
  expect(screen.getByRole("button", { name: /^Book anyway/ })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(m.save).not.toHaveBeenCalled();
});
it("does not ask for a time inside business hours", async () => {
  m.settings = { workSchedule: weekdays, timeZone: "Australia/Brisbane" };
  render(<SessionActions session={session} initialMode="reschedule" onChange={() => {}} />);
  move("2027-02-04", "10:00");
  expect(screen.queryByRole("group", { name: "Outside your business hours" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ confirmedOutsideHours: [] })));
});
it("shows the same confirmation when the server refuses a time the sheet thought was fine", async () => {
  const key = "2027-02-04T00:00:00.000Z/2027-02-04T07:00:00.000Z";
  const issue = { key, startsAt: "2027-02-04T00:00:00.000Z", endsAt: "2027-02-04T07:00:00.000Z", timeZone: "Australia/Brisbane", day: "Thursday", reason: "closed", dayType: "off", minutesBefore: 0, minutesAfter: 0, opensAt: null, closesAt: null, breakStart: null, breakEnd: null, pastMidnight: false };
  m.save.mockRejectedValueOnce(Object.assign(new Error("outside hours"), { data: { outsideHours: [issue] } }));
  render(<SessionActions session={session} initialMode="reschedule" onChange={() => {}} />);
  move("2027-02-04", "10:00");
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  const group = await screen.findByRole("group", { name: "Outside your business hours" });
  expect(group).toHaveTextContent("You’re closed on Thursdays");
  expect(screen.queryByRole("alert")).toBeNull();
  await waitFor(() => expect(group).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: /^Book anyway/ }));
  fireEvent.click(screen.getByRole("button", { name: "Review new time" }));
  await waitFor(() => expect(m.save).toHaveBeenLastCalledWith(expect.objectContaining({ confirmedOutsideHours: [key] })));
});
