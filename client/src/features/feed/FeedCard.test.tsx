import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedCard, type FeedCardData } from "./FeedCard";
import { toast } from "sonner";

vi.mock("@/hooks/useVideoPool", () => ({
  useVideoPool: () => ({ containerRef: null, isInView: false }),
  setGlobalMuted: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const card: FeedCardData = {
  id: 7,
  artistId: "artist",
  artistName: "Ella",
  artistAvatar: null,
  artistCity: "Brisbane",
  artistSlug: "ella",
  keywords: ["Fine Line"],
  imageUrl: "/artwork.png",
  description: "An olive branch",
  createdAt: null,
  likeCount: 4,
  isLiked: false,
};
const mount = (props = {}) =>
  render(
    <FeedCard
      card={card}
      onLike={vi.fn()}
      onShare={vi.fn()}
      onArtistTap={vi.fn()}
      focusMode
      {...props}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("Feed actions", () => {
  it("rolls back a failed like and permits retry", async () => {
    const onLike = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ liked: true });
    mount({ onLike });
    fireEvent.click(screen.getByRole("button", { name: "Like artwork" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Like artwork" })).toBeEnabled()
    );
    expect(screen.getByText("4 likes")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "Could not save your like. Please try again."
    );
    fireEvent.click(screen.getByRole("button", { name: "Like artwork" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unlike artwork" })
      ).toBeEnabled()
    );
    expect(screen.getByText("5 likes")).toBeInTheDocument();
  });

  it("prevents duplicate mutations while a like is saving", async () => {
    let resolve!: (value: { liked: boolean }) => void;
    const onLike = vi.fn(
      () =>
        new Promise<{ liked: boolean }>(done => {
          resolve = done;
        })
    );
    mount({ onLike });
    fireEvent.click(screen.getByRole("button", { name: "Like artwork" }));
    fireEvent.click(screen.getByRole("button", { name: "Unlike artwork" }));
    expect(onLike).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ liked: true }));
  });

  it("does not report a copied link when clipboard access fails", async () => {
    const onShare = vi.fn();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("Denied")
    );
    mount({ onShare });
    fireEvent.click(screen.getByRole("button", { name: "Share artwork" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not share this link. Please try again."
      )
    );
    expect(onShare).not.toHaveBeenCalled();
  });

  it("falls back to copying after a native share failure, but respects cancellation", async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    const onShare = vi.fn();
    mount({ onShare });
    fireEvent.click(screen.getByRole("button", { name: "Share artwork" }));
    await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/ella`
    );
    fireEvent.click(screen.getByRole("button", { name: "Share artwork" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("offers no broken share link for an artist without a public slug", () => {
    mount({ card: { ...card, artistSlug: null } });
    expect(
      screen.queryByRole("button", { name: "Share artwork" })
    ).not.toBeInTheDocument();
  });
});
