import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ skip: vi.fn(), next: vi.fn() }));
vi.mock("./TooltipTourProvider", () => ({
  useTooltipTour: () => ({
    activeTour: {
      id: "page",
      steps: [
        {
          targetId: "button",
          title: "Book a sitting",
          body: "Open the booking tools.",
        },
      ],
    },
    currentStep: 0,
    getTarget: () => document.getElementById("app-button"),
    nextStep: mocks.next,
    previousStep: vi.fn(),
    skipTour: mocks.skip,
  }),
}));
import { TooltipOverlay } from "./TooltipOverlay";
beforeEach(() => {
  mocks.skip.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("dismisses outside clicks without consuming the underlying app action", () => {
  const click = vi.fn();
  render(
    <>
      <button id="app-button" onClick={click}>
        App booking
      </button>
      <TooltipOverlay />
    </>
  );
  const button = screen.getByRole("button", { name: "App booking" });
  fireEvent.pointerDown(button);
  fireEvent.click(button);
  expect(mocks.skip).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalledTimes(1);
});
it("keeps guide content clicks inside and offers a direct close", () => {
  render(<TooltipOverlay />);
  fireEvent.pointerDown(screen.getByText("Book a sitting"));
  expect(mocks.skip).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
  expect(mocks.skip).toHaveBeenCalledTimes(1);
});
