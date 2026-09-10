import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui";
import {
  CalendarDays,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { BalanceCheckoutSheet } from "./BalanceCheckoutSheet";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
export function UpcomingTab() {
  const query = trpc.appointments.getClientBookings.useQuery({
    tab: "upcoming",
  });
  const [payId, setPayId] = useState<number | null>(null);
  const appointments = query.data?.appointments || [];
  const selected = appointments.find(a => a.id === payId);
  if (query.isLoading)
    return (
      <p className="workspace-card" role="status">
        Loading your appointments…
      </p>
    );
  if (query.error)
    return (
      <div className="workspace-card" role="alert">
        <p>We couldn’t load your bookings.</p>
        <Button onClick={() => query.refetch()}>Try again</Button>
      </div>
    );
  return (
    <div className="space-y-5">
      {appointments.map(a => (
        <article className="workspace-card space-y-4" key={a.id}>
          <div>
            <span
              className="workspace-status mb-3"
              data-tone={a.status === "confirmed" ? "success" : undefined}
            >
              {statusLabel(a.status)}
            </span>
            <h3 className="text-xl font-semibold tracking-tight">
              {a.projectName || a.title}
            </h3>
            <p className="workspace-subtitle">
              {a.artist.name}
              {a.sessionIndex && a.sessionTotal
                ? ` · Session ${a.sessionIndex} of ${a.sessionTotal}`
                : ""}
            </p>
          </div>
          <p className="flex gap-3 items-center text-sm">
            <CalendarDays size={18} />
            {bookingDate(a.startsAt)}
          </p>
          {a.studioName && (
            <p className="text-sm text-muted-foreground">{a.studioName}</p>
          )}
          {a.depositPaidCents > 0 && (
            <span className="workspace-status" data-tone="success">
              <CheckCircle2 size={14} />
              {money(a.depositPaidCents)} deposit paid
            </span>
          )}
          {a.paymentRequest && a.balanceDueCents > 0 && (
            <div className="rounded-xl p-4 bg-accent">
              <h4 className="font-semibold">
                Your artist has requested payment
              </h4>
              <Button className="w-full mt-3" onClick={() => setPayId(a.id)}>
                Review {money(a.balanceDueCents)} balance
              </Button>
            </div>
          )}
          {a.conversationId && (
            <>
              <Link
                href={`/projects/${a.conversationId}?session=${a.id}`}
                className="workspace-link w-full"
              >
                Manage booking <ArrowRight size={17} />
              </Link>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/chat/${a.conversationId}`}>
                  <MessageCircle />
                  Message {a.artist.name}
                </Link>
              </Button>
            </>
          )}
        </article>
      ))}
      {query.data?.pendingConsults?.map(c => (
        <div key={c.id} className="workspace-card">
          <h3 className="font-semibold">Request with {c.artistName}</h3>
          <p className="workspace-subtitle">
            Your request has been received. Your artist will reply in Messages.
          </p>
          <Link className="workspace-link" href="/conversations">
            View messages <ArrowRight size={16} />
          </Link>
        </div>
      ))}
      {!appointments.length && !query.data?.pendingConsults?.length && (
        <div className="workspace-card">
          <h3 className="font-semibold">Your appointments will appear here</h3>
          <p className="workspace-subtitle">
            If you’ve sent a request, check Messages for your artist’s reply.
            You can start a new request from your artist’s booking link.
          </p>
          <Link className="workspace-link" href="/conversations">
            Open messages <ArrowRight size={16} />
          </Link>
        </div>
      )}
      {selected && (
        <BalanceCheckoutSheet
          open
          onClose={() => {
            setPayId(null);
            void query.refetch();
          }}
          appointmentId={selected.id}
          balanceDueCents={selected.balanceDueCents}
          artistName={selected.artist.name}
          projectName={selected.projectName || selected.title}
        />
      )}
    </div>
  );
}
