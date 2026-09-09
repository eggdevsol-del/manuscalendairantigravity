import { SubscriptionCheckoutSheet } from "./SubscriptionCheckoutSheet";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button, Input, Label } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import ArtistInvitations from "@/features/studio/ArtistInvitations";

export function StudioDashboardSettings({ onBack }: { onBack: () => void }) {
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<"artist" | "manager">("artist");
  const [showInvites, setShowInvites] = useState(false);
  const studio = trpc.studios.getCurrentStudio.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const team = trpc.studios.getStudioMembers.useQuery(
    { studioId: studio.data?.id || "" },
    { enabled: !!studio.data }
  );
  const dates = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startDate: start, endDate: end };
  }, []);
  const calendar = trpc.appointments.getStudioCalendar.useQuery(
    { studioId: studio.data?.id || "", ...dates },
    { enabled: !!studio.data }
  );
  const offer = trpc.billing.studioOffer.useQuery(undefined, {
    staleTime: 60000,
  });
  const create = trpc.studios.createStudio.useMutation({
    onSuccess: () => void studio.refetch(),
  });
  const invite = trpc.studios.inviteArtist.useMutation({
    onSuccess: () => {
      setEmail("");
      void team.refetch();
    },
  });
  const remove = trpc.studios.removeMember.useMutation({
    onSuccess: () => {
      void team.refetch();
      void studio.refetch();
      void utils.appointments.invalidate();
    },
  });
  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: data => {
      setCheckoutSecret(data.clientSecret);
    },
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: data => {
      if (data.url) window.location.assign(data.url);
    },
  });
  const current = studio.data,
    owner = current?.role === "owner",
    manager = owner || current?.role === "manager";
  const active =
    !!current?.stripeSubscriptionId &&
    ["active", "trialing"].includes(current?.subscriptionStatus || "");
  const problem =
    create.error ||
    invite.error ||
    remove.error ||
    checkout.error ||
    portal.error;
  if (showInvites)
    return <ArtistInvitations onBack={() => setShowInvites(false)} />;
  return (
    <PageShell>
      {checkoutSecret && (
        <SubscriptionCheckoutSheet
          clientSecret={checkoutSecret}
          name="Studio"
          active={active}
          onClose={() => setCheckoutSecret(null)}
          onRefresh={() => void studio.refetch()}
        />
      )}
      <PageHeader
        title={current?.name || "Your studio"}
        subtitle="Your team and shared schedule."
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 sm:px-6 pt-4 pb-32">
        <div className="max-w-3xl mx-auto space-y-6">
          {studio.isLoading && <p role="status">Loading studio…</p>}
          {studio.error && (
            <div role="alert">
              <p>Studio information is unavailable.</p>
              <Button onClick={() => void studio.refetch()}>Retry</Button>
            </div>
          )}
          {problem && (
            <p role="alert" className="text-destructive">
              {problem.message}
            </p>
          )}
          {!studio.isLoading && !studio.error && !current && (
            <section className="rounded-2xl border bg-card p-5 space-y-4">
              <h2 className="text-lg font-semibold">Set up your studio</h2>
              <p className="text-sm text-muted-foreground">
                Keep your existing artist account and clients. Create a shared
                space for your team, then activate billing before inviting
                artists.
              </p>
              <form
                className="space-y-3"
                onSubmit={event => {
                  event.preventDefault();
                  create.mutate({ name: name.trim() });
                }}
              >
                <Label htmlFor="studio-name">Studio name</Label>
                <Input
                  id="studio-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  minLength={2}
                  maxLength={255}
                  required
                />
                <Button disabled={create.isPending || name.trim().length < 2}>
                  {create.isPending ? "Creating…" : "Create studio"}
                </Button>
              </form>
            </section>
          )}
          <Button variant="outline" onClick={() => setShowInvites(true)}>
            View your invitations
          </Button>
          {current && (
            <>
              <section className="rounded-2xl border bg-card p-5 space-y-3">
                <h2 className="text-lg font-semibold">Studio membership</h2>
                <p className="text-sm text-muted-foreground">
                  Studio includes Pro payment benefits. Activating Studio
                  cancels separate Pro renewals for active members; already-paid
                  periods remain available.
                </p>
                <p className="text-sm">
                  Billing:{" "}
                  <span className="capitalize">
                    {current.subscriptionStatus || "Not activated"}
                  </span>
                </p>
                {!active && (
                  <p className="text-sm text-muted-foreground">
                    Team invitations require an active subscription. Existing
                    team members can still access their shared schedule.
                  </p>
                )}
                {owner && (
                  <div className="space-y-3">
                    {current.stripeSubscriptionId ? (
                      <Button
                        disabled={portal.isPending}
                        onClick={() => portal.mutate({ studioId: current.id })}
                      >
                        Manage billing
                      </Button>
                    ) : (
                      <>
                        <p className="text-sm">
                          {offer.isLoading
                            ? "Checking subscription options…"
                            : offer.error
                              ? "Subscription pricing is unavailable."
                              : offer.data
                                ? `${new Intl.NumberFormat("en-AU", { style: "currency", currency: offer.data.currency }).format(offer.data.amountCents / 100)} ${offer.data.currency.toUpperCase()} every ${offer.data.intervalCount} ${offer.data.interval}${offer.data.intervalCount > 1 ? "s" : ""}`
                                : "Studio billing is awaiting configuration."}
                        </p>
                        <Button
                          disabled={!offer.data || checkout.isPending}
                          onClick={() =>
                            checkout.mutate({ studioId: current.id })
                          }
                        >
                          {checkout.isPending
                            ? "Opening checkout…"
                            : "Choose Studio"}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => void studio.refetch()}
                    >
                      Refresh billing status
                    </Button>
                  </div>
                )}
              </section>
              <section className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="text-lg font-semibold">Team</h2>
                {team.isLoading && <p role="status">Loading team…</p>}
                {team.error && (
                  <Button variant="outline" onClick={() => void team.refetch()}>
                    Retry loading team
                  </Button>
                )}
                {team.data
                  ?.filter(member =>
                    ["active", "pending_invite"].includes(member.status)
                  )
                  .map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 border-b pb-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium break-words">
                          {member.user.name || member.user.email}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {member.role} ·{" "}
                          {member.status === "pending_invite"
                            ? "Invitation pending"
                            : member.status}
                        </p>
                      </div>
                      {member.user.id !== current.ownerId &&
                        (owner || member.user.id === user?.id) && (
                          <Button
                            variant="outline"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  member.user.id === user?.id
                                    ? "Leave this studio? Your clients and personal booking history remain with your artist account."
                                    : "Remove this member’s access to the studio? Their personal clients and bookings remain with them."
                                )
                              )
                                remove.mutate({
                                  studioId: current.id,
                                  userId: member.user.id,
                                });
                            }}
                          >
                            {member.user.id === user?.id ? "Leave" : "Remove"}
                          </Button>
                        )}
                    </div>
                  ))}
                {manager && (
                  <form
                    className="space-y-3 pt-2"
                    onSubmit={event => {
                      event.preventDefault();
                      invite.mutate({
                        studioId: current.id,
                        artistEmail: email.trim(),
                        role,
                      });
                    }}
                  >
                    <h3 className="font-semibold">Invite an artist</h3>
                    <p className="text-sm text-muted-foreground">
                      Use their existing Tattoi artist email. The invitation
                      appears in their studio invitations and chat.
                    </p>
                    <Label htmlFor="studio-invite-email">Artist email</Label>
                    <Input
                      id="studio-invite-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                    <Label htmlFor="studio-invite-role">Role</Label>
                    <select
                      id="studio-invite-role"
                      className="w-full rounded-lg border bg-background p-3"
                      value={role}
                      onChange={e => setRole(e.target.value as typeof role)}
                    >
                      <option value="artist">Artist</option>
                      <option value="manager">Manager</option>
                    </select>
                    <Button disabled={!active || invite.isPending || !email}>
                      {invite.isPending ? "Sending…" : "Send invitation"}
                    </Button>
                    {invite.isSuccess && (
                      <p role="status" className="text-sm">
                        Invitation sent.
                      </p>
                    )}
                  </form>
                )}
              </section>
              <section className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="text-lg font-semibold">Next seven days</h2>
                <p className="text-sm text-muted-foreground">
                  Bookings assigned to this studio, across active artists.
                </p>
                {calendar.isLoading && <p role="status">Loading schedule…</p>}
                {calendar.error && (
                  <Button
                    variant="outline"
                    onClick={() => void calendar.refetch()}
                  >
                    Retry schedule
                  </Button>
                )}
                {calendar.data?.length === 0 && (
                  <p>No studio bookings in the next seven days.</p>
                )}
                {calendar.data?.map(appointment => (
                  <div className="border-b pb-3 space-y-1" key={appointment.id}>
                    <p className="font-medium">
                      {appointment.title ||
                        appointment.serviceName ||
                        "Appointment"}
                    </p>
                    <p className="text-sm">
                      {new Date(appointment.startTime).toLocaleString("en-AU", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {team.data?.find(
                        member => member.user.id === appointment.artistId
                      )?.user.name || "Artist"}{" "}
                      · {appointment.clientName || "Client"} ·{" "}
                      {appointment.status}
                    </p>
                    {appointment.artistId === user?.id &&
                      appointment.conversationId && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            navigate(`/chat/${appointment.conversationId}`)
                          }
                        >
                          Open booking conversation
                        </Button>
                      )}
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
