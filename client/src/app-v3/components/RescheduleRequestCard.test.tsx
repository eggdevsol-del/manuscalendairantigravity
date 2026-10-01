import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  data: {} as any,
  mutate: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    reschedules: {
      get: { useQuery: () => ({ data: m.data, refetch: m.refetch }) },
      resolve: { useMutation: () => ({ mutate: m.mutate, isPending: false }) },
    },
  },
}));
vi.mock("../design/primitives", () => ({
  Panel: ({ children }: any) => <div>{children}</div>,
  Feedback: () => null,
  Action: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
import { RescheduleRequestCard } from "./RescheduleRequestCard";
beforeEach(() => {
  vi.clearAllMocks();
  m.data = {
    id: 1,
    status: "pending",
    isClient: true,
    expiresAt: "2027-01-01T00:00:00Z",
    terms: {
      sessionIndex: 2,
      offerName: "January offer",
      timeZone: "Australia/Brisbane",
      oldStart: "2027-01-05T00:00:00Z",
      newStart: "2027-02-05T00:00:00Z",
      estimateCents: 100000,
      paidCents: 20000,
      remainingCents: 80000,
      removedDiscountCents: 25000,
    },
  };
});
it("client sees revised money and explicit agreement action", () => {
  render(<RescheduleRequestCard id={1} onChange={() => {}} />);
  expect(screen.getByText("$1,000.00")).toBeTruthy();
  expect(screen.getByText("$800.00")).toBeTruthy();
  fireEvent.click(screen.getByText("Agree & reschedule"));
  expect(m.mutate).toHaveBeenCalledWith({ id: 1, action: "accept" });
});
it("artist can withdraw but cannot accept on the client's behalf", () => {
  m.data.isClient = false;
  render(<RescheduleRequestCard id={1} onChange={() => {}} />);
  expect(screen.queryByText("Agree & reschedule")).toBeNull();
  fireEvent.click(screen.getByText("Withdraw request"));
  expect(m.mutate).toHaveBeenCalledWith({ id: 1, action: "withdraw" });
});
it("expired requests show no acceptance button", () => {
  m.data.status = "expired";
  render(<RescheduleRequestCard id={1} onChange={() => {}} />);
  expect(screen.queryByText("Agree & reschedule")).toBeNull();
  expect(screen.getByText(/Expired —/)).toBeTruthy();
});
