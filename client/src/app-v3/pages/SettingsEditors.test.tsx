import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtistSetupContext } from "@/features/onboarding/ArtistSetupContext";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), onSaved: vi.fn(), user: { id: "qa-artist", role: "artist" } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  artistSettings: { get: { useQuery: () => ({ data: {}, isLoading: false }) }, upsert: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } },
  useUtils: () => ({ artistSettings: { invalidate: vi.fn() } }),
} }));
vi.mock("@/components/tooltip-tour/TourHelp", () => ({ TourHelp: () => null }));
import { BusinessEditor } from "./SettingsEditors";
const editor = () => <ArtistSetupContext.Provider value={{ step: "business", onSaved: mocks.onSaved, progress: <p>Finish setup · 1 of 5 complete</p> }}><BusinessEditor /></ArtistSetupContext.Provider>;
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
describe("business setup form", () => {
  it("shows setup progress within the page and removes redirecting navigation", () => {
    render(editor());
    expect(screen.getByText("Finish setup · 1 of 5 complete").closest(".v3-screen")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("link", { name: "tattoi" })).toBeNull();
  });
  it("restores unsaved business details after remounting", () => {
    const first = render(editor());
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "My solo studio" } });
    fireEvent.change(screen.getByLabelText("Studio address (required)"), { target: { value: "Test address" } });
    first.unmount();
    render(editor());
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("My solo studio");
    expect((screen.getByLabelText("Studio address (required)") as HTMLInputElement).value).toBe("Test address");
  });
  it("does not share a setup draft with another account", () => {
    const first = render(editor());
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Private draft" } });
    first.unmount();
    mocks.user.id = "other-artist";
    render(editor());
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("");
    mocks.user.id = "qa-artist";
  });
});
