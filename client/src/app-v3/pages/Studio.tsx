import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  bookingDate,
  instant,
  money,
} from "@/features/workspace/bookingPresentation";
import { SubscriptionCheckoutSheet } from "./SubscriptionCheckout";
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
  Tabs,
} from "../design/primitives";

export default function Studio() {
  const search = useSearch();
  if (new URLSearchParams(search).get("view") === "invitations")
    return <Invitations />;
  return <StudioWorkspace />;
}
function StudioWorkspace() {
  const { user } = useAuth();
  const search = useSearch();
  const [, go] = useLocation();
  const view = new URLSearchParams(search).get("view");
  const tab = view === "Team" || view === "Billing" ? view : "Schedule";
  const utils = trpc.useUtils();
  const studio = trpc.studios.getCurrentStudio.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const current = studio.data;
  const team = trpc.studios.getStudioMembers.useQuery(
    { studioId: current?.id || "" },
    { enabled: !!current }
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"artist" | "manager">("artist");
  const [week, setWeek] = useState(0);
  const [artist, setArtist] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const dates = useMemo(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() + week * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    endDate.setMilliseconds(-1);
    return { startDate, endDate };
  }, [week]);
  const calendar = trpc.appointments.getStudioCalendar.useQuery(
    { studioId: current?.id || "", ...dates },
    { enabled: !!current }
  );
  const offer = trpc.billing.studioOffer.useQuery();
  const refresh = () => {
    void studio.refetch();
    void utils.studios.invalidate();
    void utils.appointments.invalidate();
    void utils.billing.invalidate();
  };
  const create = trpc.studios.createStudio.useMutation({ onSuccess: refresh });
  const invite = trpc.studios.inviteArtist.useMutation({
    onSuccess: () => {
      setEmail("");
      void team.refetch();
    },
  });
  const remove = trpc.studios.removeMember.useMutation({
    onSuccess: () => {
      setRemoveTarget(null);
      refresh();
    },
  });
  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: data => setSecret(data.clientSecret),
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: data => window.location.assign(data.url),
  });
  const owner = current?.role === "owner";
  const manager = owner || current?.role === "manager";
  const active =
    !!current?.stripeSubscriptionId &&
    ["active", "trialing"].includes(current.subscriptionStatus || "");
  const members =
    team.data?.filter(m => ["active", "pending_invite"].includes(m.status)) ||
    [];
  const bookings =
    calendar.data?.filter(a => !artist || a.artistId === artist) || [];
  const appointment = bookings.find(a => a.id === selected);
  const problem =
    create.error ||
    invite.error ||
    remove.error ||
    checkout.error ||
    portal.error;
  return (
    <Screen
      title={current?.name || "Your studio"}
      subtitle="A shared schedule. An independent practice."
      back="/business"
      wide
    >
      <Feedback
        loading={studio.isLoading}
        error={studio.error}
        onRetry={() => studio.refetch()}
      />
      {problem && <p role="alert">{problem.message}</p>}
      <ActionLink href="/studio?view=invitations">Your invitations</ActionLink>
      {!studio.isLoading && !studio.error && !current && (
        <Section title="Make room for your team">
          <Panel>
            <p>
              Create your studio workspace, then activate its monthly plan to
              invite artists. Your artist account, clients and personal history
              stay with you.
            </p>
            <form
              className="v3-form"
              onSubmit={e => {
                e.preventDefault();
                create.mutate({ name: name.trim() });
              }}
            >
              <label>
                Studio name
                <input
                  required
                  minLength={2}
                  maxLength={255}
                  value={name}
                  disabled={create.isPending}
                  onChange={e => setName(e.target.value)}
                />
              </label>
              <Action
                type="submit"
                disabled={create.isPending || name.trim().length < 2}
              >
                {create.isPending ? "Creating…" : "Create studio"}
              </Action>
            </form>
          </Panel>
        </Section>
      )}
      {current && (
        <>
          <Tabs
            label="Studio sections"
            items={["Schedule", "Team", "Billing"] as const}
            value={tab}
            onChange={next => go(`/studio?view=${next}`)}
          />
          {tab === "Schedule" && (
            <>
              <div className="v3-inline">
                <Action
                  tone="secondary"
                  onClick={() => {
                    setWeek(n => n - 1);
                    setSelected(null);
                  }}
                >
                  Previous week
                </Action>
                <Action
                  tone="quiet"
                  onClick={() => {
                    setWeek(0);
                    setSelected(null);
                  }}
                >
                  This week
                </Action>
                <Action
                  tone="secondary"
                  onClick={() => {
                    setWeek(n => n + 1);
                    setSelected(null);
                  }}
                >
                  Next week
                </Action>
              </div>
              <div className="v3-form">
                <label>
                  Artist
                  <select
                    value={artist}
                    onChange={e => {
                      setArtist(e.target.value);
                      setSelected(null);
                    }}
                  >
                    <option value="">All artists</option>
                    {members
                      .filter(m => m.status === "active")
                      .map(m => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name || m.user.email}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <Feedback
                loading={calendar.isLoading}
                error={calendar.error || team.error}
                onRetry={() => {
                  void calendar.refetch();
                  void team.refetch();
                }}
              />
              <div
                className={`v3-studio-split ${appointment ? "v3-studio-selected" : ""}`}
              >
                <Section
                  title={`${dates.startDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${dates.endDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}
                >
                  {!calendar.isLoading &&
                    !calendar.error &&
                    !bookings.length && (
                      <Panel>
                        <p>No studio bookings in this period.</p>
                        <p className="v3-muted">
                          Only bookings assigned to this studio are shown.
                        </p>
                      </Panel>
                    )}
                  {bookings.map(a => (
                    <Row
                      key={a.id}
                      title={a.title || a.serviceName || "Tattoo session"}
                      detail={`${bookingDate(a.startTime, Intl.DateTimeFormat().resolvedOptions().timeZone)} · ${team.data?.find(m => m.user.id === a.artistId)?.user.name || "Artist"} · ${a.clientName || "Client"}`}
                      onClick={() => setSelected(a.id)}
                      trailing={<Status>{a.status}</Status>}
                    />
                  ))}
                </Section>
                {appointment && (
                  <aside className="v3-studio-inspector">
                    <Panel>
                      <div className="v3-inline">
                        <h2>
                          {appointment.title ||
                            appointment.serviceName ||
                            "Session"}
                        </h2>
                        <Action tone="quiet" onClick={() => setSelected(null)}>
                          Close
                        </Action>
                      </div>
                      <p>{appointment.clientName || "Client"}</p>
                      <dl className="v3-facts">
                        <div>
                          <dt>Artist</dt>
                          <dd>
                            {team.data?.find(
                              m => m.user.id === appointment.artistId
                            )?.user.name || "Artist"}
                          </dd>
                        </div>
                        <div>
                          <dt>Starts</dt>
                          <dd>
                            {bookingDate(
                              appointment.startTime,
                              Intl.DateTimeFormat().resolvedOptions().timeZone
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Duration</dt>
                          <dd>
                            {Math.round(
                              (instant(appointment.endTime).getTime() -
                                instant(appointment.startTime).getTime()) /
                                60000
                            )}{" "}
                            minutes
                          </dd>
                        </div>
                        <div>
                          <dt>Payment</dt>
                          <dd>
                            {appointment.paymentStatus?.replaceAll("_", " ") ||
                              (appointment.depositPaid
                                ? "Deposit paid"
                                : "Awaiting deposit")}
                          </dd>
                        </div>
                        <div>
                          <dt>Collected</dt>
                          <dd>
                            {money(appointment.totalPaidAmountCents || 0)}
                          </dd>
                        </div>
                      </dl>
                      {appointment.artistId === user?.id &&
                      appointment.conversationId ? (
                        <ActionLink
                          href={`/projects/${appointment.conversationId}?session=${appointment.id}`}
                        >
                          Open booking workspace
                        </ActionLink>
                      ) : (
                        <p className="v3-muted">
                          The assigned artist manages this client’s booking and
                          messages.
                        </p>
                      )}
                    </Panel>
                  </aside>
                )}
              </div>
            </>
          )}
          {tab === "Team" && (
            <>
              <Section title="Your team">
                <Feedback
                  loading={team.isLoading}
                  error={team.error}
                  onRetry={() => team.refetch()}
                />
                {members.map(member => (
                  <Row
                    key={member.id}
                    title={member.user.name || member.user.email}
                    detail={`${member.role} · ${member.status === "pending_invite" ? "Invitation pending" : "Active"}`}
                    icon={
                      <Avatar
                        name={member.user.name}
                        src={member.user.avatar}
                      />
                    }
                    trailing={
                      member.user.id !== current.ownerId &&
                      (owner || member.user.id === user?.id) ? (
                        <Action
                          tone="quiet"
                          disabled={remove.isPending}
                          onClick={() => {
                            remove.reset();
                            setRemoveTarget({
                              id: member.user.id,
                              name:
                                member.user.name ||
                                member.user.email ||
                                "this member",
                            });
                          }}
                        >
                          {member.user.id === user?.id ? "Leave" : "Remove"}
                        </Action>
                      ) : undefined
                    }
                  />
                ))}
              </Section>
              {manager && (
                <Section title="Invite an artist">
                  <Panel>
                    <p>
                      Use their existing Tattoi artist email. The invitation
                      appears in their studio invitations and chat.
                    </p>
                    {!active && (
                      <p role="status">
                        Activate Studio billing before inviting your team.
                      </p>
                    )}
                    <form
                      className="v3-form"
                      onSubmit={e => {
                        e.preventDefault();
                        invite.mutate({
                          studioId: current.id,
                          artistEmail: email.trim(),
                          role,
                        });
                      }}
                    >
                      <fieldset disabled={invite.isPending || !active}>
                        <label>
                          Artist email
                          <input
                            type="email"
                            autoComplete="off"
                            required
                            value={email}
                            onChange={e => {
                              invite.reset();
                              setEmail(e.target.value);
                            }}
                          />
                        </label>
                        <label>
                          Role
                          <select
                            value={role}
                            onChange={e =>
                              setRole(e.target.value as typeof role)
                            }
                          >
                            <option value="artist">Artist</option>
                            <option value="manager">Manager</option>
                          </select>
                          <small>
                            Managers can invite artists and view the studio
                            schedule.
                          </small>
                        </label>
                        <Action type="submit" disabled={!email.trim()}>
                          {invite.isPending ? "Sending…" : "Send invitation"}
                        </Action>
                      </fieldset>
                      {invite.isSuccess && (
                        <p role="status">Invitation sent.</p>
                      )}
                    </form>
                  </Panel>
                </Section>
              )}
              <p className="v3-muted">
                Artists keep their personal clients and booking history if they
                leave. Removing a member ends their access to this studio.
              </p>
            </>
          )}
          {tab === "Billing" && (
            <Section title="Studio membership">
              <Panel>
                <Status tone={active ? "success" : "warning"}>
                  {active
                    ? "Active"
                    : current.subscriptionStatus || "Not activated"}
                </Status>
                <p>
                  One subscription includes Pro payment benefits for up to 10
                  active artists, including the owner.
                </p>
                <p className="v3-muted">
                  Activating Studio cancels separate Pro renewals for active
                  members. Already-paid Pro periods remain available.
                </p>
                {owner ? (
                  current.stripeSubscriptionId ? (
                    <Action
                      disabled={portal.isPending}
                      onClick={() => portal.mutate({ studioId: current.id })}
                    >
                      Manage Studio billing
                    </Action>
                  ) : (
                    <>
                      <Feedback
                        loading={offer.isLoading}
                        error={offer.error}
                        onRetry={() => offer.refetch()}
                      />
                      {offer.data ? (
                        <p>
                          {money(offer.data.amountCents, offer.data.currency)}{" "}
                          {offer.data.currency.toUpperCase()} per month,
                          renewing until cancelled.
                        </p>
                      ) : (
                        !offer.isLoading &&
                        !offer.error && (
                          <p>Studio billing is currently unavailable.</p>
                        )
                      )}
                      <Action
                        disabled={!offer.data || checkout.isPending}
                        onClick={() =>
                          checkout.mutate({ studioId: current.id })
                        }
                      >
                        {checkout.isPending
                          ? "Opening checkout…"
                          : "Choose Studio"}
                      </Action>
                    </>
                  )
                ) : (
                  <p>Your studio owner manages billing.</p>
                )}
                <Action
                  tone="quiet"
                  disabled={studio.isFetching}
                  onClick={() => studio.refetch()}
                >
                  Refresh billing status
                </Action>
              </Panel>
            </Section>
          )}
        </>
      )}
      {removeTarget && current && (
        <SheetShell
          isOpen
          title={
            removeTarget.id === user?.id
              ? "Leave studio?"
              : `Remove ${removeTarget.name}?`
          }
          onClose={() => {
            if (!remove.isPending) setRemoveTarget(null);
          }}
        >
          <div className="v3-stack">
            <p>
              Studio access will end. Personal clients, messages and booking
              history remain with the artist.
            </p>
            {remove.error && <p role="alert">{remove.error.message}</p>}
            <Action
              tone="danger"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate({ studioId: current.id, userId: removeTarget.id })
              }
            >
              {remove.isPending
                ? "Updating…"
                : removeTarget.id === user?.id
                  ? "Leave studio"
                  : "Remove member"}
            </Action>
            <Action
              tone="secondary"
              disabled={remove.isPending}
              onClick={() => setRemoveTarget(null)}
            >
              Keep membership
            </Action>
          </div>
        </SheetShell>
      )}
      {secret && (
        <SubscriptionCheckoutSheet
          clientSecret={secret}
          name="Studio"
          active={active}
          onClose={() => setSecret(null)}
          onRefresh={() => void studio.refetch()}
        />
      )}
    </Screen>
  );
}
function Invitations() {
  const query = trpc.studios.getPendingInvites.useQuery();
  const utils = trpc.useUtils();
  const respond = trpc.studios.respondToInvite.useMutation({
    onSuccess: () => {
      void utils.studios.invalidate();
      void utils.appointments.invalidate();
      void utils.billing.invalidate();
      void utils.messages.invalidate();
    },
  });
  return (
    <Screen title="Studio invitations" back="/studio">
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {respond.error && <p role="alert">{respond.error.message}</p>}
      {respond.isSuccess && (
        <p role="status">Your response has been recorded.</p>
      )}
      {query.data?.length === 0 && (
        <Panel>
          <p>No pending invitations.</p>
        </Panel>
      )}
      {query.data?.map(invite => (
        <Panel key={invite.id}>
          <Row
            title={invite.studio.name}
            detail={`Invited to join as ${invite.role}`}
            icon={
              <Avatar name={invite.studio.name} src={invite.studio.logoUrl} />
            }
          />
          <p>
            Joining an active Studio includes Pro benefits. Any separate Pro
            renewal will be cancelled; already-paid time remains available if
            you leave.
          </p>
          <div className="v3-inline">
            <Action
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate({ inviteId: invite.id, response: "accept" })
              }
            >
              Accept invitation
            </Action>
            <Action
              tone="secondary"
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate({ inviteId: invite.id, response: "decline" })
              }
            >
              Decline
            </Action>
          </div>
        </Panel>
      ))}
    </Screen>
  );
}
