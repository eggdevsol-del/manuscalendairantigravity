/**
 * ClientProfilePage — Client-facing profile editor + preview
 * ────────────────────────────────────────────────────────────
 * Two-mode view: Edit (form) and Preview (read-only card layout).
 * All styling through SSOT design tokens. No hardcoded colors.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { PageShell } from "@/components/ui/ssot/PageShell";
import { PageHeader } from "@/components/ui/ssot/PageHeader";
import { UserAvatar } from "@/components/ui/ssot/UserAvatar";
import {
  Settings,
  Eye,
  Pencil,
  Save,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Loader2,
} from "lucide-react";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// ── Types ──────────────────────────────────────────────────
type Mode = "edit" | "preview";

// ── Transition variants ────────────────────────────────────
const modeVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeIn" } },
};

// ── Presentational: Section header ─────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
      {children}
    </span>
  );
}

// ── Presentational: Form field wrapper ─────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Presentational: Gender chip ────────────────────────────
function GenderChip({
  value,
  label,
  selected,
  onSelect,
}: {
  value: string;
  label: string;
  selected: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex-1 h-12 rounded-[16px] border-2 text-sm font-medium transition-all outline-none",
        selected
          ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(248,208,87,0.15)]"
          : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}

// ── Presentational: Preview info row ───────────────────────
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-9 h-9 rounded-[12px] bg-secondary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground truncate">
          {value}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Container component
// ═══════════════════════════════════════════════════════════
export default function ClientProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // ── Mode ───────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("edit");

  // ── Form state ─────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Populate from SSOT (auth.me cache) ─────────────────
  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setPhone(user.phone || "");
    setBirthday(
      user.birthday
        ? new Date(user.birthday).toISOString().split("T")[0]
        : ""
    );
    setGender((user as any).gender || "");
    setCity((user as any).city || "");
    setCountry((user as any).country || "");
    setBio((user as any).bio || "");
    setAvatar(user.avatar || "");
  }, [user]);

  // ── Mutation ────────────────────────────────────────────
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.auth.me.invalidate();
      setSaving(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save");
      setSaving(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    updateProfile.mutate({
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      birthday: birthday || undefined,
      gender: gender ? (gender as "male" | "female" | "other" | "prefer_not_to_say") : undefined,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      bio: bio.trim() || undefined,
      avatar: avatar || undefined,
    });
  };

  // ── Derived ─────────────────────────────────────────────
  const locationString = [city, country].filter(Boolean).join(", ");
  const genderDisplay =
    gender === "male"
      ? "Male"
      : gender === "female"
        ? "Female"
        : gender === "other"
          ? "Other"
          : gender === "prefer_not_to_say"
            ? "Prefer not to say"
            : null;

  // ════════════════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════════════════
  return (
    <PageShell>
      <PageHeader title="Profile" />

      {/* ── Mode toggle ──────────────────────────────── */}
      <div className={cn("px-4 pb-3 flex justify-center")}>
        <div className="flex bg-secondary/50 p-1 rounded-full gap-1">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200",
              mode === "edit"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200",
              mode === "preview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {mode === "edit" ? (
            <motion.div
              key="edit"
              variants={modeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="px-4 pb-32"
            >
              {/* Avatar */}
              <div className="flex flex-col items-center py-6 gap-2">
                <UserAvatar name={name || user?.name} avatar={avatar || user?.avatar} size="2xl" ring />
                <h2 className="text-lg font-bold text-foreground mt-2">
                  {name || user?.name || "Your Name"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {user?.email || ""}
                </span>
              </div>

              {/* Personal Information */}
              <div className="mb-6">
                <div className="mb-3">
                  <SectionLabel>Personal Information</SectionLabel>
                </div>
                <div
                  className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    tokens.spacing.cardPadding,
                    "flex flex-col gap-4"
                  )}
                >
                  <Field label="Display Name">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={cn(tokens.input.base, tokens.input.hero)}
                    />
                  </Field>

                  <Field label="Phone">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+64 21 000 0000"
                      className={cn(tokens.input.base, tokens.input.hero)}
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      value={user?.email || ""}
                      readOnly
                      className={cn(
                        tokens.input.base,
                        tokens.input.hero,
                        "opacity-50 cursor-not-allowed"
                      )}
                    />
                  </Field>

                  <Field label="Date of Birth">
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className={cn(tokens.input.base, tokens.input.hero)}
                    />
                  </Field>

                  <Field label="Gender">
                    <div className="flex gap-2">
                      <GenderChip
                        value="male"
                        label="Male"
                        selected={gender === "male"}
                        onSelect={setGender}
                      />
                      <GenderChip
                        value="female"
                        label="Female"
                        selected={gender === "female"}
                        onSelect={setGender}
                      />
                    </div>
                  </Field>
                </div>
              </div>

              {/* Location */}
              <div className="mb-6">
                <div className="mb-3">
                  <SectionLabel>Location</SectionLabel>
                </div>
                <div
                  className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    tokens.spacing.cardPadding,
                    "flex flex-col gap-4"
                  )}
                >
                  <Field label="City">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Auckland"
                      className={cn(tokens.input.base, tokens.input.hero)}
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. New Zealand"
                      className={cn(tokens.input.base, tokens.input.hero)}
                    />
                  </Field>
                </div>
              </div>

              {/* About */}
              <div className="mb-6">
                <div className="mb-3">
                  <SectionLabel>About</SectionLabel>
                </div>
                <div
                  className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    tokens.spacing.cardPadding,
                    "flex flex-col gap-2"
                  )}
                >
                  <Field label="Bio">
                    <textarea
                      value={bio}
                      onChange={(e) =>
                        setBio(e.target.value.slice(0, 500))
                      }
                      placeholder="Tell artists a bit about yourself…"
                      rows={4}
                      className={cn(
                        tokens.input.base,
                        "rounded-[16px] py-3 min-h-[100px] resize-none"
                      )}
                    />
                  </Field>
                  <span className="text-[11px] text-muted-foreground text-right">
                    {bio.length}/500
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setLocation("/settings")}
                  className={cn(
                    tokens.button.secondary,
                    "flex-1 flex items-center justify-center gap-2"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    tokens.button.primary,
                    "flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Preview Mode ───────────────────────── */
            <motion.div
              key="preview"
              variants={modeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="px-4 pb-32"
            >
              {/* Hero avatar */}
              <div className="flex flex-col items-center py-8 gap-3">
                <UserAvatar
                  name={name || user?.name}
                  avatar={avatar || user?.avatar}
                  size="2xl"
                  ring
                />
                <h2 className="text-xl font-bold text-foreground mt-2">
                  {name || user?.name || "Your Name"}
                </h2>
                {bio && (
                  <p className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
                    {bio}
                  </p>
                )}
                {locationString && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{locationString}</span>
                  </div>
                )}
              </div>

              {/* Info cards */}
              <div className="mb-6">
                <div className="mb-3">
                  <SectionLabel>Details</SectionLabel>
                </div>
                <div
                  className={cn(
                    tokens.card.base,
                    tokens.card.bg,
                    tokens.spacing.cardPadding,
                    "flex flex-col divide-y divide-border/30"
                  )}
                >
                  <InfoRow icon={Phone} label="Phone" value={phone || null} />
                  <InfoRow
                    icon={Mail}
                    label="Email"
                    value={user?.email || null}
                  />
                  <InfoRow
                    icon={Calendar}
                    label="Birthday"
                    value={
                      birthday
                        ? new Date(birthday + "T00:00:00").toLocaleDateString(
                            undefined,
                            { day: "numeric", month: "long", year: "numeric" }
                          )
                        : null
                    }
                  />
                  <InfoRow icon={User} label="Gender" value={genderDisplay} />
                </div>
              </div>

              {/* Settings button */}
              <button
                type="button"
                onClick={() => setLocation("/settings")}
                className={cn(
                  tokens.button.secondary,
                  "w-full flex items-center justify-center gap-2"
                )}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  );
}
