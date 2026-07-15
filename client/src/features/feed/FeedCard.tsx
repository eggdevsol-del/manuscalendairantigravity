import React, { useState, useRef, useCallback } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface FeedCardData {
  id: number;
  artistId: string;
  artistName: string;
  artistAvatar: string | null;
  artistCity: string | null;
  artistSlug: string | null;
  keywords: string[];
  imageUrl: string;
  description: string | null;
  createdAt: string | null;
  likeCount: number;
  isLiked: boolean;
}

interface FeedCardProps {
  card: FeedCardData;
  onLike: (id: number) => void;
  onShare: (card: FeedCardData) => void;
  onArtistTap: (slug: string) => void;
  onImageTap?: (card: FeedCardData) => void;
  compact?: boolean;
  focusMode?: boolean;
}

export function FeedCard({ card, onLike, onShare, onArtistTap, onImageTap, compact, focusMode }: FeedCardProps) {
  const [liked, setLiked] = useState(card.isLiked);
  const [likeCount, setLikeCount] = useState(card.likeCount);
  const [showHeart, setShowHeart] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const lastTap = useRef(0);

  const handleLike = useCallback(() => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    onLike(card.id);
  }, [liked, card.id, onLike]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap — like
      if (!liked) {
        handleLike();
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      // Single tap — enter artist focus (after delay to check for double)
      if (onImageTap) {
        setTimeout(() => {
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
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.artistName} on d.o.t.s`,
          url: `${window.location.origin}/${card.artistSlug}`,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(
        `${window.location.origin}/${card.artistSlug}`
      );
      onShare(card);
    }
  }, [card, onShare]);

  /* ── Focus mode: full-screen immersive layout ── */
  if (focusMode) {
    return (
      <div className="feed-card feed-card-focus" onClick={handleDoubleTap}>
        {/* Full-bleed image */}
        <img
          src={card.imageUrl}
          alt={card.description || "Portfolio piece"}
          className="feed-card-focus-image"
          loading="lazy"
        />

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
          {/* Action row */}
          <div className="feed-card-focus-actions">
            <button
              className={`feed-card-focus-action-btn ${liked ? "feed-card-liked" : ""}`}
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
            >
              <Heart
                size={22}
                fill={liked ? "var(--color-danger)" : "none"}
                color={liked ? "var(--color-danger)" : "#fff"}
              />
            </button>
            <button
              className="feed-card-focus-action-btn"
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
            >
              <Share2 size={20} color="#fff" />
            </button>
            {likeCount > 0 && (
              <span className="feed-card-focus-like-count">
                {likeCount} {likeCount === 1 ? "like" : "likes"}
              </span>
            )}
          </div>

          {/* Description (collapsed by default, tap to expand) */}
          {card.description && (
            <div
              className={`feed-card-focus-desc ${descExpanded ? "expanded" : ""}`}
              onClick={(e) => { e.stopPropagation(); setDescExpanded(!descExpanded); }}
            >
              <span className="feed-card-focus-desc-name">{card.artistName}</span>{" "}
              {card.description}
            </div>
          )}

          {/* Tags (only visible when expanded) */}
          {descExpanded && card.keywords.length > 0 && (
            <div className="feed-card-focus-tags">
              {card.keywords.slice(0, 4).map((tag, i) => (
                <span key={i} className="feed-card-focus-tag">{tag}</span>
              ))}
            </div>
          )}
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
        <div
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
        </div>
      )}

      {/* Image */}
      <div className="feed-card-image-container" onClick={handleDoubleTap}>
        <img
          src={card.imageUrl}
          alt={card.description || "Portfolio piece"}
          className="feed-card-image"
          loading="lazy"
        />

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
            onClick={handleLike}
          >
            <Heart
              size={24}
              fill={liked ? "var(--color-danger)" : "none"}
              color={liked ? "var(--color-danger)" : "currentColor"}
              className={liked ? "" : "text-foreground/70"}
            />
          </button>
          <button className="feed-card-action-btn feed-card-action-disabled" disabled>
            <MessageCircle size={24} className="text-muted-foreground" />
          </button>
          <button className="feed-card-action-btn" onClick={handleShare}>
            <Share2 size={22} className="text-foreground/70" />
          </button>
        </div>
        <button className="feed-card-action-btn feed-card-action-disabled" disabled>
          <Bookmark size={24} className="text-muted-foreground" />
        </button>
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
      {card.keywords.length > 0 && (
        <div className="feed-card-tags">
          {card.keywords.slice(0, 4).map((tag, i) => (
            <span key={i} className="feed-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Book CTA — hidden in compact/focus mode */}
      {!compact && (
        <button
          className="feed-card-book-btn"
          onClick={() => card.artistSlug && onArtistTap(card.artistSlug)}
        >
          Book Consult
        </button>
      )}
    </div>
  );
}
