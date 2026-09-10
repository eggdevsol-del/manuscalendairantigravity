import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  existing: false,
  claim: vi.fn(),
  profile: {
    id: "artist",
    displayName: "Jules Ink",
    slug: "jules",
    keywords: [],
    portfolio: [],
  },
}));
vi.mock("wouter", () => ({ useRoute: () => [true, { slug: "jules" }] }));
vi.mock("@/lib/pwa", () => ({ activateWaitingSWForPublicPage: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    feed: {
      getPublicArtistProfile: { useQuery: () => ({ data: state.profile }) },
    },
    auth: { claimLead: { useMutation: () => ({ mutateAsync: state.claim }) } },
  },
}));
vi.mock("@/components/ui/ssot", () => ({
  UserAvatar: () => <span>Artist photo</span>,
}));
vi.mock("@/features/client-home/BookingFormModal", () => ({
  default: ({ onPublicSubmitted }: any) => (
    <button
      onClick={() =>
        onPublicSubmitted("submitted-lead-token", "client@example.test", {
          existingUser: state.existing,
          conversationId: 42,
        })
      }
    >
      Send request
    </button>
  ),
}));
import PublicArtistProfile from "./PublicArtistProfile";
beforeEach(() => {
  state.existing = false;
  state.claim.mockClear();
});
describe("public artist request flow", () => {
  it("opens the form on the public profile and asks for a password only after submission", async () => {
    render(<PublicArtistProfile />);
    expect(screen.getByText("Jules Ink")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Min 8 characters")
    ).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Send request" })
    );
    expect(screen.getByPlaceholderText("Min 8 characters")).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
    expect(
      screen.getByRole("button", { name: "Create password & open project" })
    ).toBeInTheDocument();
    expect(state.claim).not.toHaveBeenCalled();
  });
  it("asks an existing client to sign in, with a return path to this project", async () => {
    state.existing = true;
    render(<PublicArtistProfile />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Send request" })
    );
    expect(screen.getByPlaceholderText("Min 8 characters")).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
    expect(
      screen.getByRole("button", { name: "Sign in & open project" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Other sign-in options" })
    ).toHaveAttribute("href", "/login?returnTo=%2Fprojects%2F42");
  });
});
