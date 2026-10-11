import { render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ appointments: [] as any[] }));
vi.mock("@/lib/trpc", () => ({trpc: {
  appointments: {getClientBookings: {useQuery: ({tab}: any) => ({data: {appointments: tab === "upcoming" ? state.appointments : []}})}},
  sessionPlans: {getByClient: {useQuery: () => ({data: []})}},
}}));
vi.mock("../components/Offers", () => ({ClientOffers: () => null}));
vi.mock("./Checkout", () => ({SessionPlanCheckoutSheet: () => null}));
vi.mock("../components/DetailsSheet", () => ({DetailsSheet: () => null}));
vi.mock("../design/primitives", () => {
  const Box = ({children}: any) => <div>{children}</div>;
  return {Screen: Box, Panel: Box, Section: ({title, children}: any) => <section aria-label={title}>{children}</section>, Status: Box, Feedback: () => null, SummaryCard: Box, Row: Box, Action: Box, ActionLink: Box, SittingDate: ({label}: any) => <span>{label}</span>};
});
import ClientBookings from "./ClientBookings";
function sitting(id: number, date: string, artist: string, count = 2, status = "confirmed") {
 return {id, startsAt: date, endsAt: date, status, pendingFormCount: count, conversationId: id + 100, sessionPlanId: id, sessionTotal: 1, balanceDueCents: 0, artist: {name: artist}, timeZone: "Australia/Brisbane"};
}
afterEach(cleanup);
describe("appointment-specific client forms", () => {
 it("ties next forms to the next sitting even when another artist is first in the response", () => {
  state.appointments = [sitting(2,"2099-10-14T09:00:00Z","Other Artist"),sitting(1,"2099-10-12T09:00:00Z","Next Artist")];
  render(<ClientBookings />);
  const next = screen.getByText("Forms needed for your next sitting").closest("a")!;
  expect(next).toHaveAttribute("href","/projects/101?session=1&action=forms");
  expect(next).toHaveTextContent("Next Artist");
  const others = screen.getByRole("region",{name:"Forms for other sittings"});
  expect(within(others).getByText(/Other Artist/)).toBeInTheDocument();
  expect(others.querySelector("a")).toHaveAttribute("href","/projects/102?session=2&action=forms");
  expect(others).not.toHaveTextContent("Next Artist");
 });
 it("removes completed forms on fresh appointment data and excludes inactive bookings", () => {
  state.appointments = [sitting(1,"2099-10-12T09:00:00Z","Next Artist")];
  const view = render(<ClientBookings />);
  expect(screen.getByText("Forms needed for your next sitting")).toBeInTheDocument();
  state.appointments = [sitting(1,"2099-10-12T09:00:00Z","Next Artist",0),sitting(2,"2099-10-14T09:00:00Z","Cancelled Artist",2,"cancelled")];
  view.rerender(<ClientBookings />);
  expect(screen.queryByText("Forms needed for your next sitting")).not.toBeInTheDocument();
  expect(screen.queryByRole("region",{name:"Forms for other sittings"})).not.toBeInTheDocument();
 });
});
