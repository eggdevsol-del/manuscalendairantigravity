import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Screen, Tabs } from "./primitives";
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "artist" } }),
}));
function Example({ submit }: { submit: () => void }) {
  const [tab, setTab] = useState<"Overview" | "Messages">("Overview");
  return (
    <Screen
      title="Booking"
      subheader={
        <Tabs
          items={["Overview", "Messages"]}
          value={tab}
          onChange={setTab}
          label="Booking sections"
        />
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <Tabs
          items={["Overview", "Messages"]}
          value={tab}
          onChange={setTab}
          label="Inner sections"
        />
        <p>{tab} content</p>
      </form>
    </Screen>
  );
}
describe("shared section controls", () => {
  it("associates the active page section with its panel and supports keyboard navigation", () => {
    render(<Example submit={vi.fn()} />);
    const list = screen.getByRole("tablist", { name: "Booking sections" });
    const first = list.querySelectorAll("button")[0];
    const last = list.querySelectorAll("button")[1];
    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "Messages" });
    expect(last).toHaveAttribute("aria-controls", panel.id);
    fireEvent.keyDown(last, { key: "Home" });
    expect(first).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeVisible();
  });
  it("does not accidentally submit a surrounding form when changing sections", () => {
    const submit = vi.fn();
    render(<Example submit={submit} />);
    const inner = screen.getByRole("tablist", { name: "Inner sections" });
    fireEvent.click(inner.querySelectorAll("button")[1]);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("Messages content")).toBeVisible();
  });
});
