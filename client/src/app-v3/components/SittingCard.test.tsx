import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SittingCard } from "./SittingCard";
describe("shared sitting disclosure", () => {
  it("opens only the selected card inline, keeps actions separate, and collapses accessibly", () => {
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
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(button);
    const panel = document.getElementById(
      button.getAttribute("aria-controls")!
    );
    expect(panel?.previousElementSibling).toBe(button);
    expect(panel?.contains(screen.getByRole("link"))).toBe(true);
    expect(button.contains(screen.getByRole("link"))).toBe(false);
    expect(container.querySelectorAll(".v3-sitting-details")).toHaveLength(1);
    fireEvent.click(button);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
