import { BookingComposer } from "./BookingComposer";
import { useRef, useState } from "react";
import { Link } from "wouter";
import { ImagePlus, Send, CalendarDays, ArrowLeft } from "lucide-react";
import { useChatController } from "@/features/chat/useChatController";
import { BookingWizardContent } from "@/features/booking/BookingWizardContent";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { trpc } from "@/lib/trpc";
import { SessionPlanCheckoutSheet } from "./Checkout";
import {
  bookingDate,
  money,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Status,
} from "../design/primitives";
import {
  mediaUrls,
  objectFromJson,
  messageText,
} from "../data/messagePresentation";

export function Thread({ id }: { id: number }) {
  const c = useChatController(id);
  const [booking, setBooking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.messages.list.invalidate({ conversationId: id });
    void utils.projects.summary.invalidate({ conversationId: id });
    void utils.appointments.getByConversation.invalidate(id);
  };
  return (
    <div className="v3-thread">
      <header className="v3-thread-header">
        <Link
          href="/conversations"
          className="v3-icon-button"
          aria-label="All conversations"
        >
          <ArrowLeft />
        </Link>
        <div>
          <h2>{c.otherUserName}</h2>
          <Link className="v3-muted" href={`/projects/${id}`}>
            Open booking
          </Link>
        </div>
        {c.isArtist && (
          <Action
            tone="secondary"
            onClick={() => {
              c.setSelectedProposal(null);
              setBooking(true);
            }}
          >
            <CalendarDays />
            Book
          </Action>
        )}
      </header>
      <div
        className="v3-messages"
        ref={c.viewportRef}
        onScroll={c.handleScroll}
        aria-label="Messages"
      >
        <Feedback
          loading={c.messagesLoading || c.convLoading}
          error={c.conversationError || c.messagesError}
          onRetry={() => {
            refresh();
            void utils.conversations.getById.invalidate(id);
          }}
        />
        {!c.messagesLoading &&
          !c.messagesError &&
          !c.conversationError &&
          !c.messages?.length && (
            <Feedback empty="Start the conversation here. Your booking details stay together with your messages." />
          )}
        {c.messages?.map(message => {
          const metadata = objectFromJson(message.metadata);
          const grid = objectFromJson(message.content);
          const urls = mediaUrls(grid);
          const own = message.senderId === c.user?.id;
          const text =
            message.messageType === "text"
              ? message.content
              : messageText(message.content);
          let body;
          if (
            metadata.type === "session_plan" ||
            message.messageType === "session_plan"
          )
            body = (
              <PlanMessage
                id={Number(metadata.sessionPlanId)}
                conversationId={id}
              />
            );
          else if (message.messageType === "studio_invite")
            body = (
              <InviteMessage metadata={metadata} own={own} onChange={refresh} />
            );
          else if (metadata.type === "project_proposal")
            body = (
              <Panel>
                <h3>Booking proposal</h3>
                <p>{statusLabel(metadata.status || "pending")}</p>
                <Action
                  onClick={() => {
                    c.handleViewProposal(message, metadata);
                    setBooking(true);
                  }}
                >
                  Review proposal
                </Action>
              </Panel>
            );
          else if (
            metadata.type === "payment_request" ||
            metadata.type === "reschedule_deposit"
          )
            body = (
              <Panel>
                <h3>
                  {metadata.type === "payment_request"
                    ? "Payment requested"
                    : "Rescheduled booking"}
                </h3>
                <p>{text}</p>
                <ActionLink
                  href={`/projects/${id}${metadata.bookingId || metadata.appointmentId ? `?session=${metadata.bookingId || metadata.appointmentId}` : ""}`}
                >
                  Review booking
                </ActionLink>
              </Panel>
            );
          else if (urls.length)
            body = (
              <div className="v3-message-images">
                {urls.map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={url}
                      alt={`${grid.label || "Reference"} ${i + 1}`}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            );
          else if (
            message.messageType === "image" &&
            /^https?:\/\//i.test(message.content)
          )
            body = (
              <a href={message.content} target="_blank" rel="noreferrer">
                <img
                  className="v3-message-image"
                  src={message.content}
                  alt="Shared photo"
                  loading="lazy"
                />
              </a>
            );
          else if (
            message.messageType === "balance_paid" ||
            message.messageType === "session_plan_accepted"
          )
            body = <Status tone="success">{text}</Status>;
          else
            body = (
              <p className="v3-message-text">
                {message.messageType === "image"
                  ? "This image is unavailable."
                  : text}
              </p>
            );
          return (
            <article
              className={`v3-message ${own ? "is-own" : ""}`}
              key={message.id}
            >
              <div>{body}</div>
              <time>{message.createdAt && bookingDate(message.createdAt)}</time>
            </article>
          );
        })}
      </div>
      <form
        className="v3-composer"
        onSubmit={e => {
          e.preventDefault();
          if (!c.sendMessageMutation.isPending) c.handleSendMessage();
        }}
      >
        <input
          hidden
          ref={file}
          type="file"
          accept="image/*"
          onChange={c.handleImageUpload}
        />
        <button
          type="button"
          className="v3-icon-button"
          aria-label="Attach photo"
          disabled={c.uploadingImage}
          onClick={() => file.current?.click()}
        >
          <ImagePlus />
        </button>
        <label className="sr-only" htmlFor={`message-${id}`}>
          Message
        </label>
        <textarea
          id={`message-${id}`}
          value={c.messageText}
          onChange={e => c.setMessageText(e.target.value)}
          placeholder="Write a message…"
          rows={1}
        />
        <Action
          type="submit"
          aria-label="Send message"
          disabled={!c.messageText.trim() || c.sendMessageMutation.isPending}
        >
          <Send />
        </Action>
      </form>
      {c.sendMessageMutation.error && (
        <p role="alert">Couldn’t send. Your message is still here—try again.</p>
      )}
      <SheetShell
        isOpen={!!c.confirmDialog}
        onClose={c.handleConfirmDialogCancel}
        title={c.confirmDialog?.title || "Confirm change"}
      >
        {c.confirmDialog && (
          <div className="v3-stack">
            <p>{c.confirmDialog.body}</p>
            <Action tone="danger" onClick={c.handleConfirmDialogAccept}>
              Confirm
            </Action>
            <Action tone="quiet" onClick={c.handleConfirmDialogCancel}>
              Go back
            </Action>
          </div>
        )}
      </SheetShell>
      <SheetShell
        isOpen={booking}
        onClose={() => setBooking(false)}
        title={c.selectedProposal ? "Review booking" : "New booking"}
      >
        <>
          {!c.selectedProposal ? (
            <BookingComposer
              conversationId={id}
              onSuccess={() => {
                refresh();
                setBooking(false);
              }}
            />
          ) : (
            <BookingWizardContent
              conversationId={id}
              artistServices={c.availableServices}
              artistSettings={c.artistSettings}
              isArtist={c.isArtist}
              artistId={c.conversation?.artistId}
              selectedProposal={c.selectedProposal}
              onClose={() => setBooking(false)}
              onBookingSuccess={() => {
                refresh();
                setBooking(false);
              }}
              onAcceptProposal={promotion =>
                c.handleClientAcceptProposal(
                  c.selectedProposal?.message,
                  promotion
                )
              }
              onCancelProposal={() =>
                c.selectedProposal &&
                c.handleCancelProposal(
                  c.selectedProposal.message,
                  c.selectedProposal.metadata
                )
              }
              onUpdateProposalState={metadata =>
                c.setSelectedProposal(
                  c.selectedProposal
                    ? { ...c.selectedProposal, metadata }
                    : null
                )
              }
            />
          )}
        </>
      </SheetShell>
    </div>
  );
}
function PlanMessage({
  id,
  conversationId,
}: {
  id: number;
  conversationId: number;
}) {
  const query = trpc.sessionPlans.getById.useQuery(
    { sessionPlanId: id },
    { enabled: id > 0 }
  );
  const [checkout, setCheckout] = useState(false);
  const [declining, setDeclining] = useState(false);
  const me = trpc.auth.me.useQuery();
  const decline = trpc.sessionPlans.decline.useMutation({
    onSuccess: () => {
      setDeclining(false);
      void query.refetch();
    },
  });
  const plan = query.data;
  return (
    <Panel>
      <h3>Session plan</h3>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {plan && (
        <>
          <Status tone={plan.status === "accepted" ? "success" : "neutral"}>
            {statusLabel(plan.status)}
          </Status>
          {plan.items.map(item => (
            <Row
              key={item.id}
              title={bookingDate(item.startsAt)}
              detail={`${item.durationMinutes} minutes`}
              trailing={<strong>{money(item.estimateCents)}</strong>}
            />
          ))}
          <p>Deposit {money(plan.depositTotalCents)}</p>
          {plan.status === "pending" && me.data?.id === plan.clientId && (
            <>
              <Action onClick={() => setCheckout(true)}>
                Review dates & pay deposit
              </Action>
              <Action tone="quiet" onClick={() => setDeclining(true)}>
                Decline plan
              </Action>
            </>
          )}
          {declining && (
            <div role="alert">
              <p>Decline these proposed dates?</p>
              <Action
                tone="danger"
                disabled={decline.isPending}
                onClick={() => decline.mutate({ sessionPlanId: id })}
              >
                Decline
              </Action>
              <Action tone="quiet" onClick={() => setDeclining(false)}>
                Keep plan
              </Action>
            </div>
          )}
          {decline.error && <p role="alert">{decline.error.message}</p>}
        </>
      )}
      {checkout && (
        <SessionPlanCheckoutSheet
          sessionPlanId={id}
          conversationId={conversationId}
          onClose={() => {
            setCheckout(false);
            void query.refetch();
          }}
        />
      )}
    </Panel>
  );
}
function InviteMessage({
  metadata,
  own,
  onChange,
}: {
  metadata: Record<string, any>;
  own: boolean;
  onChange: () => void;
}) {
  const mutation = trpc.studios.respondToInvite.useMutation({
    onSuccess: onChange,
  });
  return (
    <Panel>
      <h3>{metadata.studioName || "Studio invitation"}</h3>
      <Status>{statusLabel(metadata.status || "pending")}</Status>
      {!own &&
        metadata.status === "pending" &&
        Number(metadata.inviteId) > 0 && (
          <>
            <Action
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  inviteId: Number(metadata.inviteId),
                  response: "accept",
                })
              }
            >
              Join studio
            </Action>
            <Action
              tone="quiet"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  inviteId: Number(metadata.inviteId),
                  response: "decline",
                })
              }
            >
              Decline invitation
            </Action>
          </>
        )}
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </Panel>
  );
}
