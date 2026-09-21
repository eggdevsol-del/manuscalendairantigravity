import {
  scheduleGapDays,
  scheduleGapNote,
} from "../../../../shared/projectSchedule";
import { nextProjectSitting } from "../data/projectProgress";
import { DetailsSheet } from "../components/DetailsSheet";
import { EditBookingModal } from "@/components/modals/EditBookingModal";
import { ConversationContext } from "../design/ConversationContext";
import { DesignBrief } from "../design/DesignBrief";
import { BookingComposer } from "./BookingComposer";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ImagePlus,
  Send,
  CalendarDays,
  ArrowLeft,
  MoreHorizontal,
} from "lucide-react";
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
  Avatar,
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

export function Thread({
  id,
  initialDraft = "",
}: {
  id: number;
  initialDraft?: string;
}) {
  const c = useChatController(id);
  const project = trpc.projects.summary.useQuery(
    { conversationId: id },
    { enabled: id > 0 && c.user?.role !== "merchant" }
  );
  const next = nextProjectSitting(project.data?.sessions || []);
  const appliedDraft = useRef("");
  useEffect(() => {
    if (initialDraft && appliedDraft.current !== initialDraft) {
      appliedDraft.current = initialDraft;
      c.setMessageText(current =>
        current ? `${current}\n${initialDraft}` : initialDraft
      );
    }
  }, [initialDraft, c.setMessageText]);
  const [notesDraft, setNotesDraft] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [proposalError, setProposalError] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const declineLegacy = trpc.messages.declineProposal.useMutation({
    onSuccess: () => {
      refresh();
      c.setSelectedProposal(null);
      setBooking(false);
    },
  });
  async function editLegacyBooking() {
    if (loadingEdit) return;
    setLoadingEdit(true);
    setProposalError("");
    try {
      const rows = await utils.appointments.getByConversation.fetch(id);
      const meta = c.selectedProposal?.metadata;
      const ids = Array.isArray(meta?.appointmentIds)
        ? meta.appointmentIds
        : [meta?.appointmentId || meta?.id];
      const appointment = rows.find(row => ids.includes(row.id));
      if (!appointment) {
        setProposalError(
          "This proposal has no editable session. Revoke it and send a new proposal from Book."
        );
        return;
      }
      setBooking(false);
      setEditingAppointment(appointment);
    } catch (error) {
      setProposalError(
        error instanceof Error
          ? error.message
          : "Couldn’t load the booking. Try again."
      );
    } finally {
      setLoadingEdit(false);
    }
  }
  const sharedMedia = (c.messages || []).flatMap(message =>
    mediaUrls(objectFromJson(message.content))
  );
  const file = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.messages.list.invalidate({ conversationId: id });
    void utils.projects.summary.invalidate({ conversationId: id });
    void utils.appointments.getByConversation.invalidate(id);
  };
  return (
    <div
      className={`v3-thread-layout ${c.isArtist && c.conversation?.clientId ? "with-context" : ""}`}
    >
      <div className="v3-thread">
        <header className="v3-thread-header">
          <Link
            href="/conversations"
            className="v3-icon-button"
            aria-label="All conversations"
          >
            <ArrowLeft />
          </Link>
          <Avatar name={c.otherUserName} />
          <div className="simple-thread-person">
            <h2>{c.otherUserName}</h2>
            {c.user?.role !== "merchant" && (
              <Link className="v3-muted" href={`/projects/${id}`}>
                {next?.projectName || "Tattoo project"}
              </Link>
            )}
          </div>
          <button
            className="v3-icon-button"
            aria-label="Conversation tools"
            onClick={() => setContextOpen(true)}
          >
            <MoreHorizontal />
          </button>
        </header>
        {next && (
          <Link
            className="simple-pin"
            href={`/projects/${id}?session=${next.id}`}
          >
            <CalendarDays size={20} />
            <span>
              <strong>{bookingDate(next.startsAt, next.timeZone)}</strong>
              <small>
                Sitting {next.sessionIndex || 1} · {statusLabel(next.status)} ·{" "}
                {money(next.remainingCents)} remaining
              </small>
            </span>
          </Link>
        )}
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
          <div className="v3-message-stream">
            {c.hasOlderMessages && (
              <Action
                tone="quiet"
                disabled={c.loadingOlderMessages}
                onClick={() => {
                  c.setScrollIntent("USER_READING_HISTORY");
                  void c.loadOlderMessages();
                }}
              >
                {c.loadingOlderMessages
                  ? "Loading older messages…"
                  : "Load older messages"}
              </Action>
            )}
            {c.olderMessagesError && <p role="alert">{c.olderMessagesError}</p>}
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
                  <InviteMessage
                    metadata={metadata}
                    own={own}
                    onChange={refresh}
                  />
                );
              else if (metadata.type === "project_proposal")
                body = (
                  <LegacyBookingMessage
                    conversationId={id}
                    metadata={metadata}
                    onReview={() => {
                      c.handleViewProposal(message, metadata);
                      setBooking(true);
                    }}
                  />
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
                  data-message-id={message.id}
                  key={message.id}
                >
                  <div>{body}</div>
                  <time>
                    {message.createdAt && bookingDate(message.createdAt)}
                  </time>
                </article>
              );
            })}
          </div>
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
          <p role="alert">
            {c.sendMessageMutation.variables?.messageType === "image"
              ? "Couldn’t send the photo. Attach it again to retry."
              : "Couldn’t send. Your message is still here—try again."}
          </p>
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
            {(proposalError || declineLegacy.error) && (
              <p role="alert">
                {proposalError || declineLegacy.error?.message}
              </p>
            )}
            {loadingEdit && <p role="status">Loading booking…</p>}
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
                onRejectProposal={() =>
                  c.selectedProposal &&
                  declineLegacy.mutate({
                    messageId: c.selectedProposal.message.id,
                  })
                }
                onEditBooking={() => void editLegacyBooking()}
                isPendingProposalAction={declineLegacy.isPending || loadingEdit}
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
      {editingAppointment && (
        <EditBookingModal
          key={editingAppointment.id}
          isOpen
          onClose={() => setEditingAppointment(null)}
          appointment={editingAppointment}
          client={c.conversation?.otherUser}
          onSuccess={() => {
            setEditingAppointment(null);
            refresh();
          }}
        />
      )}
      {c.isArtist && c.conversation?.clientId && (
        <ConversationContext
          id={id}
          clientId={c.conversation.clientId}
          draft={notesDraft}
          onDraftChange={setNotesDraft}
          media={sharedMedia}
        />
      )}
      <SheetShell
        isOpen={contextOpen}
        onClose={() => setContextOpen(false)}
        title="Conversation tools"
        headerAction={
          c.isArtist ? (
            <Action
              tone="secondary"
              onClick={() => {
                setContextOpen(false);
                c.setSelectedProposal(null);
                setBooking(true);
              }}
            >
              <CalendarDays />
              New booking
            </Action>
          ) : undefined
        }
      >
        <div className="v3-stack">
          {c.isArtist && <DesignBrief key={id} conversationId={id} inline />}
        </div>
        {contextOpen && c.isArtist && c.conversation?.clientId && (
          <div className="v3-context-sheet">
            <ConversationContext
              id={id}
              clientId={c.conversation.clientId}
              draft={notesDraft}
              onDraftChange={setNotesDraft}
              media={sharedMedia}
            />
          </div>
        )}
      </SheetShell>
    </div>
  );
}
function LegacyBookingMessage({
  conversationId,
  metadata,
  onReview,
}: {
  conversationId: number;
  metadata: Record<string, any>;
  onReview: () => void;
}) {
  const query = trpc.projects.summary.useQuery({ conversationId });
  const ids = Array.isArray(metadata.appointmentIds)
    ? metadata.appointmentIds
    : [metadata.appointmentId || metadata.bookingId || metadata.id];
  const sessions = (query.data?.sessions || []).filter(s =>
    ids.map(Number).includes(s.id)
  );
  const booked = sessions.some(s =>
    ["confirmed", "completed", "cancelled", "no-show"].includes(s.status)
  );
  return (
    <section
      className="v3-booking-message"
      aria-label={booked ? "Tattoo booking" : "Booking proposal"}
    >
      <header className="v3-booking-message-heading">
        <span className="v3-booking-message-icon">
          <CalendarDays size={24} />
        </span>
        <div>
          <small>{booked ? "Tattoo booking" : "Booking proposal"}</small>
          <h3>
            {sessions.find(s => s.projectName)?.projectName ||
              metadata.serviceName ||
              "Tattoo sittings"}
          </h3>
        </div>
      </header>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data?.location && (
        <p className="v3-muted">{query.data.location}</p>
      )}
      <ol className="v3-booking-message-dates" aria-label="Sitting dates">
        {sessions.map((s, index) => (
          <li key={s.id}>
            <span className="v3-booking-message-marker">
              {s.sessionIndex || index + 1}
            </span>
            <div>
              <strong>{bookingDate(s.startsAt, s.timeZone)}</strong>
              <span>
                {statusLabel(s.status)}
                {s.rescheduled ? " · Rescheduled" : ""} ·{" "}
                {Math.round(
                  (+new Date(s.endsAt) - +new Date(s.startsAt)) / 60000
                )}{" "}
                min
              </span>
              <span>
                {money(s.estimateCents)} estimate · {money(s.paidCents)} paid ·{" "}
                {money(s.remainingCents)} remaining
              </span>
            </div>
          </li>
        ))}
        {!sessions.length &&
          Array.isArray(metadata.dates) &&
          metadata.dates
            .filter((d: unknown) => typeof d === "string")
            .map((date: string, index: number) => (
              <li key={`${date}-${index}`}>
                <span className="v3-booking-message-marker">{index + 1}</span>
                <div>
                  <strong>{bookingDate(date)}</strong>
                  <span>
                    Originally proposed
                    {typeof metadata.serviceDuration === "number"
                      ? ` · ${metadata.serviceDuration} min`
                      : ""}
                  </span>
                </div>
              </li>
            ))}
      </ol>
      {!sessions.length && (
        <Status>{statusLabel(metadata.status || "pending")}</Status>
      )}
      {sessions.length > 0 ? (
        <dl className="v3-booking-message-totals">
          <div>
            <dt>Estimate</dt>
            <dd>
              {money(sessions.reduce((sum, s) => sum + s.estimateCents, 0))}
            </dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>{money(sessions.reduce((sum, s) => sum + s.paidCents, 0))}</dd>
          </div>
          <div>
            <dt>Remaining balance</dt>
            <dd>
              {money(sessions.reduce((sum, s) => sum + s.remainingCents, 0))}
            </dd>
          </div>
        </dl>
      ) : (
        <dl className="v3-booking-message-totals">
          {typeof metadata.totalCost === "number" && (
            <div>
              <dt>Proposed estimate</dt>
              <dd>{money(Math.round(metadata.totalCost * 100))}</dd>
            </div>
          )}
          {typeof metadata.depositAmount === "number" && (
            <div>
              <dt>Proposed deposit</dt>
              <dd>{money(Math.round(metadata.depositAmount * 100))}</dd>
            </div>
          )}
        </dl>
      )}
      {!booked &&
        !["declined", "withdrawn", "cancelled", "accepted"].includes(
          metadata.status
        ) && (
          <div className="simple-actions">
            <Action onClick={onReview}>Review proposal</Action>
          </div>
        )}
    </section>
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
  const summary = trpc.projects.summary.useQuery(
    { conversationId },
    { enabled: conversationId > 0 }
  );
  const plan = query.data;
  const scheduling = objectFromJson(plan?.message?.metadata).scheduling;
  const gap = (previous: string, next: string) =>
    scheduling?.frequency === "consecutive"
      ? scheduleGapDays(previous, next, scheduling.timeZone || "UTC")
      : 0;
  const sessions = (summary.data?.sessions || []).filter(
    s =>
      s.sessionPlanId === id || plan?.items.some(i => i.appointmentId === s.id)
  );
  const booked = !!sessions.length || plan?.status === "accepted";
  return (
    <>
      <section
        className="v3-booking-message"
        aria-label={booked ? "Tattoo booking" : "Booking proposal"}
      >
        <header className="v3-booking-message-heading">
          <span className="v3-booking-message-icon">
            <CalendarDays size={24} />
          </span>
          <div>
            <small>{booked ? "Your tattoo booking" : "Booking proposal"}</small>
            <h3>
              {sessions.find(s => s.projectName)?.projectName ||
                plan?.projectName ||
                "Tattoo sittings"}
            </h3>
          </div>
        </header>
        <Feedback
          loading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        />
        {plan && (
          <>
            <div className="simple-between">
              <span>{plan.artist?.name || "Your artist"}</span>
              <Status tone={booked ? "success" : "neutral"}>
                {sessions.length &&
                sessions.every(s => s.status === sessions[0].status)
                  ? statusLabel(sessions[0].status)
                  : sessions.length
                    ? "See sitting statuses"
                    : statusLabel(plan.status)}
              </Status>
            </div>
            {summary.data?.location && (
              <p className="v3-muted">{summary.data.location}</p>
            )}
            <Feedback error={summary.error} onRetry={() => summary.refetch()} />
            {scheduling?.completedBy && (
              <p className="v3-muted">
                Complete by{" "}
                {new Date(scheduling.completedBy).toLocaleDateString("en-AU", {
                  timeZone: scheduling.timeZone || "UTC",
                })}
              </p>
            )}
            <ol className="v3-booking-message-dates" aria-label="Sitting dates">
              {sessions.length
                ? sessions.map((s, index) => (
                    <li key={s.id}>
                      <span className="v3-booking-message-marker">
                        {s.sessionIndex || index + 1}
                      </span>
                      <div>
                        <strong>{bookingDate(s.startsAt, s.timeZone)}</strong>
                        <span>
                          {statusLabel(s.status)}
                          {s.rescheduled ? " · Rescheduled" : ""} ·{" "}
                          {Math.round(
                            (+new Date(s.endsAt) - +new Date(s.startsAt)) /
                              60000
                          )}{" "}
                          min
                        </span>
                        <span>
                          {money(s.estimateCents)} estimate ·{" "}
                          {money(s.paidCents)} paid · {money(s.remainingCents)}{" "}
                          remaining
                        </span>
                      </div>
                    </li>
                  ))
                : plan.items.map((item, index) => (
                    <li key={item.id}>
                      <span className="v3-booking-message-marker">
                        {item.sessionIndex}
                      </span>
                      <div>
                        {index > 0 &&
                          gap(plan.items[index - 1].startsAt, item.startsAt) >
                            0 && (
                            <small className="v3-schedule-gap">
                              {scheduling?.completedBy &&
                              scheduling?.autoScheduled
                                ? scheduleGapNote(
                                    gap(
                                      plan.items[index - 1].startsAt,
                                      item.startsAt
                                    )
                                  )
                                : `Schedule gap · ${gap(plan.items[index - 1].startsAt, item.startsAt)} days between sittings.`}
                            </small>
                          )}
                        <strong>
                          {bookingDate(item.startsAt, scheduling?.timeZone)}
                        </strong>
                        <span>
                          {item.durationMinutes} min ·{" "}
                          {money(item.estimateCents)} estimate
                        </span>
                        <span>{money(item.depositCents)} deposit</span>
                        {booked && (
                          <span>
                            Original proposed date · current sitting details{" "}
                            {summary.isLoading ? "loading" : "unavailable"}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
            </ol>
            {!plan.items.length && !sessions.length && (
              <p>Dates to be arranged</p>
            )}
            <dl className="v3-booking-message-totals">
              <div>
                <dt>
                  {sessions.length ? "Sittings estimate" : "Project estimate"}
                </dt>
                <dd>
                  {money(
                    sessions.length
                      ? sessions.reduce((sum, s) => sum + s.estimateCents, 0)
                      : plan.totalEstimateCents
                  )}
                </dd>
              </div>
              <div>
                <dt>{plan.depositRecorded ? "Deposit recorded" : "Deposit"}</dt>
                <dd>{money(plan.depositTotalCents)}</dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd>{money(plan.platformFeeCents || 0)}</dd>
              </div>
              {sessions.length > 0 && (
                <div>
                  <dt>Remaining balance</dt>
                  <dd>
                    {money(
                      sessions.reduce((sum, s) => sum + s.remainingCents, 0)
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {(plan.requiresDeposit ?? plan.status === "pending") &&
              me.data?.id === plan.clientId &&
              !booked && (
                <div className="simple-actions">
                  <Action onClick={() => setCheckout(true)}>
                    Review & pay deposit
                  </Action>
                  <Action tone="quiet" onClick={() => setDeclining(true)}>
                    Decline plan
                  </Action>
                </div>
              )}
            {declining && (
              <div role="alert" className="simple-actions">
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
      </section>
      {checkout && (
        <SessionPlanCheckoutSheet
          sessionPlanId={id}
          conversationId={conversationId}
          onClose={() => {
            setCheckout(false);
            void query.refetch();
            void summary.refetch();
          }}
        />
      )}
    </>
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
