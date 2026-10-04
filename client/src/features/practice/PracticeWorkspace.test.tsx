vi.mock("@/lib/version", () => ({ APP_VERSION: "practice-test" }));
vi.mock("@/lib/pwa", () => ({ forceUpdate: vi.fn() }));
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PracticeView } from "./PracticeWorkspace";
import { seedPractice, startPractice, advancePractice } from "@shared/practice";
function mount(chapter?: string) {
  let state = chapter ? startPractice(seedPractice(), chapter) : seedPractice();
  const save = async (input: any) => {
    state =
      input.action === "start"
        ? startPractice(state, input.chapterId)
        : input.action === "reset"
          ? seedPractice()
          : advancePractice(state, input.stepId, input.values, input.outcome);
    return state;
  };
  render(
    <PracticeView preview sessionState={state} save={save} reload={() => {}} />
  );
  return () => state;
}
describe("artist practice UI", () => {
  it("offers the mock workflow catalogue", () => {
    mount();
    expect(screen.getByText("Enquiry to confirmed booking")).toBeTruthy();
    expect(
      screen.getByText("Practice mode · No real payments or messages")
    ).toBeTruthy();
    expect(
      screen.getByText(/Progress is stored in this browser only/)
    ).toBeTruthy();
  });
  it("allows a chapter action and renders its resulting client message", async () => {
    mount("enquiry");
    fireEvent.click(screen.getByRole("button", { name: "Open request" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy()
    );
    expect(screen.getByText(/Can we plan a full-day sitting/)).toBeTruthy();
  });
  it("keeps a failed action recoverable", async () => {
    mount("enquiry");
    fireEvent.click(
      screen.getByRole("button", { name: "Test failure & retry" })
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Open request" })).toBeTruthy();
  });
  it("numeric zero can be deleted without a replacement zero", () => {
    mount("promotion");
    const input = screen.getByLabelText("Value") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
  });
  it("filters chapters", () => {
    mount();
    fireEvent.change(screen.getByLabelText("Find a workflow"), {
      target: { value: "voucher" },
    });
    expect(screen.getByText("Sell a gift voucher")).toBeTruthy();
    expect(screen.queryByText("Run a full-day sitting")).toBeNull();
  });
});
