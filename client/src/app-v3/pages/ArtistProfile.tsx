import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Tabs,
} from "../design/primitives";

type Settings = inferRouterOutputs<AppRouter>["artistSettings"]["get"];
export default function ArtistProfile() {
  const { user } = useAuth();
  const settings = trpc.artistSettings.get.useQuery();
  const search = useSearch();
  const [, go] = useLocation();
  const tab =
    new URLSearchParams(search).get("view") === "Portfolio"
      ? "Portfolio"
      : "Profile";
  return (
    <Screen
      title="Profile"
      subtitle="A clear introduction to you and your work."
      back="/dashboard"
      wide
    >
      <Feedback
        loading={settings.isLoading}
        error={settings.error}
        onRetry={() => settings.refetch()}
      />
      {settings.data && user && (
        <>
          <Row
            title={settings.data.displayName || user.name || "Your name"}
            detail={user.city || "Add your location in profile details"}
            icon={<Avatar name={user.name} src={user.avatar} />}
          />
          <div className="v3-inline">
            <ActionLink href="/business">
              Business settings & payouts
            </ActionLink>
            {settings.data.publicSlug && (
              <ActionLink href={`/book/${settings.data.publicSlug}`}>
                Preview booking page
              </ActionLink>
            )}
            <ActionLink href="/settings?section=booking-link">
              Share your booking link
            </ActionLink>
            <ActionLink href="/settings?section=profile">
              Photo & personal details
            </ActionLink>
          </div>
          <PublicDetails settings={settings.data} />
        </>
      )}
    </Screen>
  );
}
function PublicDetails({ settings }: { settings: Settings }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    displayName: settings.displayName || "",
    showEmail: !!settings.showEmail,
    showPhone: !!settings.showPhone,
    showCity: !!settings.showCity,
    showWebsite: !!settings.showWebsite,
    websiteUrl: settings.websiteUrl || "",
  });
  const save = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      void utils.artistSettings.invalidate();
      void utils.feed.invalidate();
    },
  });
  return (
    <Section title="What clients see">
      <form
        className="v3-form"
        onChange={() => save.reset()}
        onSubmit={e => {
          e.preventDefault();
          save.mutate({
            ...form,
            showEmail: Number(form.showEmail),
            showPhone: Number(form.showPhone),
            showCity: Number(form.showCity),
            showWebsite: Number(form.showWebsite),
          });
        }}
      >
        <fieldset disabled={save.isPending}>
          <label>
            Artist display name
            <input
              maxLength={100}
              required
              value={form.displayName}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
            />
          </label>
          <label>
            Website
            <input
              type="url"
              pattern="https?://.+"
              maxLength={500}
              value={form.websiteUrl}
              onChange={e => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://"
            />
          </label>
          <div className="v3-check-list">
            {(
              [
                ["showEmail", "Show email"],
                ["showPhone", "Show phone"],
                ["showCity", "Show city"],
                ["showWebsite", "Show website"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <Action type="submit">
            {save.isPending ? "Saving…" : "Save public profile"}
          </Action>
        </fieldset>
        {save.error && <p role="alert">{save.error.message}</p>}
        {save.isSuccess && <p role="status">Public profile saved.</p>}
      </form>
      <p className="v3-muted">
        Update your bio, contact details and profile photo in Personal details.
      </p>
      <ActionLink href="/settings?section=profile">
        Edit personal details
      </ActionLink>
    </Section>
  );
}
function Portfolio() {
  const query = trpc.portfolio.list.useQuery();
  const utils = trpc.useUtils();
  const upload = trpc.upload.uploadImage.useMutation();
  const create = trpc.portfolio.create.useMutation();
  const remove = trpc.portfolio.bulkDelete.useMutation({
    onSuccess: () => {
      setIds([]);
      setConfirm(false);
      void utils.portfolio.invalidate();
      void utils.feed.invalidate();
    },
  });
  const [ids, setIds] = useState<number[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [error, setError] = useState("");
  const busy = upload.isPending || create.isPending;
  const item = query.data?.find(item => item.id === preview);
  async function add() {
    if (!file) return;
    setError("");
    try {
      let url = uploadedUrl;
      if (!url) {
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Couldn’t read this image."));
          reader.readAsDataURL(file);
        });
        url = (
          await upload.mutateAsync({
            fileData,
            fileName: file.name,
            contentType: file.type,
          })
        ).url;
        setUploadedUrl(url);
      }
      await create.mutateAsync({
        imageUrl: url,
        description: description.trim() || undefined,
      });
      setAdding(false);
      setFile(null);
      setUploadedUrl("");
      setDescription("");
      void utils.portfolio.invalidate();
      void utils.feed.invalidate();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t add this image. Your draft is still here."
      );
    }
  }
  return (
    <Section
      title="Portfolio"
      action={
        <Action
          onClick={() => {
            setAdding(true);
            setError("");
          }}
        >
          Add photo
        </Action>
      }
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      <ActionLink href="/settings?section=instagram">
        Instagram import
      </ActionLink>
      {query.data?.length === 0 && (
        <Panel>
          <h3>Let your work introduce you</h3>
          <p>
            Add a few recent tattoos that represent the work you want to book.
          </p>
        </Panel>
      )}
      {ids.length > 0 && (
        <div className="v3-inline">
          <p>{ids.length} selected</p>
          <Action
            tone="danger"
            disabled={remove.isPending}
            onClick={() => {
              remove.reset();
              setConfirm(true);
            }}
          >
            Remove selected
          </Action>
          <Action tone="quiet" onClick={() => setIds([])}>
            Clear selection
          </Action>
        </div>
      )}
      <div className="v3-portfolio-grid">
        {query.data?.map(item => (
          <figure key={item.id}>
            <button
              type="button"
              className="v3-media-preview"
              onClick={() => setPreview(item.id)}
              aria-label={`View ${item.description || "portfolio item"}`}
            >
              <img
                src={item.displayUrl}
                alt={item.description || "Portfolio tattoo"}
                loading="lazy"
              />
              {item.mediaType === "video" && <span>Video</span>}
            </button>
            <label className="v3-portfolio-select">
              <input
                type="checkbox"
                checked={ids.includes(item.id)}
                onChange={e =>
                  setIds(current =>
                    e.target.checked
                      ? [...current, item.id]
                      : current.filter(id => id !== item.id)
                  )
                }
              />
              Select{" "}
              {item.description ? item.description.slice(0, 60) : "photo"}
            </label>
          </figure>
        ))}
      </div>
      {adding && (
        <SheetShell
          isOpen
          title="Add to your portfolio"
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              void add();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={e => {
                    const next = e.target.files?.[0];
                    if (!next) return;
                    if (
                      !next.type.startsWith("image/") ||
                      next.size > 10 * 1024 * 1024
                    ) {
                      setError("Choose an image under 10 MB.");
                      e.target.value = "";
                      return;
                    }
                    setError("");
                    setFile(next);
                    setUploadedUrl("");
                  }}
                />
                <small>{file ? file.name : "One photo, up to 10 MB."}</small>
              </label>
              <label>
                Description
                <textarea
                  maxLength={2000}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <Action type="submit" disabled={!file}>
                {busy ? "Adding…" : "Add photo"}
              </Action>
            </fieldset>
          </form>
        </SheetShell>
      )}
      {item && (
        <SheetShell isOpen title="Your work" onClose={() => setPreview(null)}>
          <div className="v3-stack">
            {item.mediaType === "video" && item.cdnUrl ? (
              <video
                className="v3-media-full"
                controls
                playsInline
                preload="metadata"
                src={item.cdnUrl || undefined}
                poster={item.thumbnailUrl || undefined}
              />
            ) : (
              <img
                className="v3-media-full"
                src={item.imageUrl}
                alt={item.description || "Portfolio tattoo"}
              />
            )}
            <p>{item.description || item.caption}</p>
            {item.externalPermalink &&
              /^https:\/\/(www\.)?instagram\.com\//i.test(
                item.externalPermalink
              ) && (
                <a
                  className="v3-action v3-action-secondary"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={item.externalPermalink}
                >
                  View Instagram post
                </a>
              )}
          </div>
        </SheetShell>
      )}
      {confirm && (
        <SheetShell
          isOpen
          title={`Remove ${ids.length} portfolio item${ids.length === 1 ? "" : "s"}?`}
          onClose={() => {
            if (!remove.isPending) setConfirm(false);
          }}
        >
          <div className="v3-stack">
            <p>
              These items will be removed from your Tattoi portfolio. Original
              Instagram posts are unaffected.
            </p>
            {remove.error && <p role="alert">{remove.error.message}</p>}
            <Action
              tone="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ ids })}
            >
              {remove.isPending ? "Removing…" : "Remove from portfolio"}
            </Action>
            <Action
              tone="secondary"
              disabled={remove.isPending}
              onClick={() => setConfirm(false)}
            >
              Keep items
            </Action>
          </div>
        </SheetShell>
      )}
    </Section>
  );
}

export function BookingLink() {
  const query = trpc.funnel.getFunnelSettings.useQuery();
  return (
    <Screen
      title="Your booking link"
      subtitle="From their first idea to a booking request."
      back="/settings"
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data && (
        <BookingLinkForm initialSlug={query.data.publicSlug || ""} />
      )}
    </Screen>
  );
}
function BookingLinkForm({ initialSlug }: { initialSlug: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [saved, setSaved] = useState(initialSlug);
  const [message, setMessage] = useState("");
  const debounced = useDebounce(slug, 400);
  const changed = slug !== saved;
  const check = trpc.funnel.checkSlugAvailability.useQuery(
    { slug: debounced },
    { enabled: changed && /^[a-z0-9-]{3,50}$/.test(debounced) }
  );
  const utils = trpc.useUtils();
  const save = trpc.funnel.updateFunnelSettings.useMutation({
    onSuccess: () => {
      setSaved(slug);
      setMessage("Booking link saved.");
      void utils.funnel.invalidate();
      void utils.artistSettings.invalidate();
      void utils.feed.invalidate();
    },
  });
  const url = saved ? `${window.location.origin}/book/${saved}` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Booking link copied.");
    } catch {
      setMessage("Copy the link from the field below.");
    }
  }
  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: "Book with me", url });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setMessage("Couldn’t share. You can copy the link instead.");
    }
  }
  const available =
    !changed ||
    (slug === debounced && !check.isFetching && check.data?.available === true);
  return (
    <>
      <Panel>
        <p>
          Clients open your profile and submit their request first. They create
          a password afterwards, so an account never stands between them and
          their first enquiry.
        </p>
      </Panel>
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          save.mutate({ publicSlug: slug, funnelEnabled: true });
        }}
      >
        <label>
          Link name
          <input
            required
            minLength={3}
            aria-label="Link name"
            maxLength={50}
            pattern="[a-z0-9-]+"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={save.isPending}
            value={slug}
            onChange={e => {
              setMessage("");
              save.reset();
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
          />
          <small>Use 3–50 lowercase letters, numbers or hyphens.</small>
        </label>
        {changed && slug === debounced && check.data?.available === false && (
          <p role="status">This link name is already taken.</p>
        )}
        {check.error && (
          <p role="alert">
            Couldn’t check link availability.{" "}
            <button type="button" onClick={() => check.refetch()}>
              Try again
            </button>
          </p>
        )}
        {save.error && <p role="alert">{save.error.message}</p>}
        <Action
          type="submit"
          disabled={!changed || !available || save.isPending || slug.length < 3}
        >
          {save.isPending ? "Saving…" : "Save booking link"}
        </Action>
      </form>
      {message && <p role="status">{message}</p>}
      {url && (
        <Section title="Ready to share">
          <div className="v3-form">
            <label>
              Your saved booking link
              <input readOnly value={url} onFocus={e => e.target.select()} />
            </label>
          </div>
          <div className="v3-inline">
            <Action onClick={share}>Share link</Action>
            <Action tone="secondary" onClick={copy}>
              Copy link
            </Action>
            <ActionLink href={`/book/${saved}`}>Preview</ActionLink>
          </div>
          <p className="v3-muted">
            Add it to your Instagram bio, website or a message. Share the saved
            link; unsaved changes are not live.
          </p>
        </Section>
      )}
    </>
  );
}
