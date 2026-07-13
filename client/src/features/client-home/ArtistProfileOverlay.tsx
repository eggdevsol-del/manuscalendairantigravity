/**
 * ArtistProfileOverlay — Full-screen artist profile
 * ──────────────────────────────────────────────────────
 * Expands from the header/pill when "View Profile" is tapped.
 * Shows: avatar, name, @handle, bio, contact info, 3-col portfolio grid.
 * Contains "Book Consult" CTA that opens the inline booking form.
 */
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Mail, Phone, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import BookingFormModal from "./BookingFormModal";
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: profile, isLoading } = trpc.feed.getArtistPublicProfile.useQuery(
    { artistId },
    { staleTime: 60000 }
  );

  const handleBookingSubmitted = useCallback(() => {
    setShowBookingForm(false);
  }, []);

  return (
    <>
      <motion.div
        className="artist-profile-overlay"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Header bar */}
        <div className="artist-profile-header">
          <button className="artist-profile-close" onClick={onClose}>
            back
          </button>
          <span className="artist-profile-header-name">{artistName}</span>
          <div style={{ width: 40 }} />
        </div>

        {/* Scrollable content */}
        <div className="artist-profile-scroll">
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
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.displayName} />
                  ) : (
                    <span>{profile.displayName.charAt(0).toUpperCase()}</span>
                  )}
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
                    onClick={() => setSelectedImage(item.imageUrl)}
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
        </div>
      </motion.div>

      {/* Lightbox for tapped grid image */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="artist-profile-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
          >
            <img src={selectedImage} alt="Portfolio piece" />
          </motion.div>
        )}
      </AnimatePresence>

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
