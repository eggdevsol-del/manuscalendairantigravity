/**
 * PublicArtistProfile — Public-facing artist profile (booking link flow)
 * ──────────────────────────────────────────────────────────────────────
 * Mirrors the in-app ArtistProfileOverlay layout but works without auth.
 * Rendered at /book/:slug. Auto-opens BookingFormModal as a bottom sheet.
 * After submission, shows inline password prompt → claimLead → auto sign-in.
 */
import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { UserAvatar } from "@/components/ui/ssot";
import BookingFormModal from "@/features/client-home/BookingFormModal";
import { toast } from "sonner";
import { activateWaitingSWForPublicPage } from "@/lib/pwa";
import "@/features/client-home/artistProfile.css";

export default function PublicArtistProfile() {
  const [, params] = useRoute("/book/:slug");
  const slug = params?.slug;

  const [showBookingForm, setShowBookingForm] = useState(false);

  // Post-submission auth state
  const [leadToken, setLeadToken] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const { data: profile, isLoading, error } = trpc.feed.getPublicArtistProfile.useQuery(
    { slug: slug || "" },
    { enabled: !!slug, retry: false, staleTime: 60_000 }
  );

  // Auto-activate any waiting SW on public pages (no UpdateBanner here)
  useEffect(() => {
    activateWaitingSWForPublicPage();
  }, []);

  const claimLead = trpc.auth.claimLead.useMutation();

  // Auto-open booking form after profile loads (brief delay so profile renders)
  useEffect(() => {
    if (profile && !showBookingForm && !leadToken) {
      const timer = setTimeout(() => setShowBookingForm(true), 800);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const handlePublicSubmitted = useCallback((token: string, email: string) => {
    setShowBookingForm(false);
    setLeadToken(token);
    setLeadEmail(email);
  }, []);

  const handleSetPassword = async () => {
    if (!leadToken || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setClaiming(true);
    try {
      const result = await claimLead.mutateAsync({
        leadToken,
        password,
      });

      // Store auth token and sign in (same pattern as Login.tsx)
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      localStorage.setItem("authToken", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));

      toast.success("Account created! Signing you in...");

      // Hard reload to conversations page so auth context reinitialises
      setTimeout(() => {
        window.location.href = "/conversations";
      }, 500);
    } catch (err: any) {
      console.error("[PublicBooking] claimLead failed:", err);
      toast.error(err?.message || "Failed to create account. Please try again.");
      setClaiming(false);
    }
  };

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

  // ─── Profile + Booking Form + Password Prompt ───
  return (
    <>
      <div className="artist-profile-overlay" style={{ position: "fixed" }}>
        {/* Scroll container — matches in-app profile */}
        <div className="artist-profile-scroll">
          {/* Profile info section */}
          <div className="artist-profile-info">
            <div className="artist-profile-avatar-large">
              <UserAvatar name={profile.displayName} avatar={profile.avatar} size="lg" />
            </div>

            <h2 className="artist-profile-name">{profile.displayName}</h2>
            {profile.slug && (
              <span className="artist-profile-handle">@{profile.slug}</span>
            )}

            {profile.bio && (
              <p className="artist-profile-bio">{profile.bio}</p>
            )}

            {profile.showCity && profile.city && (
              <div className="artist-profile-contact">
                <div className="artist-profile-contact-item">
                  <MapPin size={14} />
                  <span>{profile.city}</span>
                </div>
              </div>
            )}

            {profile.keywords.length > 0 && (
              <div className="artist-profile-keywords">
                {profile.keywords.map((kw: string, i: number) => (
                  <span key={i} className="artist-profile-keyword">{kw}</span>
                ))}
              </div>
            )}

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
              Powered by d.o.t.s
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

      {/* ═══ Inline Password Prompt ═══ */}
      <AnimatePresence>
        {leadToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 70,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                width: "100%",
                maxWidth: 380,
                background: "var(--card)",
                borderRadius: 20,
                padding: "32px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Success icon */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--color-success, #22c55e)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--foreground)",
                  margin: 0,
                }}>
                  Booking Submitted!
                </h3>
                <p style={{
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  marginTop: 6,
                }}>
                  Set a password to access your account
                </p>
              </div>

              {/* Email (read-only) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 600,
                  color: "var(--muted-foreground)",
                }}>
                  Email
                </label>
                <div style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                  fontSize: 14,
                  opacity: 0.7,
                }}>
                  {leadEmail}
                </div>
              </div>

              {/* Password input */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 600,
                  color: "var(--muted-foreground)",
                }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
                    style={{
                      width: "100%",
                      padding: "12px 44px 12px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--secondary)",
                      color: "var(--foreground)",
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSetPassword}
                disabled={password.length < 8 || claiming}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: password.length >= 8 && !claiming ? "pointer" : "default",
                  opacity: password.length < 8 || claiming ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {claiming && <Loader2 size={16} className="animate-spin" />}
                {claiming ? "Creating account..." : "Set Password & Sign In"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
