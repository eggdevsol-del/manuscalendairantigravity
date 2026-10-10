import { useArtistSetup } from "@/features/onboarding/ArtistSetupContext";
import { NumericInput } from "@/components/ui/numeric-input";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Action,
  Avatar,
  Feedback,
  Screen,
  Section,
} from "../design/primitives";
function useSetupDraft<T extends Record<string, string | number>>(
  initial: T,
  section: string
) {
  const setup = useArtistSetup();
  const { user } = useAuth();
  const key = setup && user ? `tattoi:setup:${user.id}:${section}` : null;
  const [form, setForm] = useState<T>(() => {
    if (!key) return initial;
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || "null");
      if (!stored || typeof stored !== "object") return initial;
      return Object.fromEntries(
        Object.entries(initial).map(([name, value]) => [
          name,
          typeof stored[name] === typeof value ? stored[name] : value,
        ])
      ) as T;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (key)
      try {
        sessionStorage.setItem(key, JSON.stringify(form));
      } catch {}
  }, [key, form]);
  const clear = () => {
    if (key)
      try {
        sessionStorage.removeItem(key);
      } catch {}
  };
  return [form, setForm, clear] as const;
}

export function AccountEditor({ back }: { back?: string } = {}) {
  const { user, refresh } = useAuth();
  if (!user) return <Feedback loading />;
  return (
    <AccountForm key={user.id} user={user} refresh={refresh} back={back} />
  );
}
function AccountForm({
  user,
  refresh,
  back,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  refresh: () => unknown;
  back?: string;
}) {
  const setup = useArtistSetup();
  const [setupError, setSetupError] = useState("");
  const [form, setForm, clearDraft] = useSetupDraft(
    {
      name: user.name || "",
      phone: user.phone || "",
      bio: user.bio || "",
      city: user.city || "",
      instagramUsername: user.instagramUsername || "",
      avatar: user.avatar || "",
      birthday: user.birthday?.slice(0, 10) || "",
      country: user.country || "",
      gender: (user.gender || "") as NonNullable<typeof user.gender> | "",
    },
    "profile"
  );
  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      clearDraft();
      await refresh();
      await setup?.onSaved();
    },
  });
  const upload = trpc.upload.uploadImage.useMutation();
  const [uploadError, setUploadError] = useState("");
  async function image(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setUploadError("Choose an image smaller than 10 MB.");
      return;
    }
    setUploadError("");
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const result = await upload.mutateAsync({
        fileName: file.name,
        fileData,
        contentType: file.type,
      });
      setForm(current => ({ ...current, avatar: result.url }));
    } catch {
      setUploadError("Couldn’t upload this photo. Try again.");
    }
  }
  return (
    <Screen
      title="Your profile"
      back={
        setup
          ? undefined
          : back ||
            (user.role === "merchant" ? "/account-settings" : "/settings")
      }
    >
      <form
        className="v3-form"
        onChange={() => update.reset()}
        onSubmit={e => {
          e.preventDefault();
          if (
            setup &&
            [form.name, form.phone, form.avatar, form.city, form.country].some(
              v => !v.trim()
            )
          ) {
            setSetupError(
              "Add your name, profile photo, phone, city and country to continue."
            );
            return;
          }
          setSetupError("");
          update.mutate({
            ...form,
            birthday: form.birthday || undefined,
            gender: form.gender || undefined,
          });
        }}
      >
        {setup && (
          <p className="v3-muted">
            Required: profile photo, full name, phone, city and country. The
            other details are optional.
          </p>
        )}
        <div className="v3-inline">
          <Avatar name={form.name} src={form.avatar} />
          <label>
            Profile photo{setup ? " (required)" : ""}
            <input
              type="file"
              accept="image/*"
              disabled={upload.isPending}
              onChange={e => image(e.target.files?.[0])}
            />
          </label>
        </div>
        {upload.isPending && <p role="status">Uploading your profile photo…</p>}
        {uploadError && <p role="alert">{uploadError}</p>}
        {setupError && <p role="alert">{setupError}</p>}
        <label>
          Full name{setup ? " (required)" : ""}
          <input
            required
            maxLength={100}
            autoComplete="name"
            value={form.name}
            onChange={e => {
              update.reset();
              setForm({ ...form, name: e.target.value });
            }}
          />
        </label>
        <label>
          Phone{setup ? " (required)" : ""}
          <input
            required={!!setup}
            type="tel"
            maxLength={30}
            autoComplete="tel"
            value={form.phone}
            onChange={e => {
              update.reset();
              setForm({ ...form, phone: e.target.value });
            }}
          />
        </label>
        <label>
          City{setup ? " (required)" : ""}
          <input
            maxLength={100}
            required={!!setup}
            autoComplete="address-level2"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
          />
        </label>
        <label>
          Country{setup ? " (required)" : ""}
          <input
            required={!!setup}
            autoComplete="country-name"
            maxLength={100}
            value={form.country}
            onChange={e => setForm({ ...form, country: e.target.value })}
          />
        </label>
        <label>
          Date of birth (optional)
          <input
            type="date"
            autoComplete="bday"
            value={form.birthday}
            onChange={e => setForm({ ...form, birthday: e.target.value })}
          />
        </label>
        <label>
          Gender (optional)
          <select
            aria-label="Gender"
            value={form.gender}
            onChange={e =>
              setForm({ ...form, gender: e.target.value as typeof form.gender })
            }
          >
            <option value="">Not set</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label>
          About you (optional)
          <textarea
            maxLength={500}
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <label>
          Instagram username (optional)
          <input
            maxLength={60}
            value={form.instagramUsername}
            onChange={e =>
              setForm({ ...form, instagramUsername: e.target.value })
            }
          />
        </label>
        {update.error && <p role="alert">{update.error.message}</p>}
        {update.isSuccess && <p role="status">Profile saved.</p>}
        <Action type="submit" disabled={update.isPending || upload.isPending}>
          {update.isPending ? "Saving…" : "Save profile"}
        </Action>
      </form>
    </Screen>
  );
}
export function BusinessEditor() {
  const setup = useArtistSetup();
  const query = trpc.artistSettings.get.useQuery();
  return (
    <Screen title="Business details" back={setup ? undefined : "/settings"}>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data && <BusinessForm initial={query.data} />}
    </Screen>
  );
}
function BusinessForm({ initial }: { initial: any }) {
  const setup = useArtistSetup();
  const [form, setForm, clearDraft] = useSetupDraft(
    {
      businessName: initial.businessName || "",
      displayName: initial.displayName || "",
      businessAddress: initial.businessAddress || "",
      businessEmail: initial.businessEmail || "",
      businessCountry: initial.businessCountry || "AU",
      licenceNumber: initial.licenceNumber || "",
      rescheduleNoticePeriodHours: initial.rescheduleNoticePeriodHours ?? 72,
    },
    "business"
  );
  const utils = trpc.useUtils();
  const save = trpc.artistSettings.upsert.useMutation({
    onSuccess: async () => {
      clearDraft();
      await utils.artistSettings.invalidate();
      await setup?.onSaved();
    },
  });
  return (
    <form
      className="v3-form"
      onSubmit={e => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      {setup && (
        <p className="v3-muted">
          Add your tattooing address and country to continue. Your working hours
          and services come next.
        </p>
      )}
      <Section title="Where you work">
        <div className="v3-form">
          <label>
            Business name
            <input
              value={form.businessName}
              onChange={e => setForm({ ...form, businessName: e.target.value })}
            />
          </label>
          <label>
            Public display name
            <input
              value={form.displayName}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
            />
          </label>
          <label>
            Business email
            <input
              type="email"
              value={form.businessEmail}
              onChange={e =>
                setForm({ ...form, businessEmail: e.target.value })
              }
            />
          </label>
          <label>
            Studio address{setup ? " (required)" : ""}
            <textarea
              required={!!setup}
              autoComplete="street-address"
              value={form.businessAddress}
              onChange={e =>
                setForm({ ...form, businessAddress: e.target.value })
              }
            />
          </label>
          <label>
            Country
            <select
              value={form.businessCountry}
              onChange={e =>
                setForm({ ...form, businessCountry: e.target.value })
              }
            >
              <option value="AU">Australia</option>
              <option value="NZ">New Zealand</option>
              {!["AU", "NZ"].includes(form.businessCountry) && (
                <option value={form.businessCountry}>
                  {form.businessCountry}
                </option>
              )}
            </select>
          </label>
        </div>
      </Section>
      <Section title="Booking details">
        <div className="v3-form">
          <label>
            Licence number (optional)
            <input
              value={form.licenceNumber}
              onChange={e =>
                setForm({ ...form, licenceNumber: e.target.value })
              }
            />
          </label>
          <label>
            Reschedule notice · hours
            <NumericInput
              type="number"
              min={0}
              required
              value={form.rescheduleNoticePeriodHours}
              onChange={e =>
                setForm({
                  ...form,
                  rescheduleNoticePeriodHours: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </Section>
      {save.error && <p role="alert">{save.error.message}</p>}
      {save.isSuccess && <p role="status">Business details saved.</p>}
      <Action type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save business details"}
      </Action>
    </form>
  );
}
