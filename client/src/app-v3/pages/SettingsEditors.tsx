import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Action,
  Avatar,
  Feedback,
  Screen,
  Section,
} from "../design/primitives";
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
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    bio: user.bio || "",
    city: user.city || "",
    instagramUsername: user.instagramUsername || "",
    avatar: user.avatar || "",
    birthday: user.birthday?.slice(0, 10) || "",
    country: user.country || "",
    gender: (user.gender || "") as NonNullable<typeof user.gender> | "",
  });
  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      refresh();
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
        back || (user.role === "merchant" ? "/account-settings" : "/settings")
      }
    >
      <form
        className="v3-form"
        onChange={() => update.reset()}
        onSubmit={e => {
          e.preventDefault();
          update.mutate({
            ...form,
            birthday: form.birthday || undefined,
            gender: form.gender || undefined,
          });
        }}
      >
        <div className="v3-inline">
          <Avatar name={form.name} src={form.avatar} />
          <label>
            Profile photo
            <input
              type="file"
              accept="image/*"
              disabled={upload.isPending}
              onChange={e => image(e.target.files?.[0])}
            />
          </label>
        </div>
        {uploadError && <p role="alert">{uploadError}</p>}
        <label>
          Full name
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
          Phone
          <input
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
          City
          <input
            maxLength={100}
            autoComplete="address-level2"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
          />
        </label>
        <label>
          Country
          <input
            autoComplete="country-name"
            maxLength={100}
            value={form.country}
            onChange={e => setForm({ ...form, country: e.target.value })}
          />
        </label>
        <label>
          Date of birth
          <input
            type="date"
            autoComplete="bday"
            value={form.birthday}
            onChange={e => setForm({ ...form, birthday: e.target.value })}
          />
        </label>
        <label>
          Gender
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
          About you
          <textarea
            maxLength={500}
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <label>
          Instagram username
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
  const query = trpc.artistSettings.get.useQuery();
  return (
    <Screen title="Business details" back="/settings">
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
  const [form, setForm] = useState({
    businessName: initial.businessName || "",
    displayName: initial.displayName || "",
    businessAddress: initial.businessAddress || "",
    businessEmail: initial.businessEmail || "",
    businessCountry: initial.businessCountry || "AU",
    licenceNumber: initial.licenceNumber || "",
    rescheduleNoticePeriodHours: initial.rescheduleNoticePeriodHours ?? 72,
  });
  const utils = trpc.useUtils();
  const save = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      void utils.artistSettings.invalidate();
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
            Studio address
            <textarea
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
            Licence number
            <input
              value={form.licenceNumber}
              onChange={e =>
                setForm({ ...form, licenceNumber: e.target.value })
              }
            />
          </label>
          <label>
            Reschedule notice · hours
            <input
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
