import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientArtistCard } from "./ClientArtistCard";

const navigate = vi.hoisted(() => vi.fn());
const chat = vi.hoisted(() => ({
  user: { id: "client-1" } as { id: string } | null,
  create: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/home", navigate] }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: chat.user }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      conversations: { list: { invalidate: chat.invalidate } },
    }),
    conversations: {
      getOrCreate: { useMutation: () => ({ mutateAsync: chat.create }) },
    },
  },
}));
vi.mock("@/features/client-profile/PortfolioExpand", () => ({
  PortfolioExpand: ({ artistName }: { artistName: string }) => (
    <div>{artistName} artwork</div>
  ),
}));

const conversation = {
  id: 42,
  unreadCount: 2,
  otherUser: { id: "ella", name: "Ella" },
};

describe("Client artist card actions", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    navigate.mockClear();
    chat.create.mockReset();
    chat.invalidate.mockReset().mockResolvedValue(undefined);
    chat.user = { id: "client-1" };
  });
  afterEach(() => vi.restoreAllMocks());

  it("expands and collapses the portfolio without navigating to chat", async () => {
    render(<ClientArtistCard conv={conversation} />);
    const portfolio = screen.getByRole("button", {
      name: "View Ella's portfolio",
    });
    expect(portfolio).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(portfolio);
    expect(screen.getByText("Ella artwork")).toBeInTheDocument();
    expect(portfolio).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(portfolio);
    await waitFor(() =>
      expect(screen.queryByText("Ella artwork")).not.toBeInTheDocument()
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens chat without toggling the portfolio or nesting interactive buttons", () => {
    render(<ClientArtistCard conv={conversation} />);
    const portfolio = screen.getByRole("button", {
      name: "View Ella's portfolio",
    });
    const chatButton = screen.getByRole("button", { name: "Chat with Ella" });
    expect(portfolio.parentElement).toBe(chatButton.parentElement);
    expect(portfolio).not.toContainElement(chatButton);
    expect(portfolio).toHaveAttribute("type", "button");
    expect(chatButton).toHaveAttribute("type", "button");
    fireEvent.click(chatButton);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/chat/42");
    expect(chat.create).not.toHaveBeenCalled();
    expect(portfolio).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Ella artwork")).not.toBeInTheDocument();
  });

  it("opens a real conversation for a favourite-only artist and prevents duplicate requests", async () => {
    let resolveConversation!: (conversation: { id: number }) => void;
    chat.create.mockReturnValue(
      new Promise(resolve => {
        resolveConversation = resolve;
      })
    );
    render(
      <ClientArtistCard
        conv={{ ...conversation, id: "fav-ella", _isFavouriteOnly: true }}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View Ella's portfolio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Chat with Ella" }));
    expect(chat.create).toHaveBeenCalledWith({
      artistId: "ella",
      clientId: "client-1",
    });
    const pendingControls = screen.getAllByRole("button", {
      name: /Opening chat/,
    });
    expect(pendingControls).toHaveLength(2);
    for (const control of pendingControls) {
      expect(control).toBeDisabled();
      fireEvent.click(control);
    }
    expect(chat.create).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    resolveConversation({ id: 73 });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/chat/73"));
    expect(chat.invalidate).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error when the portfolio Message action cannot open a chat", async () => {
    chat.create.mockRejectedValueOnce(new Error("Offline"));
    chat.create.mockResolvedValueOnce({ id: 91 });
    render(
      <ClientArtistCard
        conv={{ ...conversation, id: "fav-ella", _isFavouriteOnly: true }}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View Ella's portfolio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Message Ella" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chat couldn't open"
    );
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry chat" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/chat/91"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(chat.create).toHaveBeenCalledTimes(2);
    expect(chat.invalidate).toHaveBeenCalledTimes(1);
  });

  it("does not create a conversation or navigate to a synthetic ID without an authenticated client", () => {
    chat.user = null;
    render(
      <ClientArtistCard
        conv={{ ...conversation, id: "fav-ella", _isFavouriteOnly: true }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Chat with Ella" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please sign in again");
    expect(chat.create).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
