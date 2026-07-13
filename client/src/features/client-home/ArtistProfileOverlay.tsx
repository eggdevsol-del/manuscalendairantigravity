/**
 * ArtistProfileOverlay — Full-screen artist profile
 * ──────────────────────────────────────────────────────
 * Expands from the header/pill when "View Profile" is tapped.
 * Shows: avatar, name, @handle, bio, contact info, 3-col portfolio grid.
 * Tapping a grid image switches to scrollable feed view (Instagram-style).
 * Contains "Book Consult" CTA that opens the inline booking form.
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Mail, Phone, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { FeedCard, FeedCardData } from "@/features/feed/FeedCard";
import BookingFormModal from "./BookingFormModal";
import { UserAvatar } from "@/components/ui/ssot";
import "./artistProfile.css";

interface ArtistProfileOverlayProps {
  artistId: string;
  artistName: string;
  artistAvatar: string | null;
  artistSlug: string | null;
  onClose: () => void;
}

export default function ArtistProfileOverlay({
  artistId,
  artistName,
  artistAvatar,
  artistSlug,
  onClose,
}: ArtistProfileOverlayProps) {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [feedViewImageId, setFeedViewImageId] = useState<number | null>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);

  const { data: profile, isLoading } = trpc.feed.getArtistPublicProfile.useQuery(
    { artistId },
    { staleTime: 60000 }
  );

  const handleBookingSubmitted = useCallback(() => {
    setShowBookingForm(false);
  }, []);

  // Convert portfolio items to FeedCardData for the feed view
  const feedCards: FeedCardData[] = useMemo(() => {
    if (!profile) return [];
    return profile.portfolio.map((item) => ({
      id: item.id,
      artistId,
      artistName: profile.displayName,
      artistAvatar: profile.avatar,
      artistCity: profile.showCity ? profile.city : null,
      artistSlug: profile.slug,
      keywords: profile.keywords,
      imageUrl: item.imageUrl,
      description: item.description,
      createdAt: null,
      likeCount: 0,
      isLiked: false,
    }));
  }, [profile, artistId]);

  // Reorder feed cards so tapped image is first
  const reorderedFeedCards = useMemo(() => {
    if (!feedViewImageId) return feedCards;
    const idx = feedCards.findIndex((c) => c.id === feedViewImageId);
    if (idx <= 0) return feedCards;
    return [...feedCards.slice(idx), ...feedCards.slice(0, idx)];
  }, [feedCards, feedViewImageId]);

  // Stub handlers for FeedCard
  const handleLike = useCallback(() => {}, []);
  const handleShare = useCallback(() => {}, []);
  const handleArtistTap = useCallback(() => {}, []);

  // Scroll feed to top when entering feed view
  useEffect(() => {
    if (feedViewImageId && feedScrollRef.current) {
      feedScrollRef.current.scrollTop = 0;
    }
  }, [feedViewImageId]);

  const inFeedView = feedViewImageId !== null;

  return (
    <>
      <motion.div
        className="artist-profile-overlay"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.25, ease: [0.12, 0, 0.04, 1] }}
      >
        {/* Header bar */}
        <div className="artist-profile-header">
          <button
            className="artist-profile-close"
            onClick={inFeedView ? () => setFeedViewImageId(null) : onClose}
          >
            back
          </button>
          <span className="artist-profile-header-name">{artistName}</span>
          <div style={{ width: 40 }} />
        </div>

        {/* Content: grid view or feed view */}
        <AnimatePresence mode="wait" initial={false}>
          {inFeedView ? (
            <motion.div
              key="feed-view"
              className="artist-profile-feed-view"
              ref={feedScrollRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="discover-feed-cards">
                {reorderedFeedCards.map((card, index) => (
                  <FeedCard
                    key={`profile-feed-${card.id}-${index}`}
                    card={card}
                    onLike={handleLike}
                    onShare={handleShare}
                    onArtistTap={handleArtistTap}
                    compact
                    focusMode
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="grid-view"
              className="artist-profile-scroll"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {isLoading ? (
                <div className="artist-profile-loading">
                  <Loader2 className="animate-spin" size={32} />
                </div>
              ) : profile ? (
                <>
                  {/* Profile info section */}
                  <div className="artist-profile-info">
                    {/* Avatar */}
                    <div className="artist-profile-avatar-large">
                      <UserAvatar name={profile.displayName} avatar={profile.avatar} size="lg" />
                    </div>

                    {/* Name & handle */}
                    <h2 className="artist-profile-name">{profile.displayName}</h2>
                    {profile.slug && (
                      <span className="artist-profile-handle">@{profile.slug}</span>
                    )}

                    {/* Bio */}
                    {profile.bio && (
                      <p className="artist-profile-bio">{profile.bio}</p>
                    )}

                    {/* Contact details (only shown if artist toggled them on) */}
                    <div className="artist-profile-contact">
                      {profile.showCity && profile.city && (
                        <div className="artist-profile-contact-item">
                          <MapPin size={14} />
                          <span>{profile.city}</span>
                        </div>
                      )}
                      {profile.email && (
                        <a
                          href={`mailto:${profile.email}`}
                          className="artist-profile-contact-item"
                        >
                          <Mail size={14} />
                          <span>{profile.email}</span>
                        </a>
                      )}
                      {profile.phone && (
                        <a
                          href={`tel:${profile.phone}`}
                          className="artist-profile-contact-item"
                        >
                          <Phone size={14} />
                          <span>{profile.phone}</span>
                        </a>
                      )}
                      {profile.website && (
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="artist-profile-contact-item"
                        >
                          <Globe size={14} />
                          <span>{profile.website}</span>
                        </a>
                      )}
                    </div>

                    {/* Keywords/styles */}
                    {profile.keywords.length > 0 && (
                      <div className="artist-profile-keywords">
                        {profile.keywords.map((kw, i) => (
                          <span key={i} className="artist-profile-keyword">{kw}</span>
                        ))}
                      </div>
                    )}

                    {/* Book CTA */}
                    <button
                      className="artist-profile-book-btn"
                      onClick={() => setShowBookingForm(true)}
                    >
                      Book Consult
                    </button>
                  </div>

                  {/* Portfolio grid — 3 columns */}
                  <div className="artist-profile-grid">
                    {profile.portfolio.map((item) => (
                      <div
                        key={item.id}
                        className="artist-profile-grid-item"
                        onClick={() => setFeedViewImageId(item.id)}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.description || "Portfolio"}
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="artist-profile-loading">
                  <p>Could not load profile</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Inline booking form */}
      <AnimatePresence>
        {showBookingForm && profile && (
          <BookingFormModal
            artistId={artistId}
            artistName={profile.displayName}
            artistSlug={profile.slug}
            onClose={() => setShowBookingForm(false)}
            onSubmitted={handleBookingSubmitted}
          />
        )}
      </AnimatePresence>
    </>
  );
}
