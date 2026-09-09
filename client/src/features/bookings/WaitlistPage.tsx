import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Input, Label } from "@/components/ui";
import { PageHeader } from "@/components/ui/ssot";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { SessionPlanCheckoutSheet } from "./SessionPlanCheckoutSheet";
const date = (value: string) =>
  new Date(value.replace(" ", "T") + "Z").toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function WaitlistPage() {
  const { user } = useAuth();
  const artist = user?.role === "artist" || user?.role === "admin";
  const query = trpc.waitlist.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const [offering, setOffering] = useState<number | null>(null),
    [checkout, setCheckout] = useState<{
      id: number;
      conversationId: number;
    } | null>(null);
  const [startsAt, setStartsAt] = useState(""),
    [duration, setDuration] = useState("60"),
    [estimate, setEstimate] = useState(""),
    [deposit, setDeposit] = useState(""),
    [expiry, setExpiry] = useState("24");
  const refresh = () => void query.refetch();
  const offer = trpc.waitlist.offer.useMutation({
    onSuccess: () => {
      setOffering(null);
      refresh();
    },
  });
  const accept = trpc.waitlist.accept.useMutation({
    onSuccess: (data, variables) => {
      const row = query.data?.find(r => r.id === variables.id);
      if (row)
        setCheckout({
          id: data.sessionPlanId,
          conversationId: row.conversationId,
        });
      refresh();
    },
  });
  const leave = trpc.waitlist.leave.useMutation({ onSuccess: refresh });
  const error = query.error || offer.error || accept.error || leave.error;
  return (
    <main className="app-document h-[calc(100dvh-5rem)] overflow-y-auto touch-pan-y bg-background pb-24">
      <PageHeader
        title={artist ? "Cancellation waitlist" : "Cancellation offers"}
        subtitle={
          artist
            ? "Offer available times to clients who opted in."
            : "Get an earlier appointment when your artist has space."
        }
      />
      <div className="p-5 max-w-3xl mx-auto space-y-5">
        <Link
          href={artist ? "/settings" : "/bookings"}
          className="inline-flex min-h-11 items-center underline"
        >
          Back
        </Link>
        {query.isLoading && <p role="status">Loading waitlist…</p>}
        {error && (
          <div role="alert" className="border rounded-xl p-4">
            <p>{error.message}</p>
            <Button variant="ghost" onClick={refresh}>
              Refresh
            </Button>
          </div>
        )}
        {query.data?.length === 0 && (
          <p>
            {artist
              ? "No clients have joined yet. Clients can opt in from Project details in your conversation."
              : "Open Project details in a conversation with your artist to join their cancellation waitlist."}
          </p>
        )}
        {query.data?.map(row => (
          <article key={row.id} className="border rounded-2xl p-5 space-y-3">
            <div className="flex justify-between gap-3">
              <h2 className="text-lg font-semibold">{row.name}</h2>
              <span className="text-sm capitalize">
                {row.planStatus === "accepted"
                  ? "Booked"
                  : row.expired
                    ? "Expired"
                    : row.status === "accepted"
                      ? "Awaiting deposit"
                      : row.status}
              </span>
            </div>
            {row.note && <p className="text-sm">{row.note}</p>}
            {row.startsAt && (
              <p>
                {date(row.startsAt)} · {row.durationMinutes} minutes
              </p>
            )}
            {row.estimateCents != null && (
              <p>
                Estimate: AUD ${(row.estimateCents / 100).toFixed(2)} · Deposit:
                AUD ${((row.depositCents || 0) / 100).toFixed(2)} plus platform
                fee
              </p>
            )}
            {row.status === "offered" && row.expiresAt && (
              <p className="text-sm">
                Respond by {date(row.expiresAt)}. Your session is confirmed
                after payment; availability is checked again.
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              {artist &&
                ["waiting", "offered", "declined"].includes(row.status) && (
                  <Button
                    onClick={() => {
                      setOffering(row.id);
                      offer.reset();
                    }}
                  >
                    Offer a time
                  </Button>
                )}
              {!artist && row.status === "offered" && !row.expired && (
                <Button
                  disabled={accept.isPending}
                  onClick={() => accept.mutate({ id: row.id })}
                >
                  Review dates & deposit
                </Button>
              )}
              {!artist &&
                row.status === "accepted" &&
                row.planStatus === "pending" &&
                row.sessionPlanId && (
                  <Button
                    onClick={() =>
                      setCheckout({
                        id: row.sessionPlanId!,
                        conversationId: row.conversationId,
                      })
                    }
                  >
                    Continue to deposit
                  </Button>
                )}
              {["waiting", "offered"].includes(row.status) && (
                <Button
                  variant="outline"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate({ id: row.id })}
                >
                  {artist ? "Withdraw" : "Leave waitlist"}
                </Button>
              )}
              <Link
                href={`/chat/${row.conversationId}`}
                className="inline-flex min-h-11 items-center underline px-3"
              >
                Message
              </Link>
            </div>
          </article>
        ))}
      </div>
      <SheetShell
        isOpen={offering !== null}
        onClose={() => setOffering(null)}
        title="Offer an available time"
        description="The client will review the estimate and pay a deposit before the session is confirmed."
      >
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (offering)
              offer.mutate({
                id: offering,
                startsAt: new Date(startsAt).toISOString(),
                durationMinutes: Number(duration),
                estimateCents: Math.round(Number(estimate) * 100),
                depositCents: Math.round(Number(deposit) * 100),
                expiresInHours: Number(expiry),
              });
          }}
        >
          <Label htmlFor="slot-start">
            Date and time (your device timezone)
          </Label>
          <Input
            id="slot-start"
            type="datetime-local"
            required
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
          />
          {[
            ["slot-duration", "Duration (minutes)", duration, setDuration],
            ["slot-estimate", "Estimate (AUD)", estimate, setEstimate],
            ["slot-deposit", "Deposit (AUD)", deposit, setDeposit],
            ["slot-expiry", "Offer valid for (hours, 1–72)", expiry, setExpiry],
          ].map(([id, label, value, setter]) => (
            <div key={id as string}>
              <Label htmlFor={id as string}>{label as string}</Label>
              <Input
                id={id as string}
                type="number"
                required
                min="1"
                step={
                  String(id).includes("estimate") ||
                  String(id).includes("deposit")
                    ? "0.01"
                    : "1"
                }
                value={value as string}
                onChange={e => (setter as (v: string) => void)(e.target.value)}
              />
            </div>
          ))}
          {offer.error && (
            <p role="alert" className="text-destructive">
              {offer.error.message}
            </p>
          )}
          <Button className="w-full min-h-12" disabled={offer.isPending}>
            Send offer
          </Button>
        </form>
      </SheetShell>
      {checkout && (
        <SessionPlanCheckoutSheet
          sessionPlanId={checkout.id}
          conversationId={checkout.conversationId}
          onClose={() => {
            setCheckout(null);
            refresh();
          }}
        />
      )}
    </main>
  );
}
