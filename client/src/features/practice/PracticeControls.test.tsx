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
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { seedPractice } from "@shared/practice";
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
function Harness() {
  const [state, setState] = useState(seedPractice());
  const ref = useRef(state);
  ref.current = state;
  return (
    <UIDebugProvider>
      <ThemeProvider>
        <PracticeControls
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
describe("isolated artist screen controls", () => {
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
    render(<Harness />);
    const picker = screen.getByLabelText("Explore artist screen");
    const routes = Array.from(picker.querySelectorAll("option"))
      .map(o => o.value)
      .filter(Boolean);
    for (const route of routes) {
      fireEvent.change(picker, { target: { value: route } });
      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });
      expect(document.body.textContent, route).not.toMatch(
        /Practice screen could not load|Something went wrong|Unregistered practice query|not connected to practice/
      );
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(providers.stripe).not.toHaveBeenCalled();
    expect(providers.connect).not.toHaveBeenCalled();
  });
  it("opens the real wizard without refreshing auth or contacting any live endpoint", async () => {
    const fetch = vi.fn(() =>
      Promise.reject(new Error("Unexpected live request"))
    );
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("authToken", "real-session-marker");
    localStorage.setItem("manus-runtime-user-info", "real-user-marker");
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByText("Full-day tattoo")).toBeTruthy()
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem("authToken")).toBe("real-session-marker");
    expect(localStorage.getItem("manus-runtime-user-info")).toBe(
      "real-user-marker"
    );
    expect(providers.stripe).not.toHaveBeenCalled();
    expect(providers.connect).not.toHaveBeenCalled();
  });
  it("runs embedded bank verification as a mock action without initialising Stripe", async () => {
    const fetch = vi.fn(() =>
      Promise.reject(new Error("Unexpected live request"))
    );
    vi.stubGlobal("fetch", fetch);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Bank & payouts" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Set up payments" })
      ).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Simulate verification approved" })
      ).toBeTruthy()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate verification approved" })
    );
    await waitFor(() =>
      expect(screen.getByText("Payouts enabled")).toBeTruthy()
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(providers.connect).not.toHaveBeenCalled();
    expect(providers.stripe).not.toHaveBeenCalled();
  });
});
