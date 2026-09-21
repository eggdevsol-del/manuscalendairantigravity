import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SittingCard } from "./SittingCard";
vi.mock("@/_core/contexts/UIDebugContext", () => ({
  useUIDebug: () => ({ showDebugLabels: false }),
}));
describe("shared sitting sheet", () => {
  it("portals details outside the card and closes without changing the page", async () => {
    const { container } = render(
      <>
        <SittingCard title="Sitting 1">
          <a href="/one">Open sitting</a>
        </SittingCard>
        <SittingCard title="Sitting 2">
          <p>Second balance</p>
        </SittingCard>
      </>
    );
    const button = screen.getByRole("button", { name: "Sitting 1" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Sitting 1" });
    expect(container.contains(sheet)).toBe(false);
    expect(
      within(sheet).getByRole("link", { name: "Open sitting" })
    ).toBeTruthy();
    expect(screen.queryByText("Second balance")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
});
