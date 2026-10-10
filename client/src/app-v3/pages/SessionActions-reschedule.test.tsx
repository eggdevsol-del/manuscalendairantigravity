import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  appointments: Object.fromEntries(["update", "reschedule", "cancelSession", "cancelProjectSessions"].map(name => [name, { useMutation: () => ({ mutateAsync: m.save }) }])),
  dashboard: { requestPayment: { useMutation: () => ({ mutateAsync: m.save }) } },
} }));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({ SheetShell: ({ isOpen, children }: any) => isOpen ? <div>{children}</div> : null }));
vi.mock("../components/DetailsSheet", () => ({ DetailsSheet: () => null }));
import { SessionActions } from "./SessionActions";
const session = { id: 4, startsAt: "2027-02-02T23:00:00Z", endsAt: "2027-02-03T06:00:00Z", timeZone: "Australia/Brisbane", status: "confirmed", remainingCents: 90000 };
beforeEach(() => { m.save.mockReset().mockResolvedValue({}); });
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
