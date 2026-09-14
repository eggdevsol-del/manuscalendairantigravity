import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioExpand } from "./PortfolioExpand";

const fixtures = vi.hoisted(() => ({
  artwork: [
    {
      id: 1,
      imageUrl: "/olive.jpg",
      description: "Olive branch",
      mediaType: "image",
    },
    { id: 2, imageUrl: "/fern.jpg", description: "Fern", mediaType: "image" },
  ],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    portfolio: {
      list: { useQuery: () => ({ data: fixtures.artwork, isLoading: false }) },
    },
  },
}));

describe("Portfolio artwork viewer", () => {
  it("provides one close control while keeping previous and next artwork navigation", async () => {
    const { container } = render(
      <PortfolioExpand artistId="ella" artistName="Ella" />
    );
    const trigger = screen.getByRole("button", { name: "View Olive branch" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Ella’s portfolio" });
    expect(container).not.toContainElement(dialog);
    expect(
      within(dialog).getAllByRole("button", { name: /close/i })
    ).toHaveLength(1);
    expect(within(dialog).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Next artwork" })
    );
    expect(
      within(dialog).getByRole("img", { name: "Fern" })
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Previous artwork" })
    );
    expect(
      within(dialog).getByRole("img", { name: "Olive branch" })
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close artwork" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("navigates artwork with arrow keys and dismisses with Escape", async () => {
    render(<PortfolioExpand artistId="ella" artistName="Ella" />);
    const trigger = screen.getByRole("button", { name: "View Olive branch" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(
      within(dialog).getByRole("img", { name: "Fern" })
    ).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(
      within(dialog).getByRole("img", { name: "Olive branch" })
    ).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
