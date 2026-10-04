vi.mock("@/lib/pwa", () => ({ forceUpdate: vi.fn() }));
vi.mock("@/lib/version", () => ({ APP_VERSION: "practice-test" }));
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import React, { useRef, useState } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { seedPractice, startPractice } from "@shared/practice";
import {
  queryPracticeControl,
  mutatePracticeControl,
} from "@shared/practiceControls";
const providers = vi.hoisted(() => ({ stripe: vi.fn(), connect: vi.fn() }));
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: providers.stripe }));
vi.mock("@stripe/connect-js/pure", () => ({
  loadConnectAndInitialize: providers.connect,
}));
import { PracticeControls } from "./PracticeControls";
import { PRACTICE_TOURS } from "@shared/practiceTours";
import { PRACTICE_SCREENS } from "./PracticeScreens";
function Harness({
  chapter = "enquiry",
  initialRoute,
}: { chapter?: string; initialRoute?: string } = {}) {
  const [state, setState] = useState(startPractice(seedPractice(), chapter));
  const ref = useRef(state);
  ref.current = state;
  return (
    <UIDebugProvider>
      <ThemeProvider>
        <PracticeControls
          initialRoute={initialRoute}
          state={state}
          onExit={() => {}}
          resolve={async (path, input, type) => {
            if (type === "query")
              return queryPracticeControl(ref.current, path, input);
            const result = mutatePracticeControl(ref.current, path, input);
            ref.current = result.state;
            setState(result.state);
            return result.data;
          }}
        />
      </ThemeProvider>
    </UIDebugProvider>
  );
}
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
describe("isolated artist screen controls", () => {
  it.each(Object.keys(PRACTICE_TOURS))(
    "starts the %s guide at a mounted actual app control",
    async chapter => {
      render(<Harness chapter={chapter} />);
      await waitFor(() =>
        expect(document.querySelector(".practice-highlight")).toBeTruthy()
      );
      expect(document.body.textContent).not.toMatch(
        /Practice screen could not load|Unregistered practice query|not connected to practice/
      );
    }
  );

  it("opens full-size real pages with the real bottom navigation and progresses only through actual actions", async () => {
    const fetch = vi.fn(() =>
      Promise.reject(new Error("Unexpected live request"))
    );
    vi.stubGlobal("fetch", fetch);
    render(<Harness />);
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Main navigation" })
      ).toBeTruthy()
    );
    expect(screen.queryByLabelText("Explore artist screen")).toBeNull();
    expect(screen.queryByText("Practise with app controls")).toBeNull();
    await waitFor(() =>
      expect(document.querySelector('a[href="/chat/1"]')).toBeTruthy()
    );
    fireEvent.click(document.querySelector('a[href="/chat/1"]')!);
    await waitFor(() =>
      expect(screen.getByText("Write your reply")).toBeTruthy()
    );
    fireEvent.change(screen.getByPlaceholderText("Write a message…"), {
      target: { value: "What size would you like?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(screen.getByText("Alex shares a reference")).toBeTruthy()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate client response" })
    );
    await waitFor(() =>
      expect(screen.getByText("Open the conversation tools")).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Conversation tools" }));
    await waitFor(() =>
      expect(screen.getByText("Book from this conversation")).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Book in" }));
    await waitFor(() =>
      expect(screen.getByText("Choose your saved service")).toBeTruthy()
    );
    const service = screen
      .getAllByText("Full-day tattoo")
      .find(el => el.closest("button"));
    fireEvent.click(service!.closest("button")!);
    await waitFor(() =>
      expect(screen.getByText("Choose a future sitting date")).toBeTruthy()
    );
    const date = new Date();
    date.setDate(date.getDate() + 1);
    while ([0, 6].includes(date.getDay())) date.setDate(date.getDate() + 1);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: date.toLocaleDateString("en-CA") },
    });
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "09:00" },
    });
    await waitFor(() =>
      expect(screen.getByText("Review the sitting details")).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "I’ve reviewed this" })
          .hasAttribute("disabled")
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: "I’ve reviewed this" }));
    fireEvent.click(screen.getByRole("button", { name: "Review proposal" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send proposal" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    await waitFor(() =>
      expect(screen.getByText("Alex accepts and pays the deposit")).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Simulate client response" })
          .hasAttribute("disabled")
      ).toBe(false)
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate client response" })
    );
    await waitFor(() =>
      expect(screen.getByText("See the confirmed booking")).toBeTruthy()
    );
    expect(
      screen
        .getByRole("link", { name: "Calendar" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(document.body.textContent).not.toContain(
      "Practice screen could not load"
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(providers.connect).not.toHaveBeenCalled();
    expect(providers.stripe).not.toHaveBeenCalled();
  });
  it.each([
    ["promotion", "Offer a discount"],
    ["voucher", "Sell a gift card"],
  ])(
    "guides %s through the actual client promotion form and issue action",
    async (chapter, choice) => {
      render(<Harness chapter={chapter} />);
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Conversation tools" })
        ).toBeTruthy()
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Conversation tools" })
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Create promo" })
        ).toBeTruthy()
      );
      fireEvent.click(screen.getByRole("button", { name: "Create promo" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: new RegExp(choice) })
        ).toBeTruthy()
      );
      fireEvent.click(screen.getByRole("button", { name: new RegExp(choice) }));
      await waitFor(() =>
        expect(screen.getByText("Edit the offer details")).toBeTruthy()
      );
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: "I’ve reviewed this" })
            .hasAttribute("disabled")
        ).toBe(false)
      );
      fireEvent.click(
        screen.getByRole("button", { name: "I’ve reviewed this" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Preview" }));
      fireEvent.click(screen.getByRole("button", { name: "Send to client" }));
      await waitFor(() =>
        expect(screen.getByText("Return to the conversation")).toBeTruthy()
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: "Simulate client response" })
            .hasAttribute("disabled")
        ).toBe(false)
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Simulate client response" })
      );
      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Book with this offer" })
        ).toBeTruthy()
      );
      expect(screen.getByText("Book using the offer")).toBeTruthy();
      expect(providers.stripe).not.toHaveBeenCalled();
    }
  );
  it("uses the real bank page and advances after mock provider verification succeeds", async () => {
    render(<Harness chapter="bank" />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Set up payments" })
      ).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    await waitFor(() =>
      expect(screen.getByText("Approve mock verification")).toBeTruthy()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate verification approved" })
    );
    await waitFor(() =>
      expect(screen.getByText("Review payout readiness")).toBeTruthy()
    );
    expect(screen.getByText("Payouts enabled")).toBeTruthy();
    expect(providers.connect).not.toHaveBeenCalled();
  });

  it("renders every artist screen with the closed mock adapter", async () => {
    const fetch = vi.fn(() =>
      Promise.reject(new Error("Unexpected live request"))
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    for (const [, route] of PRACTICE_SCREENS) {
      render(<Harness initialRoute={route} />);
      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });
      expect(document.body.textContent, route).not.toMatch(
        /Practice screen could not load|Something went wrong|Unregistered practice query|not connected to practice/
      );
      cleanup();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(providers.stripe).not.toHaveBeenCalled();
    expect(providers.connect).not.toHaveBeenCalled();
  });
});
