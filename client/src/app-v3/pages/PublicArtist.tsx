import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { MapPin, Eye, EyeOff, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { useGoogleAuthReady } from "@/lib/google-auth";
import { activateWaitingSWForPublicPage } from "@/lib/pwa";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";

const styles = [
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
  "Not sure yet",
];
const sizes = [
  "Tiny (< 5cm)",
  "Small (5-10cm)",
  "Medium (10-20cm)",
  "Large (20-30cm)",
  "Extra Large (30cm+)",
  "Full sleeve",
  "Half sleeve",
];
type Attachment = { file: File; preview: string; url?: string };
export default function PublicArtist({ hub = false }: { hub?: boolean }) {
  const [, bookingParams] = useRoute("/book/:slug");
  const [, startParams] = useRoute("/start/:slug");
  const [, hubParams] = useRoute("/:slug");
  const params = bookingParams || startParams || hubParams;
  const profile = trpc.feed.getPublicArtistProfile.useQuery(
    { slug: params?.slug || "" },
    { enabled: !!params?.slug, retry: false }
  );
  const [open, setOpen] = useState(!hub);
  useEffect(() => {
    activateWaitingSWForPublicPage();
  }, []);
  const artist = profile.data;
  return (
    <Screen
      publicView
      title={artist?.displayName || "Your artist"}
      subtitle="Tell your artist what you have in mind"
      action={
        <ActionLink href="/login" tone="quiet">
          Sign in
        </ActionLink>
      }
    >
      <Feedback
        loading={profile.isLoading}
        error={profile.error}
        onRetry={() => profile.refetch()}
      />
      {!profile.isLoading && !profile.error && !artist && (
        <Feedback empty="This artist’s booking page is unavailable. Check the link with your artist." />
      )}
      {artist && (
        <>
          <Row
            title={artist.displayName}
            detail={artist.slug ? "@" + artist.slug : undefined}
            icon={<Avatar name={artist.displayName} src={artist.avatar} />}
          />
          {artist.bio && <p>{artist.bio}</p>}
          {artist.showCity && artist.city && (
            <div className="v3-inline">
              <MapPin />
              {artist.city}
            </div>
          )}
          {!!artist.keywords.length && (
            <p className="v3-muted">{artist.keywords.join(" · ")}</p>
          )}
          <Action
            disabled={artist.bookingEnabled === false}
            onClick={() => setOpen(true)}
          >
            {artist.bookingEnabled === false
              ? "Bookings are currently closed"
              : "Request a booking"}
          </Action>
          {!!artist.portfolio.length && (
            <Section title="Selected work">
              <div className="v3-file-grid">
                {artist.portfolio.map(item => (
                  <div key={item.id}>
                    {item.mediaType === "video" && item.videoUrl ? (
                      <video
                        className="v3-media-full"
                        src={item.videoUrl}
                        poster={item.imageUrl}
                        controls
                        playsInline
                        preload="none"
                        aria-label={
                          item.description || "Tattoo by " + artist.displayName
                        }
                      />
                    ) : (
                      <a
                        href={item.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={item.imageUrl}
                          alt={
                            item.description ||
                            "Tattoo by " + artist.displayName
                          }
                          loading="lazy"
                        />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
          <p className="v3-muted">Bookings with Tattoi</p>
          <Intake
            artistId={artist.id}
            artistName={artist.displayName}
            slug={artist.slug || params?.slug || ""}
            open={open && artist.bookingEnabled !== false}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </Screen>
  );
}
function Intake({
  artistId,
  artistName,
  slug,
  open,
  onClose,
}: {
  artistId: string;
  artistName: string;
  slug: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user, loading } = useAuth();
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthdate: "",
    gender: "",
    description: "",
    placement: "",
    size: "",
    timeframe: "",
  });
  const [step, setStep] = useState(1);
  const [selectedStyles, setStyles] = useState<string[]>([]);
  const [refs, setRefs] = useState<Attachment[]>([]);
  const [placements, setPlacements] = useState<Attachment[]>([]);
  const urls = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{
    leadToken?: string;
    existingUser?: boolean;
  } | null>(null);
  const uploadPublic = trpc.funnel.uploadPublicImage.useMutation();
  const upload = trpc.upload.uploadImage.useMutation();
  const submit = trpc.funnel.submitPublicBooking.useMutation();
  const consultation = trpc.consultations.create.useMutation();
  useEffect(
    () => () => {
      urls.current.forEach(url => URL.revokeObjectURL(url));
    },
    []
  );
  function pick(files: FileList | null, placement: boolean) {
    if (!files) return;
    const list = placement ? placements : refs;
    const selected = Array.from(files).slice(0, 5 - list.length);
    if (
      selected.some(
        f => !f.type.startsWith("image/") || f.size > 10 * 1024 * 1024
      )
    ) {
      setError("Choose images smaller than 10 MB each.");
      return;
    }
    const additions = selected.map(file => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      return { file, preview };
    });
    (placement ? setPlacements : setRefs)([...list, ...additions]);
    setError("");
  }
  async function uploadFiles(files: Attachment[]) {
    const result: string[] = [];
    for (const file of files) {
      if (!file.url) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file.file);
        });
        const data = user
          ? await upload.mutateAsync({
              base64,
              filename: file.file.name,
              contentType: file.file.type,
              folder: "consultations",
            })
          : await uploadPublic.mutateAsync({
              base64,
              filename: file.file.name,
              folder: "consultations",
            });
        file.url = data.url;
      }
      result.push(file.url!);
    }
    return result;
  }
  async function send() {
    if (busy || loading) return;
    if (draft.description.trim().length < 10 || !selectedStyles.length) {
      setError(
        "Describe your idea in at least 10 characters and choose a style."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const referenceUrls = await uploadFiles(refs),
        placementUrls = await uploadFiles(placements);
      if (user) {
        const description = [
          draft.description,
          "Style: " + selectedStyles.join(", "),
          draft.size && "Size: " + draft.size,
          draft.placement && "Placement: " + draft.placement,
          draft.timeframe && "Timeframe: " + draft.timeframe,
        ]
          .filter(Boolean)
          .join("\n");
        await consultation.mutateAsync({
          artistId,
          subject: "Booking request from " + (user.name || "Client"),
          description,
          placement: draft.placement || undefined,
          style: selectedStyles.join(", "),
          referenceUrls: [...referenceUrls, ...placementUrls],
        });
        setSubmitted({});
      } else {
        const result = await submit.mutateAsync({
          ...draft,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          email: draft.email.trim().toLowerCase(),
          phone: draft.phone.trim(),
          gender: draft.gender as "male" | "female" | "other",
          artistSlug: slug,
          description: draft.description.trim(),
          styles: selectedStyles,
          referenceUrls,
          placementUrls,
        });
        setSubmitted({
          leadToken: result.leadToken,
          existingUser: result.existingUser,
        });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t send your request. Your details are still here."
      );
    } finally {
      setBusy(false);
    }
  }
  const attachments = (placement: boolean) => {
    const list = placement ? placements : refs;
    return (
      <Section title={placement ? "Placement photos" : "Reference images"}>
        <div className="v3-form">
          <label>
            {placement ? "Add a photo of the area" : "Add inspiration"}
            <input
              type="file"
              multiple
              accept="image/*"
              disabled={busy || list.length >= 5}
              onChange={e => {
                pick(e.target.files, placement);
                e.target.value = "";
              }}
            />
          </label>
          <small>Optional · up to 5 images, 10 MB each</small>
        </div>
        <div className="v3-file-grid">
          {list.map((file, i) => (
            <div key={file.preview}>
              <img
                src={file.preview}
                alt={placement ? "Placement photo" : "Reference image"}
              />
              <Action
                tone="quiet"
                disabled={busy}
                aria-label={
                  "Remove " +
                  (placement ? "placement" : "reference") +
                  " image " +
                  (i + 1)
                }
                onClick={() => {
                  URL.revokeObjectURL(file.preview);
                  urls.current.delete(file.preview);
                  (placement ? setPlacements : setRefs)(
                    list.filter((_, n) => n !== i)
                  );
                }}
              >
                <X />
                Remove
              </Action>
            </div>
          ))}
        </div>
      </Section>
    );
  };
  return (
    <SheetShell
      isOpen={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={submitted ? "Request sent" : "Request a booking"}
      description={artistName}
    >
      {submitted ? (
        <div className="v3-stack">
          <Status tone="success">Your request has been received</Status>
          <p>
            {artistName} will review your idea and get back to you. Dates are
            confirmed after you agree on a session plan and pay the deposit.
          </p>
          {submitted.leadToken ? (
            <ClaimAccount
              token={submitted.leadToken}
              email={draft.email}
              existing={!!submitted.existingUser}
            />
          ) : (
            <ActionLink href="/conversations" tone="primary">
              Open your messages
            </ActionLink>
          )}
        </div>
      ) : (
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            if (step < 6) {
              if (step === 1 && !selectedStyles.length) {
                setError(
                  "Choose at least one style, including ‘Not sure’ if you need guidance."
                );
                return;
              }
              setError("");
              setStep(step + 1);
            } else void send();
          }}
        >
          <Status>
            Step {step} of 6 ·{" "}
            {
              [
                "Your idea",
                "Placement & timing",
                "References",
                "Placement photo",
                "Your details",
                "Review request",
              ][step - 1]
            }
          </Status>
          <Feedback loading={loading} />
          <fieldset disabled={busy || loading} className="v3-form">
            {step === 1 && (
              <Section title="Your idea">
                <div className="v3-form">
                  <label>
                    What would you like tattooed?
                    <textarea
                      required
                      minLength={10}
                      rows={4}
                      value={draft.description}
                      onChange={e =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                  <fieldset>
                    <legend>Style · choose any that fit</legend>
                    <div className="v3-style-choices">
                      {styles.map(style => (
                        <label key={style}>
                          <input
                            type="checkbox"
                            checked={selectedStyles.includes(style)}
                            onChange={() =>
                              setStyles(current =>
                                current.includes(style)
                                  ? current.filter(s => s !== style)
                                  : [...current, style]
                              )
                            }
                          />
                          {style}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </Section>
            )}
            {step === 2 && (
              <Section title="Placement & timing">
                <div className="v3-form">
                  <label>
                    Placement
                    <input
                      value={draft.placement}
                      onChange={e =>
                        setDraft({ ...draft, placement: e.target.value })
                      }
                      placeholder="For example, outer forearm"
                    />
                  </label>
                  <label>
                    Approximate size
                    <select
                      aria-label="Approximate size"
                      value={draft.size}
                      onChange={e =>
                        setDraft({ ...draft, size: e.target.value })
                      }
                    >
                      <option value="">Not sure yet</option>
                      {sizes.map(size => (
                        <option key={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Preferred timeframe
                    <select
                      aria-label="Preferred timeframe"
                      value={draft.timeframe}
                      onChange={e =>
                        setDraft({ ...draft, timeframe: e.target.value })
                      }
                    >
                      <option value="">Flexible</option>
                      {[
                        "As soon as possible",
                        "Within 1 month",
                        "Within 3 months",
                        "Within 6 months",
                        "No rush — flexible",
                      ].map(time => (
                        <option key={time}>{time}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </Section>
            )}
            {step === 3 && attachments(false)}
            {step === 4 && attachments(true)}
            {step === 5 && !user && (
              <Section title="Your details">
                <div className="v3-form">
                  <div className="v3-form-pair">
                    <label>
                      First name
                      <input
                        required
                        autoComplete="given-name"
                        value={draft.firstName}
                        onChange={e =>
                          setDraft({ ...draft, firstName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        required
                        autoComplete="family-name"
                        value={draft.lastName}
                        onChange={e =>
                          setDraft({ ...draft, lastName: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={draft.email}
                      onChange={e =>
                        setDraft({ ...draft, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={draft.phone}
                      onChange={e =>
                        setDraft({ ...draft, phone: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Date of birth
                    <input
                      required
                      type="date"
                      autoComplete="bday"
                      value={draft.birthdate}
                      onChange={e =>
                        setDraft({ ...draft, birthdate: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Gender
                    <select
                      aria-label="Gender"
                      required
                      value={draft.gender}
                      onChange={e =>
                        setDraft({ ...draft, gender: e.target.value })
                      }
                    >
                      <option value="">Choose</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
              </Section>
            )}
            {step === 5 && user && (
              <Section title="Your details">
                <p>
                  Sending as {user.name}. Your request will stay with your
                  existing account.
                </p>
              </Section>
            )}
            {step === 6 && (
              <Section title="Review your request">
                <p>{draft.description}</p>
                <Row title="Style" detail={selectedStyles.join(", ")} />
                <Row
                  title="Placement & size"
                  detail={`${draft.placement || "To discuss"} · ${draft.size || "To discuss"}`}
                />
                <Row title="Timeframe" detail={draft.timeframe || "Flexible"} />
                <Row
                  title="Images"
                  detail={`${refs.length} references · ${placements.length} placement photos`}
                />
                <Row
                  title="Contact"
                  detail={
                    user?.name ||
                    `${draft.firstName} ${draft.lastName} · ${draft.email}`
                  }
                />
              </Section>
            )}
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <Action type="submit" disabled={busy || loading}>
            {busy
              ? "Sending your request…"
              : step === 6
                ? "Send booking request"
                : "Continue"}
          </Action>
          {step > 1 && (
            <Action
              tone="quiet"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              Back
            </Action>
          )}
          <p className="v3-muted">
            There’s no payment at this stage. Your artist will review your
            request first.
          </p>
        </form>
      )}
    </SheetShell>
  );
}
function ClaimAccount({
  token,
  email,
  existing,
}: {
  token: string;
  email: string;
  existing: boolean;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const claim = trpc.auth.claimLead.useMutation();
  const googleReady = useGoogleAuthReady();
  async function signIn(googleAuthCode?: string) {
    if (claim.isPending) return;
    try {
      const result = await claim.mutateAsync({
        leadToken: token,
        ...(googleAuthCode ? { googleAuthCode } : { password }),
      });
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");
      localStorage.setItem("authToken", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      window.location.assign("/conversations");
    } catch {}
  }
  return (
    <Panel>
      <h2>
        {existing
          ? "Sign in to follow your request"
          : "Create a password to follow your request"}
      </h2>
      <p>{email}</p>
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          void signIn();
        }}
      >
        <label>
          {existing ? "Your password" : "Create password"}
          <input
            required
            minLength={8}
            type={visible ? "text" : "password"}
            autoComplete={existing ? "current-password" : "new-password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        <Action
          tone="quiet"
          aria-pressed={visible}
          onClick={() => setVisible(v => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
          {visible ? "Hide password" : "Show password"}
        </Action>
        {claim.error && <p role="alert">{claim.error.message}</p>}
        <Action type="submit" disabled={claim.isPending}>
          {claim.isPending
            ? "Signing in…"
            : existing
              ? "Sign in"
              : "Create account"}
        </Action>
      </form>
      {googleReady && (
        <GoogleLoginButton
          disabled={claim.isPending}
          onSuccess={code => signIn(code)}
        />
      )}{" "}
      {existing && (
        <ActionLink href="/forgot-password" tone="quiet">
          Forgot password?
        </ActionLink>
      )}
    </Panel>
  );
}
