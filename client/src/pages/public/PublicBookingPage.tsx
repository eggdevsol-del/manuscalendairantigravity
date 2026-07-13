/**
 * PublicBookingPage — Full-page public booking form (link-in-bio flow)
 * ────────────────────────────────────────────────────────────────────
 * No auth required. Three states:
 *  1. Form         — personal info + booking details
 *  2. Success+Auth — confirmation + password / Google sign-in
 *  3. Complete     — signed in, redirect to /conversations
 */
import { useState, useCallback, useRef, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import { Loader2, CheckCircle, Camera, X, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { tokens, typography } from "@/ui/tokens";
import { UserAvatar } from "@/components/ui/ssot/UserAvatar";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { useGoogleAuthReady } from "@/lib/google-auth";

// ── Constants (SSOT — same as BookingFormModal) ──────────────────────

const STYLE_OPTIONS = [
  "Traditional", "Neo-Traditional", "Realism", "Black & Grey",
  "Japanese", "Geometric", "Watercolour", "Minimalist",
  "Dotwork", "Tribal", "Script/Lettering", "Illustrative",
  "Surrealism", "Trash Polka", "Fine Line", "Other",
];

const SIZE_OPTIONS = [
  "Tiny (< 5cm)", "Small (5-10cm)", "Medium (10-20cm)",
  "Large (20-30cm)", "Extra Large (30cm+)", "Full sleeve", "Half sleeve",
];

const TIMEFRAME_OPTIONS = [
  "As soon as possible", "Within 1 month", "Within 3 months",
  "Within 6 months", "No rush — flexible",
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

// ── Types ────────────────────────────────────────────────────────────

type PageState = "form" | "success" | "complete";

interface LocalImage {
  file: File;
  preview: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isEmailValid = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Motion variants ──────────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

// ── Tailwind class constants (SSOT) ─────────────────────────────────

const inputClasses =
  "w-full h-12 rounded-xl bg-secondary/50 border border-border px-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-[15px]";

const sectionClasses = "rounded-2xl bg-card border border-border p-6";

const sectionHeaderClasses =
  "text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4";

const chipBase =
  "px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all select-none";
const chipSelected = "bg-primary text-white border-primary";
const chipUnselected =
  "bg-secondary/50 text-foreground border-border hover:bg-secondary/70";

// ══════════════════════════════════════════════════════════════════════

export default function PublicBookingPage() {
  const [, params] = useRoute("/book/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "";

  // ── Artist data ────────────────────────────────────────────────────
  const {
    data: artist,
    isLoading: artistLoading,
    error: artistError,
  } = trpc.funnel.getArtistBySlug.useQuery(
    { slug },
    { enabled: !!slug, retry: false },
  );

  // ── Page state ─────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>("form");
  const [leadToken, setLeadToken] = useState("");

  // ── Personal info ──────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");

  // ── Booking details ────────────────────────────────────────────────
  const [description, setDescription] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [placement, setPlacement] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [referenceImages, setReferenceImages] = useState<LocalImage[]>([]);
  const [placementImages, setPlacementImages] = useState<LocalImage[]>([]);

  // ── Auth state (success screen) ────────────────────────────────────
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [claiming, setClaiming] = useState(false);

  // ── Submission state ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Refs ────────────────────────────────────────────────────────────
  const refImageInput = useRef<HTMLInputElement>(null);
  const placementImageInput = useRef<HTMLInputElement>(null);

  // ── tRPC mutations ─────────────────────────────────────────────────
  const uploadImage = trpc.funnel.uploadPublicImage.useMutation();
  const submitBooking = trpc.funnel.submitPublicBooking.useMutation();
  const claimLead = trpc.auth.claimLead.useMutation();

  const googleAuthReady = useGoogleAuthReady();

  // ── Derived ────────────────────────────────────────────────────────
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length > 0 &&
    isEmailValid(email) &&
    description.trim().length >= 10 &&
    selectedStyles.length > 0 &&
    !submitting;

  const canSetPassword =
    password.length >= 8 &&
    password === passwordConfirm &&
    !claiming;

  // ── Handlers ───────────────────────────────────────────────────────

  const toggleStyle = useCallback((style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style],
    );
  }, []);

  const handleFilesSelected = useCallback(
    (e: ChangeEvent<HTMLInputElement>, type: "reference" | "placement") => {
      const files = Array.from<File>(e.target.files || []);
      const newImages: LocalImage[] = files.slice(0, 5).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      if (type === "reference") {
        setReferenceImages((prev) => [...prev, ...newImages].slice(0, 5));
      } else {
        setPlacementImages((prev) => [...prev, ...newImages].slice(0, 5));
      }
      e.target.value = "";
    },
    [],
  );

  const removeImage = useCallback(
    (index: number, type: "reference" | "placement") => {
      const setter = type === "reference" ? setReferenceImages : setPlacementImages;
      setter((prev) => {
        URL.revokeObjectURL(prev[index].preview);
        return prev.filter((_, i) => i !== index);
      });
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !slug) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      // Upload reference images
      const refUrls: string[] = [];
      for (const img of referenceImages) {
        const base64 = await fileToBase64(img.file);
        const result = await uploadImage.mutateAsync({
          base64,
          filename: img.file.name,
          folder: "consultations",
        });
        if (result.url) refUrls.push(result.url);
      }

      // Upload placement images
      const placeUrls: string[] = [];
      for (const img of placementImages) {
        const base64 = await fileToBase64(img.file);
        const result = await uploadImage.mutateAsync({
          base64,
          filename: img.file.name,
          folder: "consultations",
        });
        if (result.url) placeUrls.push(result.url);
      }

      // Submit booking
      const result = await submitBooking.mutateAsync({
        artistSlug: slug,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        birthdate: birthdate || undefined,
        gender: gender || undefined,
        description: description.trim(),
        styles: selectedStyles,
        placement: placement.trim() || undefined,
        size: selectedSize || undefined,
        timeframe: timeframe || undefined,
        referenceUrls: refUrls.length > 0 ? refUrls : undefined,
        placementUrls: placeUrls.length > 0 ? placeUrls : undefined,
      });

      setLeadToken(result.leadToken);

      if (result.existingUser) {
        // User already has an account — skip auth, go straight to complete
        setPageState("complete");
        setLocation("/conversations");
      } else {
        setPageState("success");
      }
    } catch (err: any) {
      console.error("[PublicBooking] Submit failed:", err);
      setSubmitError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit, slug, firstName, lastName, phone, email, birthdate, gender,
    description, selectedStyles, placement, selectedSize, timeframe,
    referenceImages, placementImages, uploadImage, submitBooking, setLocation,
  ]);

  const handleClaimWithPassword = useCallback(async () => {
    if (!canSetPassword || !leadToken) return;
    setClaiming(true);
    setAuthError("");

    try {
      const result = await claimLead.mutateAsync({
        leadToken,
        password,
      });
      localStorage.setItem("auth_token", result.token);
      setPageState("complete");
      setLocation("/conversations");
    } catch (err: any) {
      setAuthError(err?.message || "Failed to create account.");
    } finally {
      setClaiming(false);
    }
  }, [canSetPassword, leadToken, password, claimLead, setLocation]);

  const handleClaimWithGoogle = useCallback(
    async (code: string) => {
      if (!leadToken) return;
      setClaiming(true);
      setAuthError("");

      try {
        const result = await claimLead.mutateAsync({
          leadToken,
          googleAuthCode: code,
        });
        localStorage.setItem("auth_token", result.token);
        setPageState("complete");
        setLocation("/conversations");
      } catch (err: any) {
        setAuthError(err?.message || "Google sign-in failed.");
      } finally {
        setClaiming(false);
      }
    },
    [leadToken, claimLead, setLocation],
  );

  // ══════════════════════════════════════════════════════════════════
  //  LOADING STATE
  // ══════════════════════════════════════════════════════════════════

  if (artistLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (artistError || !artist) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className={`${typography.h1} text-foreground mb-2`}>Artist Not Found</h1>
        <p className={`${typography.body} text-muted-foreground mb-6`}>
          The link you followed may be broken or the artist is no longer accepting bookings.
        </p>
        <button
          onClick={() => setLocation("/")}
          className={tokens.button.secondary}
        >
          Return Home
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  SUCCESS + AUTH STATE
  // ══════════════════════════════════════════════════════════════════

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tokens.motion.spring}
        >
          <div className={`${sectionClasses} text-center`}>
            {/* Success icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>

            <h2 className={`${typography.h2} text-foreground mb-2`}>
              Booking Request Sent!
            </h2>
            <p className={`${typography.body} text-muted-foreground mb-8`}>
              Your request has been sent to{" "}
              <span className="text-foreground font-semibold">{artist.displayName}</span>.
              Create your account to track your booking.
            </p>

            {/* Auth error */}
            <AnimatePresence>
              {authError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-destructive text-sm mb-4"
                >
                  {authError}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Password auth */}
            <div className="space-y-3 mb-6 text-left">
              <label className={sectionHeaderClasses}>Set a Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClasses}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClasses}
              />
              <button
                disabled={!canSetPassword}
                onClick={handleClaimWithPassword}
                className={`${tokens.button.primary} flex items-center justify-center gap-2`}
              >
                {claiming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Create Account"
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className={`${typography.label} text-muted-foreground`}>or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google auth */}
            {googleAuthReady && (
              <GoogleLoginButton
                onSuccess={handleClaimWithGoogle}
                disabled={claiming}
              />
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  FORM STATE
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        className="w-full max-w-lg mx-auto px-4 py-8 space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ── Artist Header ─────────────────────────────────────── */}
        <motion.div
          variants={sectionVariants}
          transition={tokens.motion.spring}
          className="flex flex-col items-center text-center"
        >
          <UserAvatar
            name={artist.displayName}
            avatar={artist.profileImage}
            size="xl"
            ring
          />
          <h1 className={`${typography.h2} text-foreground mt-4`}>
            {artist.displayName}
          </h1>
          {artist.city && (
            <p className={`${typography.bodySm} text-muted-foreground mt-1`}>
              {artist.city}
            </p>
          )}
        </motion.div>

        {/* ── Section 1: Personal Info ──────────────────────────── */}
        <motion.div
          variants={sectionVariants}
          transition={tokens.motion.spring}
          className={sectionClasses}
        >
          <h2 className={sectionHeaderClasses}>Personal Information</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First name *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClasses}
              />
              <input
                type="text"
                placeholder="Last name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClasses}
              />
            </div>
            <input
              type="tel"
              placeholder="Phone *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClasses}
            />
            <input
              type="email"
              placeholder="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
            />
            <input
              type="date"
              placeholder="Birthdate"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className={`${inputClasses} ${!birthdate ? "text-muted-foreground" : ""}`}
            />

            {/* Gender toggles */}
            <div>
              <label className={`${typography.bodySm} text-muted-foreground mb-2 block`}>
                Gender
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGender(gender === g.value ? "" : g.value)}
                    className={
                      gender === g.value
                        ? tokens.authFlow.genderButtonActive
                        : tokens.authFlow.genderButton
                    }
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section 2: Booking Details ────────────────────────── */}
        <motion.div
          variants={sectionVariants}
          transition={tokens.motion.spring}
          className={sectionClasses}
        >
          <h2 className={sectionHeaderClasses}>Booking Details</h2>
          <div className="space-y-5">
            {/* Description */}
            <div>
              <label className={`${typography.bodySm} text-muted-foreground mb-1.5 block`}>
                Describe your idea *
              </label>
              <textarea
                placeholder="Tell the artist about the tattoo you want…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`${inputClasses} h-auto py-3 resize-none`}
              />
              {description.length > 0 && description.length < 10 && (
                <p className="text-xs text-destructive mt-1">
                  At least 10 characters required
                </p>
              )}
            </div>

            {/* Style chips */}
            <div>
              <label className={`${typography.bodySm} text-muted-foreground mb-2 block`}>
                Style *
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`${chipBase} ${
                      selectedStyles.includes(style) ? chipSelected : chipUnselected
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Placement & Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`${typography.bodySm} text-muted-foreground mb-1.5 block`}>
                  Placement
                </label>
                <input
                  type="text"
                  placeholder="e.g. forearm"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={`${typography.bodySm} text-muted-foreground mb-1.5 block`}>
                  Size
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Select size</option>
                  {SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timeframe chips */}
            <div>
              <label className={`${typography.bodySm} text-muted-foreground mb-2 block`}>
                When?
              </label>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf === timeframe ? "" : tf)}
                    className={`${chipBase} ${
                      timeframe === tf ? chipSelected : chipUnselected
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference images */}
            <ImagePickerSection
              label="Reference images"
              images={referenceImages}
              onRemove={(i) => removeImage(i, "reference")}
              onAdd={() => refImageInput.current?.click()}
              maxImages={5}
            />
            <input
              ref={refImageInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFilesSelected(e, "reference")}
            />

            {/* Placement photos */}
            <ImagePickerSection
              label="Placement photos"
              images={placementImages}
              onRemove={(i) => removeImage(i, "placement")}
              onAdd={() => placementImageInput.current?.click()}
              maxImages={5}
            />
            <input
              ref={placementImageInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFilesSelected(e, "placement")}
            />
          </div>
        </motion.div>

        {/* ── Submit Error ──────────────────────────────────────── */}
        <AnimatePresence>
          {submitError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-destructive text-sm text-center"
            >
              {submitError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── Submit Button ─────────────────────────────────────── */}
        <motion.div
          variants={sectionVariants}
          transition={tokens.motion.spring}
        >
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`${tokens.button.primary} flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Send Booking Request"
            )}
          </button>
        </motion.div>

        {/* Bottom spacer for mobile safe area */}
        <div className="h-8" />
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Presentational sub-component: Image Picker Section
// ══════════════════════════════════════════════════════════════════════

interface ImagePickerSectionProps {
  label: string;
  images: LocalImage[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  maxImages: number;
}

function ImagePickerSection({
  label,
  images,
  onRemove,
  onAdd,
  maxImages,
}: ImagePickerSectionProps) {
  return (
    <div>
      <label className={`${typography.bodySm} text-muted-foreground mb-2 block`}>
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <div
            key={i}
            className="relative w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0"
          >
            <img
              src={img.preview}
              alt={`${label} ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center text-foreground hover:bg-destructive hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={onAdd}
            className="w-16 h-16 rounded-xl border border-dashed border-border bg-secondary/30 flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all cursor-pointer"
          >
            <Camera size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
