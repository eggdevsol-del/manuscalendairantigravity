import { TourHelp } from "@/components/tooltip-tour/TourHelp";
/**
 * BookingFormModal — Inline booking form with blur backdrop
 * ──────────────────────────────────────────────────────────
 * Captures all booking funnel fields in a single modal:
 * - Description, style, placement, size, budget, timeframe
 * - Reference images, placement images
 * On submit: creates lead + consultation + conversation
 * Shows success popup matching the "Update available" style.
 */
import React, { useState, useCallback, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence, useIsPresent } from "framer-motion";
import { X, Send, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";

const STYLE_OPTIONS = [
  "Traditional",
  "Neo-Traditional",
  "Realism",
  "Black & Grey",
  "Japanese",
  "Geometric",
  "Watercolour",
  "Minimalist",
  "Dotwork",
  "Tribal",
  "Script/Lettering",
  "Illustrative",
  "Surrealism",
  "Trash Polka",
  "Fine Line",
  "Other",
];

const SIZE_OPTIONS = [
  "Tiny (< 5cm)",
  "Small (5-10cm)",
  "Medium (10-20cm)",
  "Large (20-30cm)",
  "Extra Large (30cm+)",
  "Full sleeve",
  "Half sleeve",
];

const TIMEFRAME_OPTIONS = [
  "As soon as possible",
  "Within 1 month",
  "Within 3 months",
  "Within 6 months",
  "No rush — flexible",
];

interface BookingFormModalProps {
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  onClose: () => void;
  onSubmitted: () => void;
  /** If true, show personal info fields for unauthenticated users */
  isPublic?: boolean;
  /** Callback after public booking submission with leadToken and email */
  onPublicSubmitted?: (leadToken: string, email: string) => void;
}

interface UploadedImage {
  file: File;
  preview: string;
  uploadedUrl?: string;
}

export default function BookingFormModal({
  artistId,
  artistName,
  artistSlug,
  onClose,
  onSubmitted,
  isPublic,
  onPublicSubmitted,
}: BookingFormModalProps) {
  const isPresent = useIsPresent();
  const opener = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  const { user } = useAuth();
  const refImageInput = useRef<HTMLInputElement>(null);
  const placementImageInput = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const previewUrls = useRef(new Set<string>());
  const submitPending = useRef(false);
  const [submissionError, setSubmissionError] = useState("");
  const [publicResult, setPublicResult] = useState<{
    leadToken: string;
    email: string;
  } | null>(null);
  const utils = trpc.useUtils();

  useEffect(
    () => () => {
      previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    },
    []
  );

  // Form state
  const [description, setDescription] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [placement, setPlacement] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [placementImages, setPlacementImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Personal info state (public unauthenticated flow)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const uploadMutation = trpc.upload.uploadImage.useMutation();
  const uploadPublicMutation = trpc.funnel.uploadPublicImage.useMutation();
  const createConsultation = trpc.consultations.create.useMutation();
  const submitPublicBooking = trpc.funnel.submitPublicBooking.useMutation();

  const toggleStyle = useCallback((style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  }, []);

  const handleImagePick = useCallback((type: "reference" | "placement") => {
    const input =
      type === "reference"
        ? refImageInput.current
        : placementImageInput.current;
    if (input) input.click();
  }, []);

  const handleFilesSelected = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      type: "reference" | "placement"
    ) => {
      const files = Array.from(e.target.files || []);
      const remaining =
        5 -
        (type === "reference"
          ? referenceImages.length
          : placementImages.length);
      const valid = files.filter(file => file.type.startsWith("image/"));
      if (valid.length !== files.length)
        toast.error("Please choose image files.");
      if (valid.length > remaining)
        toast.info("You can attach up to 5 images in each section.");
      const newImages: UploadedImage[] = valid.slice(0, remaining).map(file => {
        const preview = URL.createObjectURL(file);
        previewUrls.current.add(preview);
        return { file, preview };
      });

      if (type === "reference") {
        setReferenceImages(prev => [...prev, ...newImages].slice(0, 5));
      } else {
        setPlacementImages(prev => [...prev, ...newImages].slice(0, 5));
      }
      // Reset input
      e.target.value = "";
    },
    [referenceImages.length, placementImages.length]
  );

  const removeImage = useCallback(
    (index: number, type: "reference" | "placement") => {
      if (type === "reference") {
        setReferenceImages(prev => {
          URL.revokeObjectURL(prev[index].preview);
          previewUrls.current.delete(prev[index].preview);
          return prev.filter((_, i) => i !== index);
        });
      } else {
        setPlacementImages(prev => {
          URL.revokeObjectURL(prev[index].preview);
          previewUrls.current.delete(prev[index].preview);
          return prev.filter((_, i) => i !== index);
        });
      }
    },
    []
  );

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const canSubmit =
    isPublic && !user
      ? description.trim().length >= 10 &&
        selectedStyles.length > 0 &&
        !submitting &&
        firstName.trim() !== "" &&
        lastName.trim() !== "" &&
        email.includes("@") &&
        phone.trim() !== "" &&
        birthdate !== "" &&
        gender !== ""
      : description.trim().length >= 10 &&
        selectedStyles.length > 0 &&
        !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitPending.current) return;
    submitPending.current = true;
    setSubmitting(true);
    setSubmissionError("");

    try {
      // Upload images
      const refUrls: string[] = [];
      for (const img of referenceImages) {
        const base64 = await fileToBase64(img.file);
        const result =
          isPublic && !user
            ? await uploadPublicMutation.mutateAsync({
                base64,
                filename: img.file.name,
                folder: "consultations",
              })
            : await uploadMutation.mutateAsync({
                base64,
                filename: img.file.name,
                contentType: img.file.type,
                folder: "consultations",
              });
        if (result.url) refUrls.push(result.url);
      }

      const placeUrls: string[] = [];
      for (const img of placementImages) {
        const base64 = await fileToBase64(img.file);
        const result =
          isPublic && !user
            ? await uploadPublicMutation.mutateAsync({
                base64,
                filename: img.file.name,
                folder: "consultations",
              })
            : await uploadMutation.mutateAsync({
                base64,
                filename: img.file.name,
                contentType: img.file.type,
                folder: "consultations",
              });
        if (result.url) placeUrls.push(result.url);
      }

      // Public booking flow (unauthenticated)
      if (isPublic && !user) {
        const result = await submitPublicBooking.mutateAsync({
          artistSlug: artistSlug || "",
          firstName,
          lastName,
          email,
          phone,
          birthdate,
          gender: gender as "male" | "female" | "other",
          description,
          styles: selectedStyles,
          size: selectedSize || undefined,
          placement: placement || undefined,
          timeframe: timeframe || undefined,
          referenceUrls: refUrls,
          placementUrls: placeUrls,
        });

        setShowSuccess(true);
        setPublicResult({ leadToken: result.leadToken, email });
        return;
      }

      // Build description with all details
      let fullDesc = description;
      if (selectedStyles.length > 0)
        fullDesc += `\n\nStyle: ${selectedStyles.join(", ")}`;
      if (selectedSize) fullDesc += `\nSize: ${selectedSize}`;
      if (placement) fullDesc += `\nPlacement: ${placement}`;
      if (timeframe) fullDesc += `\nTimeframe: ${timeframe}`;

      // Create consultation
      await createConsultation.mutateAsync({
        artistId,
        subject: `Booking request from ${user?.name || "Client"}`,
        description: fullDesc,
        placement: placement || undefined,
        style: selectedStyles.join(", ") || undefined,
        referenceUrls: [...refUrls, ...placeUrls],
      });
      utils.conversations.list.invalidate();

      // Show success popup
      setShowSuccess(true);
    } catch (err) {
      console.error("Booking submission failed:", err);
      setSubmissionError(
        "Your request was not sent. Your details are still here; please try again."
      );
      submitPending.current = false;
      setSubmitting(false);
    }
  }, [
    canSubmit,
    description,
    selectedStyles,
    selectedSize,
    placement,
    timeframe,
    referenceImages,
    placementImages,
    artistId,
    user,
    uploadMutation,
    uploadPublicMutation,
    createConsultation,
    onSubmitted,
    isPublic,
    firstName,
    lastName,
    email,
    phone,
    birthdate,
    gender,
    artistSlug,
    submitPublicBooking,
    onPublicSubmitted,
    utils,
  ]);

  const dismiss = () => {
    if (showSuccess) {
      if (publicResult && onPublicSubmitted)
        onPublicSubmitted(publicResult.leadToken, publicResult.email);
      else onSubmitted();
    } else if (!submitting) onClose();
  };

  return (
    <Dialog.Root
      open={isPresent}
      onOpenChange={open => {
        if (!open) dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          onCloseAutoFocus={event => {
            event.preventDefault();
            requestAnimationFrame(() => {
              if (opener.current?.isConnected) opener.current.focus();
            });
          }}
          onEscapeKeyDown={event => {
            if (submitting && !showSuccess) event.preventDefault();
          }}
        >
          <motion.div
            className="booking-form-backdrop"
            data-tour-surface={showSuccess ? "Booking request sent" : "Request a booking"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
          >
            <motion.div
              className="booking-form-modal"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="booking-form-header">
                <TourHelp feature />
                <Dialog.Title asChild>
                  <h3>Book with {artistName}</h3>
                </Dialog.Title>
                <button
                  type="button"
                  aria-label="Close booking request"
                  className="booking-form-close"
                  disabled={submitting && !showSuccess}
                  onClick={dismiss}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              {!showSuccess && (
                <form
                  className="booking-form-scroll"
                  onSubmit={event => {
                    event.preventDefault();
                    handleSubmit();
                  }}
                >
                  <fieldset
                    disabled={submitting}
                    style={{ display: "contents" }}
                  >
                    {/* Personal info for unauthenticated public users */}
                    {isPublic && !user && (
                      <>
                        <div className="booking-form-group">
                          <label htmlFor={`${fieldId}-first-name`}>
                            First Name *
                          </label>
                          <input
                            id={`${fieldId}-first-name`}
                            required
                            autoComplete="given-name"
                            className="booking-form-input"
                            placeholder="First name"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                          />
                        </div>
                        <div className="booking-form-group">
                          <label htmlFor={`${fieldId}-last-name`}>
                            Last Name *
                          </label>
                          <input
                            id={`${fieldId}-last-name`}
                            required
                            autoComplete="family-name"
                            className="booking-form-input"
                            placeholder="Last name"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                          />
                        </div>
                        <div className="booking-form-group">
                          <label htmlFor={`${fieldId}-email`}>Email *</label>
                          <input
                            id={`${fieldId}-email`}
                            required
                            autoComplete="email"
                            autoCapitalize="none"
                            type="email"
                            className="booking-form-input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                          />
                        </div>
                        <div className="booking-form-group">
                          <label htmlFor={`${fieldId}-phone`}>Phone *</label>
                          <input
                            id={`${fieldId}-phone`}
                            required
                            autoComplete="tel"
                            type="tel"
                            className="booking-form-input"
                            placeholder="+1 (555) 123-4567"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                          />
                        </div>
                        <div className="booking-form-group">
                          <label htmlFor={`${fieldId}-birthday`}>
                            Date of Birth *
                          </label>
                          <input
                            id={`${fieldId}-birthday`}
                            required
                            autoComplete="bday"
                            type="date"
                            className="booking-form-input"
                            value={birthdate}
                            onChange={e => setBirthdate(e.target.value)}
                          />
                        </div>
                        <div className="booking-form-group">
                          <label>Gender *</label>
                          <div className="booking-form-chips">
                            {[
                              { value: "male", label: "Male" },
                              { value: "female", label: "Female" },
                              { value: "other", label: "Other" },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                aria-pressed={gender === opt.value}
                                className={`booking-form-chip ${gender === opt.value ? "selected" : ""}`}
                                onClick={() => setGender(opt.value)}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Description */}
                    <div className="booking-form-group">
                      <label htmlFor={`${fieldId}-idea`}>
                        Describe your idea *
                      </label>
                      <textarea
                        id={`${fieldId}-idea`}
                        required
                        minLength={10}
                        className="booking-form-input"
                        placeholder="Tell the artist about the tattoo you want..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                      />
                      <small>
                        At least 10 characters, then choose one or more styles.
                      </small>
                    </div>

                    {/* Style preferences */}
                    <div className="booking-form-group">
                      <label>Style *</label>
                      <div className="booking-form-chips">
                        {STYLE_OPTIONS.map(style => (
                          <button
                            key={style}
                            type="button"
                            aria-pressed={selectedStyles.includes(style)}
                            className={`booking-form-chip ${selectedStyles.includes(style) ? "selected" : ""}`}
                            onClick={() => toggleStyle(style)}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Placement & Size */}
                    <div className="booking-form-row">
                      <div className="booking-form-group">
                        <label htmlFor={`${fieldId}-placement`}>
                          Placement
                        </label>
                        <input
                          id={`${fieldId}-placement`}
                          className="booking-form-input"
                          placeholder="e.g. forearm"
                          value={placement}
                          onChange={e => setPlacement(e.target.value)}
                        />
                      </div>
                      <div className="booking-form-group">
                        <label htmlFor={`${fieldId}-size`}>Size</label>
                        <select
                          id={`${fieldId}-size`}
                          className="booking-form-input"
                          value={selectedSize}
                          onChange={e => setSelectedSize(e.target.value)}
                        >
                          <option value="">Select size</option>
                          {SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Timeframe */}
                    <div className="booking-form-group">
                      <label>When?</label>
                      <div className="booking-form-chips">
                        {TIMEFRAME_OPTIONS.map(tf => (
                          <button
                            key={tf}
                            type="button"
                            aria-pressed={timeframe === tf}
                            className={`booking-form-chip ${timeframe === tf ? "selected" : ""}`}
                            onClick={() =>
                              setTimeframe(tf === timeframe ? "" : tf)
                            }
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reference images */}
                    <div className="booking-form-group">
                      <label>Reference images</label>
                      <div className="booking-form-images">
                        {referenceImages.map((img, i) => (
                          <div key={i} className="booking-form-image-thumb">
                            <img src={img.preview} alt={`Ref ${i + 1}`} />
                            <button
                              type="button"
                              aria-label={`Remove reference image ${i + 1}`}
                              className="booking-form-image-remove"
                              onClick={() => removeImage(i, "reference")}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {referenceImages.length < 5 && (
                          <button
                            type="button"
                            aria-label="Add reference images"
                            className="booking-form-add-image"
                            onClick={() => handleImagePick("reference")}
                          >
                            +
                          </button>
                        )}
                      </div>
                      <input
                        ref={refImageInput}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={e => handleFilesSelected(e, "reference")}
                      />
                    </div>

                    {/* Placement images */}
                    <div className="booking-form-group">
                      <label>Placement photos</label>
                      <div className="booking-form-images">
                        {placementImages.map((img, i) => (
                          <div key={i} className="booking-form-image-thumb">
                            <img src={img.preview} alt={`Placement ${i + 1}`} />
                            <button
                              type="button"
                              aria-label={`Remove placement photo ${i + 1}`}
                              className="booking-form-image-remove"
                              onClick={() => removeImage(i, "placement")}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {placementImages.length < 5 && (
                          <button
                            type="button"
                            aria-label="Add placement photos"
                            className="booking-form-add-image"
                            onClick={() => handleImagePick("placement")}
                          >
                            +
                          </button>
                        )}
                      </div>
                      <input
                        ref={placementImageInput}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={e => handleFilesSelected(e, "placement")}
                      />
                    </div>

                    {/* Submit */}
                    {submissionError && <p role="alert">{submissionError}</p>}
                    <button
                      type="submit"
                      className="booking-form-submit"
                      disabled={!canSubmit}
                    >
                      {submitting ? (
                        <>
                          <Loader2
                            className="animate-spin"
                            size={18}
                            aria-hidden="true"
                          />{" "}
                          Sending request…
                        </>
                      ) : (
                        "Send Request"
                      )}
                    </button>
                  </fieldset>
                </form>
              )}

              {/* Success popup */}
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    role="status"
                    className="booking-form-scroll"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="v3-stack">
                      <div className="booking-success-icon">
                        <Check size={18} color="var(--color-bg-base)" />
                      </div>
                      <div className="booking-success-text">
                        <p>Request sent</p>
                        <p>Check your messages for a response</p>
                      </div>
                      <button
                        className="v3-action v3-action-primary"
                        onClick={dismiss}
                      >
                        OK
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
