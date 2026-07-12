/**
 * DiscoverFeedContent — Feed cards without header/container
 * ─────────────────────────────────────────────────────────
 * Renders only the feed cards for embedding inside ClientHome.
 * The header and scroll container are managed by the parent.
 */
import "../feed/feed.css";
import React, { useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { FeedCard, type FeedCardData } from "../feed/FeedCard";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DiscoverFeedContentProps {
  onImageTap?: (card: FeedCardData) => void;
}

export default function DiscoverFeedContent({ onImageTap }: DiscoverFeedContentProps) {
  const [, setLocation] = useLocation();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = trpc.feed.getDiscoverFeed.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: 0,
    }
  );

  const utils = trpc.useUtils();

  // Infinite scroll observer
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleLikeMutation = trpc.portfolio.toggleLike.useMutation({
    onError: () => {
      utils.feed.getDiscoverFeed.invalidate();
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

  const allCards = data?.pages.flatMap((page) => page.cards) ?? [];

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#666" }}>
        <p>Something went wrong loading the feed.</p>
      </div>
    );
  }

  if (allCards.length === 0) {
    return (
      <div className="discover-feed-empty" style={{ minHeight: "60vh" }}>
        <div className="discover-feed-empty-icon">🎨</div>
        <h2>No artists yet</h2>
        <p>When artists upload their portfolio, their work will appear here.</p>
      </div>
    );
  }

  return (
    <>
      {/* Feed cards */}
      <div className="discover-feed-cards">
        {allCards.map((card, index) => (
          <FeedCard
            key={`${card.id}-${index}`}
            card={card}
            onLike={handleLike}
            onShare={handleShare}
            onArtistTap={handleArtistTap}
            onImageTap={onImageTap}
          />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="discover-feed-load-more">
        {isFetchingNextPage && (
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        )}
      </div>
    </>
  );
}
