/**
 * PublicArtistProfile — Public-facing artist profile (booking link flow)
 * ──────────────────────────────────────────────────────────────────────
 * Mirrors the in-app ArtistProfileOverlay layout but works without auth.
 * Rendered at /book/:slug. Auto-opens BookingFormModal as a bottom sheet.
 */
import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { UserAvatar } from "@/components/ui/ssot";
import BookingFormModal from "@/features/client-home/BookingFormModal";
import "@/features/client-home/artistProfile.css";

export default function PublicArtistProfile() {
  const [, params] = useRoute("/book/:slug");
  const slug = params?.slug;
  const [, setLocation] = useLocation();

  const [showBookingForm, setShowBookingForm] = useState(false);

  const { data: profile, isLoading, error } = trpc.feed.getPublicArtistProfile.useQuery(
    { slug: slug || "" },
    { enabled: !!slug, retry: false, staleTime: 60_000 }
  );

  // Auto-open booking form after profile loads (brief delay so profile renders)
  useEffect(() => {
    if (profile && !showBookingForm) {
      const timer = setTimeout(() => setShowBookingForm(true), 800);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const handlePublicSubmitted = useCallback((leadToken: string) => {
    setShowBookingForm(false);
    setLocation(`/signup?leadToken=${leadToken}`);
  }, [setLocation]);

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="artist-profile-overlay" style={{ position: "fixed" }}>
        <div className="artist-profile-loading">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </div>
    );
  }

  // ─── Error / Not Found ───
  if (error || !profile) {
    return (
      <div className="artist-profile-overlay" style={{ position: "fixed" }}>
        <div className="artist-profile-loading" style={{ flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>
            Artist Not Found
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", textAlign: "center", maxWidth: 280 }}>
            The booking link you followed may be broken or the artist is no longer accepting bookings.
          </p>
        </div>
      </div>
    );
  }

  // ─── Profile + Booking Form ───
  return (
    <>
      <div className="artist-profile-overlay" style={{ position: "fixed" }}>
        {/* Scroll container — matches in-app profile */}
        <div className="artist-profile-scroll">
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

            {/* City */}
            {profile.showCity && profile.city && (
              <div className="artist-profile-contact">
                <div className="artist-profile-contact-item">
                  <MapPin size={14} />
                  <span>{profile.city}</span>
                </div>
              </div>
            )}

            {/* Keywords/styles */}
            {profile.keywords.length > 0 && (
              <div className="artist-profile-keywords">
                {profile.keywords.map((kw: string, i: number) => (
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
          {profile.portfolio.length > 0 && (
            <div className="artist-profile-grid">
              {profile.portfolio.map((item: { id: number; imageUrl: string; description: string | null }) => (
                <div key={item.id} className="artist-profile-grid-item">
                  <img
                    src={item.imageUrl}
                    alt={item.description || "Portfolio"}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Footer branding */}
          <div style={{ textAlign: "center", padding: "32px 0 48px" }}>
            <span style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "var(--muted-foreground)",
            }}>
              Powered by Tattoi
            </span>
          </div>
        </div>
      </div>

      {/* Booking form — bottom sheet */}
      <AnimatePresence>
        {showBookingForm && profile && (
          <BookingFormModal
            artistId={profile.id}
            artistName={profile.displayName}
            artistSlug={profile.slug}
            onClose={() => setShowBookingForm(false)}
            onSubmitted={() => setShowBookingForm(false)}
            isPublic
            onPublicSubmitted={handlePublicSubmitted}
          />
        )}
      </AnimatePresence>
    </>
  );
}
