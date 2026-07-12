/**
 * ArtistPortfolioFeed — Focused artist portfolio view
 * ─────────────────────────────────────────────────────
 * Shows all portfolio items for a single artist in compact mode.
 * Cards start from the tapped image. Supports swipe-right to exit.
 */
import "../feed/feed.css";
import React, { useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { FeedCard, type FeedCardData } from "../feed/FeedCard";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ArtistPortfolioFeedProps {
  artistId: string;
  tappedImageId: number;
  onExit: () => void;
}

export default function ArtistPortfolioFeed({
  artistId,
  tappedImageId,
  onExit,
}: ArtistPortfolioFeedProps) {
  const [, setLocation] = useLocation();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { data, isLoading } = trpc.feed.getArtistFeed.useQuery(
    { artistId },
    { staleTime: 60000 }
  );

  const utils = trpc.useUtils();

  const toggleLikeMutation = trpc.portfolio.toggleLike.useMutation({
    onError: () => {
      utils.feed.getArtistFeed.invalidate({ artistId });
    },
  });

  const handleLike = useCallback(
    (id: number) => {
      toggleLikeMutation.mutate({ portfolioId: id });
    },
    [toggleLikeMutation]
  );

  const handleShare = useCallback((card: FeedCardData) => {
    toast.success("Link copied to clipboard");
  }, []);

  const handleArtistTap = useCallback(
    (slug: string) => {
      setLocation(`/${slug}`);
    },
    [setLocation]
  );

  // Swipe-right to exit gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(
        e.changedTouches[0].clientY - touchStartY.current
      );
      // Horizontal swipe right > 80px, and more horizontal than vertical
      if (deltaX > 80 && deltaX > deltaY * 1.5) {
        onExit();
      }
    },
    [onExit]
  );

  // Reorder cards to start from the tapped image
  const allCards = data?.cards ?? [];
  const tappedIndex = allCards.findIndex((c) => c.id === tappedImageId);
  const reorderedCards =
    tappedIndex > 0
      ? [...allCards.slice(tappedIndex), ...allCards.slice(0, tappedIndex)]
      : allCards;

  if (isLoading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}
      >
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="discover-feed-cards">
        {reorderedCards.map((card, index) => (
          <FeedCard
            key={`artist-${card.id}-${index}`}
            card={card}
            onLike={handleLike}
            onShare={handleShare}
            onArtistTap={handleArtistTap}
            compact
          />
        ))}
      </div>
    </div>
  );
}
