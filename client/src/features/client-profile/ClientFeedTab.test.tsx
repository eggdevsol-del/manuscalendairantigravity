import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientFeedTab } from "./ClientFeedTab";

const fixtures = vi.hoisted(() => ({
  user: { id: "client-1" } as { id: string } | null,
  navigate: vi.fn(),
  createChat: vi.fn(),
  invalidate: vi.fn(),
  toggleFavourite: vi.fn(),
  artist: { id: "ella", name: "Ella", city: "Brisbane", keywords: "Fine Line" },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/home", fixtures.navigate] }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: fixtures.user }),
}));
vi.mock("@/features/client-profile/useFavourites", () => ({
  useFavourites: () => ({
    isFavourited: () => false,
    toggleFavourite: fixtures.toggleFavourite,
  }),
}));
vi.mock("@/features/client-profile/ArtistMapOverlay", () => ({
  ArtistMapOverlay: () => null,
}));
vi.mock("@/features/client-profile/PortfolioExpand", () => ({
  PortfolioExpand: ({ artistName }: { artistName: string }) => (
    <p>{artistName} artwork</p>
  ),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      conversations: { list: { invalidate: fixtures.invalidate } },
    }),
    auth: {
      listArtists: {
        useQuery: () => ({ data: [fixtures.artist], isLoading: false }),
      },
    },
    conversations: {
      getOrCreate: {
        useMutation: () => ({ mutateAsync: fixtures.createChat }),
      },
    },
    consultations: { create: { useMutation: () => ({ mutate: vi.fn() }) } },
    upload: { uploadImage: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
  },
}));

describe("Discover artist card controls in the Home feed", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    fixtures.user = { id: "client-1" };
    fixtures.navigate.mockReset();
    fixtures.createChat.mockReset();
    fixtures.invalidate.mockReset().mockResolvedValue(undefined);
    fixtures.toggleFavourite.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps portfolio, favourite and consultation actions independent without nested buttons", async () => {
    const { container } = render(
      <ClientFeedTab conversations={[]} setIsShopExpanded={vi.fn()} />
    );
    expect(container.querySelector("button button")).toBeNull();
    const portfolio = screen.getByRole("button", {
      name: "View Ella's portfolio",
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to favourites" }));
    expect(fixtures.toggleFavourite).toHaveBeenCalledWith("ella");
    expect(portfolio).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(
      screen.getByRole("button", { name: "Request consultation with Ella" })
    );
    expect(screen.getByText("1 · Style & Placement")).toBeInTheDocument();
    expect(portfolio).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(
      screen.getByRole("button", { name: "Hide consultation with Ella" })
    );
    await waitFor(() =>
      expect(
        screen.queryByText("1 · Style & Placement")
      ).not.toBeInTheDocument()
    );
    fireEvent.click(portfolio);
    expect(screen.getByText("Ella artwork")).toBeInTheDocument();
    expect(portfolio).toHaveAttribute("aria-expanded", "true");
    expect(fixtures.createChat).not.toHaveBeenCalled();
    expect(fixtures.navigate).not.toHaveBeenCalled();
  });

  it("keeps chat creation independent of expansion and provides a working retry", async () => {
    fixtures.createChat
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ id: 71 });
    render(<ClientFeedTab conversations={[]} setIsShopExpanded={vi.fn()} />);
    const portfolio = screen.getByRole("button", {
      name: "View Ella's portfolio",
    });
    fireEvent.click(screen.getByRole("button", { name: "Chat with Ella" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chat couldn't open"
    );
    expect(portfolio).toHaveAttribute("aria-expanded", "false");
    expect(fixtures.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry chat" }));
    await waitFor(() =>
      expect(fixtures.navigate).toHaveBeenCalledWith("/chat/71")
    );
    expect(fixtures.createChat).toHaveBeenCalledWith({
      artistId: "ella",
      clientId: "client-1",
    });
    expect(fixtures.invalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shares pending protection between the portfolio Message and header Chat controls", async () => {
    let resolveChat!: (conversation: { id: number }) => void;
    fixtures.createChat.mockReturnValue(
      new Promise(resolve => {
        resolveChat = resolve;
      })
    );
    render(<ClientFeedTab conversations={[]} setIsShopExpanded={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "View Ella's portfolio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Message Ella" }));
    const pendingControls = screen.getAllByRole("button", {
      name: /Opening chat/,
    });
    expect(pendingControls).toHaveLength(2);
    for (const control of pendingControls) {
      expect(control).toBeDisabled();
      fireEvent.click(control);
    }
    expect(fixtures.createChat).toHaveBeenCalledTimes(1);
    resolveChat({ id: 81 });
    await waitFor(() =>
      expect(fixtures.navigate).toHaveBeenCalledWith("/chat/81")
    );
  });
});
