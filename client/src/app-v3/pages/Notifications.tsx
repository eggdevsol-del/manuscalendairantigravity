import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { useWebPush } from "@/hooks/useWebPush";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
type Template = inferRouterOutputs<AppRouter>["notifications"]["list"][number];
const kinds = {
  confirmation: "Confirmation",
  reminder: "Reminder",
  follow_up: "Follow-up",
  birthday: "Birthday",
  promotional: "Promotional",
  aftercare: "Aftercare",
  preparation: "Preparation",
  custom: "Custom",
};
export default function Notifications() {
  const { user } = useAuth();
  const artist = user?.role === "artist" || user?.role === "admin";
  return (
    <Screen
      title="Notifications"
      subtitle="Stay up to date with your bookings"
      back={user?.role === "merchant" ? "/account-settings" : "/settings"}
    >
      <DeviceNotifications />
      {artist && <Templates />}
    </Screen>
  );
}
function DeviceNotifications() {
  const push = useWebPush();
  const active = push.status === "granted" && !!push.subscription;
  return (
    <Section title="This device">
      <Panel>
        <div className="v3-inline">
          <h2>Push notifications</h2>
          <Status tone={active ? "success" : "neutral"}>
            {active ? "On" : push.status === "loading" ? "Checking…" : "Off"}
          </Status>
        </div>
        <p>Booking updates and messages, even when you’re away from the app.</p>
        {push.status === "denied" ? (
          <p>
            Notifications are blocked. Allow them in your browser or device
            settings, then reopen the app.
          </p>
        ) : push.status === "unsupported" ? (
          <p>
            This browser doesn’t support push notifications. On iPhone or iPad,
            open Tattoi from your Home Screen to check availability.
          </p>
        ) : !active ? (
          <Action
            disabled={push.isSubscribing || push.status === "loading"}
            onClick={() => push.subscribe()}
          >
            {push.isSubscribing ? "Enabling…" : "Enable notifications"}
          </Action>
        ) : (
          <Action
            tone="secondary"
            disabled={push.isTesting}
            onClick={() => push.sendTestPush()}
          >
            {push.isTesting ? "Sending…" : "Send a test to me"}
          </Action>
        )}
      </Panel>
    </Section>
  );
}
function Templates() {
  const query = trpc.notifications.list.useQuery();
  const [selected, setSelected] = useState<Template | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Section
      title="Saved message templates"
      action={<Action onClick={() => setSelected("new")}>Add template</Action>}
    >
      <p className="v3-muted">
        Prepare reusable wording for your client communications. Saving a
        template does not schedule a delivery.
      </p>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data?.map(t => (
        <Row
          key={t.id}
          title={t.title}
          detail={
            kinds[t.templateType] + " · " + (t.enabled ? "Enabled" : "Disabled")
          }
          onClick={() => setSelected(t)}
        />
      ))}
      {!query.isLoading && !query.error && !query.data?.length && (
        <Feedback empty="Add your first template for confirmations, preparation or aftercare." />
      )}
      <SheetShell
        isOpen={selected !== null}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title={selected === "new" ? "Add template" : "Edit template"}
      >
        {selected && (
          <TemplateEditor
            key={selected === "new" ? "new" : selected.id}
            template={selected === "new" ? undefined : selected}
            onBusy={setBusy}
            onSaved={() => {
              setSelected(null);
              void query.refetch();
            }}
          />
        )}
      </SheetShell>
    </Section>
  );
}
function TemplateEditor({
  template,
  onSaved,
  onBusy,
}: {
  template?: Template;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState({
    templateType: template?.templateType || "confirmation",
    title: template?.title || "",
    content: template?.content || "",
    timing: template?.timing || "",
    enabled: template ? !!template.enabled : true,
  });
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const create = trpc.notifications.create.useMutation();
  const update = trpc.notifications.update.useMutation();
  const remove = trpc.notifications.delete.useMutation();
  const busy = create.isPending || update.isPending || remove.isPending;
  async function save(deleting = false) {
    if (busy) return;
    onBusy(true);
    setError("");
    try {
      if (deleting && template) await remove.mutateAsync(template.id);
      else if (template)
        await update.mutateAsync({ ...draft, id: template.id });
      else await create.mutateAsync(draft);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      onBusy(false);
    }
  }
  return (
    <form
      className="v3-form"
      onSubmit={e => {
        e.preventDefault();
        void save();
      }}
    >
      <label>
        Purpose
        <select
          aria-label="Purpose"
          value={draft.templateType}
          onChange={e =>
            setDraft({
              ...draft,
              templateType: e.target.value as Template["templateType"],
            })
          }
        >
          {Object.entries(kinds).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input
          required
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        Message
        <textarea
          required
          rows={6}
          value={draft.content}
          onChange={e => setDraft({ ...draft, content: e.target.value })}
        />
      </label>
      <label>
        Timing note
        <input
          value={draft.timing}
          onChange={e => setDraft({ ...draft, timing: e.target.value })}
          placeholder="For example, 24 hours before"
        />
      </label>
      <label className="v3-inline">
        <input
          type="checkbox"
          style={{ width: "auto", minHeight: 0 }}
          checked={draft.enabled}
          onChange={e => setDraft({ ...draft, enabled: e.target.checked })}
        />
        Enable template
      </label>
      {error && <p role="alert">{error}</p>}
      <Action type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save template"}
      </Action>
      {template &&
        (confirmDelete ? (
          <Panel>
            <p>Delete this saved template? This cannot be undone.</p>
            <Action tone="danger" disabled={busy} onClick={() => save(true)}>
              Delete template
            </Action>
            <Action
              tone="quiet"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Keep template
            </Action>
          </Panel>
        ) : (
          <Action tone="quiet" onClick={() => setConfirmDelete(true)}>
            Delete template
          </Action>
        ))}
    </form>
  );
}
