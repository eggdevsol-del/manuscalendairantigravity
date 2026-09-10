import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
const session = vi.hoisted(() => ({
  user: { id: "artist-one", role: "artist" },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => session }));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));
import { WorkflowHelp } from "./WorkflowHelp";
beforeEach(() => {
  localStorage.clear();
  session.user = { id: "artist-one", role: "artist" };
});
describe("replayable workflow help", () => {
  it("allows reading, going back, completion and replay without navigating or changing business records", () => {
    render(<WorkflowHelp page="Today" />);
    fireEvent.click(screen.getByRole("button", { name: "Help with Today" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Get ready for your first request/ })
    );
    expect(
      screen.getByText("Make your profile recognisable")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Set your working hours and services")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish guide" }));
    expect(
      JSON.parse(localStorage.getItem("tattoi-guides-v1:artist-one")!)
    ).toEqual(["artist-start"]);
    fireEvent.click(
      screen.getByRole("button", { name: /Get ready for your first request/ })
    );
    expect(
      screen.getByText("Make your profile recognisable")
    ).toBeInTheDocument();
  });
  it("shows supplier workflows for merchants without leaking another account's read state", () => {
    localStorage.setItem(
      "tattoi-guides-v1:artist-one",
      JSON.stringify(["supplier-products"])
    );
    session.user = { id: "supplier-one", role: "merchant" };
    render(<WorkflowHelp page="Products" />);
    fireEvent.click(screen.getByRole("button", { name: "Help with Products" }));
    expect(
      screen.getByRole("button", { name: /Create and edit products/ })
    ).toHaveTextContent("Read guide");
    expect(screen.queryByText("Run your working day")).not.toBeInTheDocument();
  });
});
