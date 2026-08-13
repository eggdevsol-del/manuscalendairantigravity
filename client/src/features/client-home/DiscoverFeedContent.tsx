/**
 * DiscoverFeedContent — Feed cards without header/container
 * ─────────────────────────────────────────────────────────
 * Renders only the feed cards for embedding inside ClientHome.
 * The header and scroll container are managed by the parent.
 */
import "../feed/feed.css";
import React, { useCallback, useRef, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { FeedCard, type FeedCardData } from "../feed/FeedCard";
import { useLocation } from "wouter";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface DiscoverFeedContentProps {
  onImageTap?: (card: FeedCardData) => void;
  onArtistProfileTap?: (card: FeedCardData) => void;
}

export default function DiscoverFeedContent({ onImageTap, onArtistProfileTap }: DiscoverFeedContentProps) {
  const [, setLocation] = useLocation();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = trpc.feed.getDiscoverFeed.useInfiniteQuery(
    { limit: 10, tag: activeTag || undefined },
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

  const allCards = data?.pages.flatMap((page) => page.cards.map(card => ({
    ...card,
    videoUrl: (card as any).mediaType === "video" ? `/api/ig-video/${card.id}` : null,
  }))) ?? [];

  const handleTagTap = useCallback((tag: string) => {
    setActiveTag(tag);
  }, []);

  const handleArtistTap = useCallback(
    (slug: string) => {
      // Find the card for this slug so we can pass full artist data to the profile overlay
      if (onArtistProfileTap) {
        const card = allCards.find(c => c.artistSlug === slug);
        if (card) {
          onArtistProfileTap(card);
          return;
        }
      }
      // Fallback: navigate (shouldn't normally reach here)
      setLocation(`/${slug}`);
    },
    [setLocation, onArtistProfileTap, allCards]
  );

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
      {/* Active filter pill */}
      {activeTag && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px",
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--color-bg-base)",
        }}>
          <button
            onClick={() => setActiveTag(null)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(123, 92, 245, 0.15)",
              color: "rgba(123, 92, 245, 1)",
              border: "1px solid rgba(123, 92, 245, 0.3)",
              borderRadius: 100, padding: "5px 12px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {activeTag}
            <X size={12} />
          </button>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {allCards.length} post{allCards.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Feed cards */}
      <div className="discover-feed-cards">
        {allCards.map((card, index) => (
          <FeedCard
            key={`${card.id}-${index}`}
            card={card}
            index={index}
            onLike={handleLike}
            onShare={handleShare}
            onArtistTap={handleArtistTap}
            onImageTap={onImageTap}
            onTagTap={handleTagTap}
            focusMode
            compact
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
