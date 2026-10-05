vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-artist", role: "artist" } }),
}));
vi.mock("@/lib/version", () => ({ APP_VERSION: "practice-test" }));
vi.mock("@/lib/pwa", () => ({ forceUpdate: vi.fn() }));
vi.mock("./PracticeControls", () => ({
  PracticeControls: ({ state }: any) => (
    <div>
      <p>Actual app workspace</p>
      <p>{state.chapterId}</p>
    </div>
  ),
}));
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PracticeView } from "./PracticeWorkspace";
import { seedPractice, startPractice } from "@shared/practice";
function mount() {
  let state = seedPractice();
  const save = vi.fn(async (input: any) => {
    state = startPractice(state, input.chapterId);
    return state;
  });
  render(
    <PracticeView preview sessionState={state} save={save} reload={() => {}} />
  );
  return save;
}
describe("actual app practice entry", () => {
  it("populates the actual workspace immediately instead of showing chapter forms", async () => {
    const save = mount();
    await waitFor(() =>
      expect(screen.getByText("Actual app workspace")).toBeTruthy()
    );
    expect(screen.getByText("enquiry")).toBeTruthy();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ action: "start", chapterId: "enquiry" })
    );
    expect(screen.queryByText("Test failure & retry")).toBeNull();
  });
  it("does not expose a guide chooser", async () => {
    mount();
    await waitFor(() =>
      expect(screen.getByText("Actual app workspace")).toBeTruthy()
    );
    expect(
      screen.queryByRole("button", { name: "Choose another guide" })
    ).toBeNull();
    expect(screen.queryByLabelText("Find a workflow")).toBeNull();
  });
});
