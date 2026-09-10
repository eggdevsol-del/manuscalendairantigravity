import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  Feedback,
  Panel,
  Row,
  Screen,
  Status,
} from "../design/primitives";

export function AccountRemoval() {
  const { user } = useAuth();
  const [confirm, setConfirm] = useState("");
  const remove = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");
      window.location.assign("/login");
    },
  });
  return (
    <Screen
      title="Delete your account"
      back={user?.role === "merchant" ? "/account-settings" : "/settings"}
    >
      <Panel>
        <h2>This cannot be undone</h2>
        <p>
          Deleting your account removes your Tattoi profile and access to its
          bookings and conversations. Export any records you need before
          continuing.
        </p>
        <p>
          Resolve any active subscriptions, orders and payments first. Account
          deletion does not issue a Stripe refund.
        </p>
      </Panel>
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          if (confirm === "DELETE" && !remove.isPending) remove.mutate();
        }}
      >
        <label>
          Type DELETE to confirm
          <input
            autoComplete="off"
            value={confirm}
            disabled={remove.isPending}
            onChange={e => setConfirm(e.target.value)}
          />
        </label>
        {remove.error && <p role="alert">{remove.error.message}</p>}
        <Action
          tone="danger"
          type="submit"
          disabled={confirm !== "DELETE" || remove.isPending}
        >
          {remove.isPending ? "Deleting…" : "Permanently delete account"}
        </Action>
      </form>
    </Screen>
  );
}

export function Consultations() {
  const { user } = useAuth();
  const [, go] = useLocation();
  const query = trpc.consultations.list.useQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const create = trpc.conversations.getOrCreate.useMutation();
  const update = trpc.consultations.update.useMutation();
  const record = query.data?.find(item => item.id === selected);
  const busy = create.isPending || update.isPending;
  async function openConversation() {
    if (!record || !user || busy) return;
    try {
      let id = record.conversationId;
      if (!id && record.artistId && record.clientId)
        id =
          (
            await create.mutateAsync({
              artistId: record.artistId,
              clientId: record.clientId,
            })
          )?.id || null;
      if (!id) return;
      await update.mutateAsync({
        id: record.id,
        conversationId: id,
        viewed: 1,
      });
      go(`/chat/${id}`);
    } catch {}
  }
  return (
    <Screen
      title="Consultation requests"
      subtitle="The idea behind the appointment."
      back="/settings"
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data?.length === 0 && (
        <Feedback empty="New client requests will appear in your inbox." />
      )}
      {query.data?.map(item => (
        <Row
          key={item.id}
          title={item.subject}
          detail={item.client?.name || "Client"}
          trailing={<Status>{item.status}</Status>}
          onClick={() => setSelected(item.id)}
        />
      ))}
      <SheetShell
        isOpen={!!record}
        title={record?.subject || "Consultation"}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        {record && (
          <div className="v3-stack">
            <p style={{ whiteSpace: "pre-wrap" }}>{record.description}</p>
            {(create.error || update.error) && (
              <p role="alert">{(create.error || update.error)?.message}</p>
            )}
            <Action
              disabled={busy || !record.clientId || !record.artistId}
              onClick={openConversation}
            >
              {busy ? "Opening…" : "Open conversation"}
            </Action>
          </div>
        )}
      </SheetShell>
    </Screen>
  );
}
