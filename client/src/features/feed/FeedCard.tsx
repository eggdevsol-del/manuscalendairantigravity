import React, { useState, useRef, useCallback, useEffect } from "react";
import { Heart, Share2, MapPin, Play, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideoPool, setGlobalMuted } from "@/hooks/useVideoPool";
import { toast } from "sonner";

export interface FeedCardData {
  id: number;
  artistId: string;
  artistName: string;
  artistAvatar: string | null;
  artistCity: string | null;
  artistSlug: string | null;
  keywords: string[];
  tags?: string[]; // post-level tags from Instagram hashtags
  imageUrl: string;
  description: string | null;
  createdAt: string | null;
  likeCount: number;
  isLiked: boolean;
  mediaType?: string | null;
  videoUrl?: string | null;
}

interface FeedCardProps {
  card: FeedCardData;
  onLike: (id: number) => void | Promise<{ liked: boolean }>;
  onShare: (card: FeedCardData) => void;
  onArtistTap: (slug: string) => void;
  onImageTap?: (card: FeedCardData) => void;
  onTagTap?: (tag: string) => void;
  compact?: boolean;
  focusMode?: boolean;
  discoveryMode?: boolean;
  /** Index in the feed — first 10 get eager loading */
  index?: number;
}

// Video playback is now managed by the centralized useVideoPool hook.
// See client/src/hooks/useVideoPool.ts for the pool manager.

export function FeedCard({
  card,
  onLike,
  onShare,
  onArtistTap,
  onImageTap,
  onTagTap,
  compact,
  focusMode,
  discoveryMode = false,
  index = 999,
}: FeedCardProps) {
  const [liked, setLiked] = useState(card.isLiked);
  const [likeCount, setLikeCount] = useState(card.likeCount);
  const [showHeart, setShowHeart] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [likePending, setLikePending] = useState(false);
  const likePendingRef = useRef(false);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!likePendingRef.current) {
      setLiked(card.isLiked);
      setLikeCount(card.likeCount);
    }
  }, [card.isLiked, card.likeCount]);

  useEffect(
    () => () => {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    },
    []
  );

  const isVideo = card.mediaType === "video" && !!card.videoUrl;
  const eagerLoad = index < 10;

  // Pool-managed video for both standard and focus modes
  const videoPool = useVideoPool(isVideo ? card.videoUrl! : "", card.imageUrl);

  // Mute when scrolling out of view
  useEffect(() => {
    if (!videoPool.isInView) {
      setIsMuted(true);
      setGlobalMuted(true);
    }
  }, [videoPool.isInView]);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => {
      const newMuted = !prev;
      setGlobalMuted(newMuted);
      return newMuted;
    });
  }, []);

  const handleLike = useCallback(async () => {
    if (likePendingRef.current) return;
    const previousLiked = liked;
    const previousCount = likeCount;
    likePendingRef.current = true;
    setLikePending(true);
    setLiked(!previousLiked);
    setLikeCount(Math.max(0, previousCount + (previousLiked ? -1 : 1)));
    try {
      const result = await onLike(card.id);
      if (result) {
        setLiked(result.liked);
        setLikeCount(
          Math.max(
            0,
            previousCount +
              (result.liked === previousLiked ? 0 : result.liked ? 1 : -1)
          )
        );
      }
    } catch {
      setLiked(previousLiked);
      setLikeCount(previousCount);
      toast.error("Could not save your like. Please try again.");
    } finally {
      likePendingRef.current = false;
      setLikePending(false);
    }
  }, [liked, likeCount, card.id, onLike]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      // Double tap — like
      if (!liked) {
        handleLike();
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      // Single tap — enter artist focus (after delay to check for double)
      if (onImageTap) {
        singleTapTimer.current = setTimeout(() => {
          if (Date.now() - lastTap.current >= 280) {
            // No second tap came — it's a single tap
            onImageTap(card);
          }
        }, 300);
      }
    }
    lastTap.current = now;
  }, [liked, handleLike, onImageTap, card]);

  const handleShare = useCallback(async () => {
    if (!card.artistSlug) return;
    const url = `${window.location.origin}/${encodeURIComponent(card.artistSlug)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.artistName} on Tattoi`,
          url,
        });
        return;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        )
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      onShare(card);
    } catch {
      toast.error("Could not share this link. Please try again.");
    }
  }, [card, onShare]);

  /* ── Focus mode: full-screen immersive layout ── */
  if (focusMode) {
    return (
      <div
        className={`feed-card feed-card-focus ${discoveryMode ? "ivory-discovery-card" : ""}`}
        data-tour-repeat="artwork-gesture"
        data-tour-title="Explore artwork"
        data-tour-description="Tap artwork to explore this artist’s work. Double-tap to like it. Use the artist name or profile control to view their details, and scroll to browse the feed."
        onClick={handleDoubleTap}
      >
        {onImageTap && (
          <button
            type="button"
            className="sr-only focus:not-sr-only v3-action"
            onClick={e => {
              e.stopPropagation();
              onImageTap(card);
            }}
          >
            View artwork by {card.artistName}
          </button>
        )}
        {/* Full-bleed media */}
        {isVideo ? (
          <div
            className="feed-card-focus-image"
            style={{ position: "relative", width: "100%", height: "100%" }}
          >
            {/* Dedicated video container: React leaves its DOM children untouched */}
            <div
              ref={videoPool.containerRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
            {/* Poster shown while pool hasn't assigned a video yet */}
            {!videoPool.isInView && (
              <img
                src={card.imageUrl}
                alt={card.description || "Portfolio piece"}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
            {/* Play icon overlay when not in view */}
            {!videoPool.isInView && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Play
                  size={48}
                  color="rgba(255,255,255,0.7)"
                  fill="rgba(255,255,255,0.7)"
                />
              </div>
            )}
            {/* Mute/unmute toggle */}
            {videoPool.isInView && (
              <button
                onClick={handleMuteToggle}
                className="feed-card-mute-btn"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </div>
        ) : (
          <img
            src={card.imageUrl}
            alt={card.description || "Portfolio piece"}
            className="feed-card-focus-image"
            loading={eagerLoad ? "eager" : "lazy"}
          />
        )}

        {/* Watermark: artist avatar + name (top-left) */}
        <div className="feed-card-watermark">
          <div className="feed-card-watermark-avatar">
            {card.artistAvatar ? (
              <img src={card.artistAvatar} alt={card.artistName} />
            ) : (
              <span>{card.artistName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className="feed-card-watermark-name">{card.artistName}</span>
        </div>

        {/* Bottom overlay: actions + description + tags */}
        <div className="feed-card-focus-bottom">
          {discoveryMode && (
            <div className="ivory-discovery-artist">
              <h2>{card.artistName}</h2>
              <p>
                {[card.artistCity, card.keywords[0]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {card.artistSlug && (
                <button
                  className="v3-action v3-action-primary"
                  onClick={e => {
                    e.stopPropagation();
                    onArtistTap(card.artistSlug!);
                  }}
                >
                  View artist
                </button>
              )}
            </div>
          )}
          {/* Action row */}
          <div className="feed-card-focus-actions">
            <button
              className={`feed-card-focus-action-btn ${liked ? "feed-card-liked" : ""}`}
              aria-label={liked ? "Unlike artwork" : "Like artwork"}
              aria-pressed={liked}
              disabled={likePending}
              onClick={e => {
                e.stopPropagation();
                handleLike();
              }}
            >
              <Heart
                size={22}
                fill={liked ? "var(--color-danger)" : "none"}
                color={liked ? "var(--color-danger)" : "#fff"}
              />
            </button>
            {card.artistSlug && (
              <button
                className="feed-card-focus-action-btn"
                aria-label="Share artwork"
                onClick={e => {
                  e.stopPropagation();
                  handleShare();
                }}
              >
                <Share2 size={20} color="#fff" />
              </button>
            )}
            {likeCount > 0 && (
              <span className="feed-card-focus-like-count">
                {likeCount} {likeCount === 1 ? "like" : "likes"}
              </span>
            )}
          </div>

          {/* Description (collapsed by default, tap to expand) */}
          {card.description && (
            <button
              type="button"
              aria-expanded={descExpanded}
              className={`feed-card-focus-desc ${descExpanded ? "expanded" : ""}`}
              onClick={e => {
                e.stopPropagation();
                setDescExpanded(!descExpanded);
              }}
            >
              <span className="feed-card-focus-desc-name">
                {card.artistName}
              </span>{" "}
              {card.description}
            </button>
          )}

          {/* Tags (only visible when expanded) */}
          {descExpanded &&
            (() => {
              const allTags = Array.from(
                new Set([...card.keywords, ...(card.tags || [])])
              );
              return allTags.length > 0 ? (
                <div className="feed-card-focus-tags">
                  {allTags.slice(0, 6).map((tag, i) =>
                    onTagTap ? (
                      <button
                        type="button"
                        key={i}
                        className="feed-card-focus-tag feed-card-tag-tappable"
                        onClick={e => {
                          e.stopPropagation();
                          onTagTap?.(tag);
                        }}
                      >
                        {tag}
                      </button>
                    ) : (
                      <span key={i} className="feed-card-focus-tag">
                        {tag}
                      </span>
                    )
                  )}
                </div>
              ) : null;
            })()}
        </div>

        {/* Double-tap heart animation */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              className="feed-card-heart-overlay"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Heart size={80} fill="white" color="white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── Standard mode: discovery feed layout ── */
  return (
    <div className="feed-card">
      {/* Artist header — hidden in compact mode */}
      {!compact && (
        <button
          type="button"
          disabled={!card.artistSlug}
          aria-label={`View ${card.artistName}'s profile`}
          className="feed-card-header"
          onClick={() => card.artistSlug && onArtistTap(card.artistSlug)}
        >
          <div className="feed-card-avatar">
            {card.artistAvatar ? (
              <img
                src={card.artistAvatar}
                alt={card.artistName}
                className="feed-card-avatar-img"
              />
            ) : (
              <span className="feed-card-avatar-fallback">
                {card.artistName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="feed-card-artist-info">
            <span className="feed-card-artist-name">{card.artistName}</span>
            {card.artistCity && (
              <span className="feed-card-artist-location">
                <MapPin size={10} />
                {card.artistCity}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Media */}
      <div className="feed-card-image-container" data-tour-repeat="artwork-gesture" data-tour-title="Explore artwork" data-tour-description="Tap the artwork to explore the artist’s work, or double-tap to like it. The artist name opens their profile." onClick={handleDoubleTap}>
        {onImageTap && (
          <button
            type="button"
            className="sr-only focus:not-sr-only v3-action"
            onClick={e => {
              e.stopPropagation();
              onImageTap(card);
            }}
          >
            View artwork by {card.artistName}
          </button>
        )}
        {isVideo ? (
          <div className="feed-card-image" style={{ position: "relative" }}>
            {/* Dedicated video container: React leaves its DOM children untouched */}
            <div
              ref={videoPool.containerRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
            {/* Poster shown while pool hasn't assigned a video yet */}
            {!videoPool.isInView && (
              <img
                src={card.imageUrl}
                alt={card.description || "Portfolio piece"}
                className="feed-card-image"
                loading={eagerLoad ? "eager" : "lazy"}
              />
            )}
            {/* Video badge */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "rgba(0,0,0,0.5)",
                borderRadius: 6,
                padding: "3px 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                pointerEvents: "none",
              }}
            >
              <Play size={10} color="white" fill="white" />
              <span style={{ color: "white", fontSize: 10, fontWeight: 600 }}>
                REEL
              </span>
            </div>
            {/* Mute/unmute toggle */}
            {videoPool.isInView && (
              <button
                onClick={handleMuteToggle}
                className="feed-card-mute-btn"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </div>
        ) : (
          <img
            src={card.imageUrl}
            alt={card.description || "Portfolio piece"}
            className="feed-card-image"
            loading={eagerLoad ? "eager" : "lazy"}
          />
        )}

        {/* Double-tap heart animation */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              className="feed-card-heart-overlay"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Heart size={80} fill="white" color="white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action bar */}
      <div className="feed-card-actions">
        <div className="feed-card-actions-left">
          <button
            className={`feed-card-action-btn ${liked ? "feed-card-liked" : ""}`}
            aria-label={liked ? "Unlike artwork" : "Like artwork"}
            aria-pressed={liked}
            disabled={likePending}
            onClick={handleLike}
          >
            <Heart
              size={24}
              fill={liked ? "var(--color-danger)" : "none"}
              color={liked ? "var(--color-danger)" : "currentColor"}
              className={liked ? "" : "text-foreground/70"}
            />
          </button>
          {card.artistSlug && (
            <button
              className="feed-card-action-btn"
              aria-label="Share artwork"
              onClick={handleShare}
            >
              <Share2 size={22} className="text-foreground/70" />
            </button>
          )}
        </div>
      </div>

      {/* Like count */}
      {likeCount > 0 && (
        <div className="feed-card-likes">
          {likeCount} {likeCount === 1 ? "like" : "likes"}
        </div>
      )}

      {/* Description */}
      {card.description && (
        <div className="feed-card-caption">
          <span className="feed-card-caption-name">{card.artistName}</span>{" "}
          {card.description}
        </div>
      )}

      {/* Style tags */}
      {(() => {
        const allTags = Array.from(
          new Set([...card.keywords, ...(card.tags || [])])
        );
        return allTags.length > 0 ? (
          <div className="feed-card-tags">
            {allTags.slice(0, 6).map((tag, i) =>
              onTagTap ? (
                <button
                  type="button"
                  key={i}
                  className="feed-card-tag feed-card-tag-tappable"
                  onClick={() => onTagTap?.(tag)}
                >
                  {tag}
                </button>
              ) : (
                <span key={i} className="feed-card-tag">
                  {tag}
                </span>
              )
            )}
          </div>
        ) : null;
      })()}

      {/* Book CTA — hidden in compact/focus mode */}
      {!compact && card.artistSlug && (
        <button
          className="feed-card-book-btn"
          onClick={() => card.artistSlug && onArtistTap(card.artistSlug)}
        >
          View artist
        </button>
      )}
    </div>
  );
}
