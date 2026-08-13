import React, { useState, useRef, useCallback, useEffect } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MapPin, Play, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface FeedCardData {
  id: number;
  artistId: string;
  artistName: string;
  artistAvatar: string | null;
  artistCity: string | null;
  artistSlug: string | null;
  keywords: string[];
  tags?: string[];           // post-level tags from Instagram hashtags
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
  onLike: (id: number) => void;
  onShare: (card: FeedCardData) => void;
  onArtistTap: (slug: string) => void;
  onImageTap?: (card: FeedCardData) => void;
  onTagTap?: (tag: string) => void;
  compact?: boolean;
  focusMode?: boolean;
  /** Index in the feed — first 10 get eager loading */
  index?: number;
}

// ── Viewport-aware video hook ─────────────────────────
// Only loads and plays video when element is near the viewport.
// Pauses and unloads when out of view. Prevents iOS Safari crash
// from having dozens of <video autoPlay> elements simultaneously.
function useVideoInView(rootMargin = "200px") {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { rootMargin, threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  // Play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInView) {
      // Set src and play
      const src = video.dataset.src;
      if (src && video.src !== src) {
        video.src = src;
        video.load();
      }
      video.play().catch(() => {});
    } else {
      // Pause and unload to free memory
      video.pause();
      video.removeAttribute("src");
      video.load(); // Reset the element
    }
  }, [isInView]);

  return { containerRef, videoRef, isInView };
}

export function FeedCard({ card, onLike, onShare, onArtistTap, onImageTap, onTagTap, compact, focusMode, index = 999 }: FeedCardProps) {
  const [liked, setLiked] = useState(card.isLiked);
  const [likeCount, setLikeCount] = useState(card.likeCount);
  const [showHeart, setShowHeart] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const lastTap = useRef(0);

  const isVideo = card.mediaType === "video" && !!card.videoUrl;
  const eagerLoad = index < 10;

  // Viewport-aware video for standard mode
  const standardVideo = useVideoInView("300px");
  // Viewport-aware video for focus mode
  const focusVideo = useVideoInView("100px");

  // Mute when scrolling out of view
  useEffect(() => {
    if (!focusVideo.isInView && !standardVideo.isInView) {
      setIsMuted(true);
    }
  }, [focusVideo.isInView, standardVideo.isInView]);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => {
      const newMuted = !prev;
      // Apply to whichever video ref is active
      const video = focusVideo.videoRef.current || standardVideo.videoRef.current;
      if (video) video.muted = newMuted;
      return newMuted;
    });
  }, [focusVideo.videoRef, standardVideo.videoRef]);

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
      <div className="feed-card feed-card-focus" onClick={handleDoubleTap} ref={isVideo ? focusVideo.containerRef : undefined}>
        {/* Full-bleed media */}
        {isVideo ? (
          <>
            <video
              ref={focusVideo.videoRef}
              data-src={card.videoUrl!}
              poster={card.imageUrl}
              className="feed-card-focus-image"
              loop
              muted={isMuted}
              playsInline
            />
            {/* Play icon overlay when not in view */}
            {!focusVideo.isInView && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <Play size={48} color="rgba(255,255,255,0.7)" fill="rgba(255,255,255,0.7)" />
              </div>
            )}
            {/* Mute/unmute toggle */}
            {focusVideo.isInView && (
              <button
                onClick={handleMuteToggle}
                className="feed-card-mute-btn"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </>
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
          {descExpanded && (() => {
            const allTags = [...new Set([...card.keywords, ...(card.tags || [])])];
            return allTags.length > 0 ? (
              <div className="feed-card-focus-tags">
                {allTags.slice(0, 6).map((tag, i) => (
                  <span
                    key={i}
                    className="feed-card-focus-tag feed-card-tag-tappable"
                    onClick={(e) => { e.stopPropagation(); onTagTap?.(tag); }}
                  >
                    {tag}
                  </span>
                ))}
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

      {/* Media */}
      <div className="feed-card-image-container" onClick={handleDoubleTap} ref={isVideo ? standardVideo.containerRef : undefined}>
        {isVideo ? (
          <>
            {/* Poster image shown immediately, video loads when in viewport */}
            <img
              src={card.imageUrl}
              alt={card.description || "Portfolio piece"}
              className="feed-card-image"
              loading={eagerLoad ? "eager" : "lazy"}
              style={{ display: standardVideo.isInView ? "none" : "block" }}
            />
            <video
              ref={standardVideo.videoRef}
              data-src={card.videoUrl!}
              poster={card.imageUrl}
              className="feed-card-image"
              loop
              muted={isMuted}
              playsInline
              style={{ display: standardVideo.isInView ? "block" : "none" }}
            />
            {/* Video badge */}
            <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none" }}>
              <Play size={10} color="white" fill="white" />
              <span style={{ color: "white", fontSize: 10, fontWeight: 600 }}>REEL</span>
            </div>
            {/* Mute/unmute toggle */}
            {standardVideo.isInView && (
              <button
                onClick={handleMuteToggle}
                className="feed-card-mute-btn"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </>
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
      {(() => {
        const allTags = [...new Set([...card.keywords, ...(card.tags || [])])];
        return allTags.length > 0 ? (
          <div className="feed-card-tags">
            {allTags.slice(0, 6).map((tag, i) => (
              <span
                key={i}
                className="feed-card-tag feed-card-tag-tappable"
                onClick={() => onTagTap?.(tag)}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null;
      })()}

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
