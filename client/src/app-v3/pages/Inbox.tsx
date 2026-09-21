import { bookingDate } from "@/features/workspace/bookingPresentation";
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { MessageCircle, Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useInboxRequests } from "@/features/chat/hooks/useInboxRequests";
import { useArtistReferral } from "@/features/chat/useArtistReferral";
import { trpc } from "@/lib/trpc";
import {
  Avatar,
  Feedback,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
} from "../design/primitives";
import { messagePreview } from "../data/messagePresentation";
import { Thread } from "./Thread";

export default function Inbox() {
  const [, params] = useRoute("/chat/:id");
  const selected = Number(params?.id) || null;
  const [, go] = useLocation();
  const { user } = useAuth();
  const isArtist = user?.role === "artist" || user?.role === "admin";
  const query = useConversations();
  const day = trpc.dashboard.getArtistOverview.useQuery(
    { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { enabled: isArtist }
  );
  const next = day.data?.nextAppointment;
  const requests = useInboxRequests();
  useArtistReferral();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"All" | "Unread" | "Enquiries" | "Contacts">(
    "All"
  );
  const create = trpc.conversations.getOrCreate.useMutation({
    onSuccess: c => {
      if (c) go(`/chat/${c.id}`);
    },
  });
  const conversations = (query.data || []).filter(
    c =>
      tab !== "Enquiries" &&
      (tab !== "Unread" || (c.unreadCount || 0) > 0) &&
      (!isArtist || tab !== "Contacts" || c.otherUser?.role !== "client") &&
      `${c.otherUser?.name} ${messagePreview(c.lastMessage?.content, c.lastMessage?.messageType)}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const leads = requests.requestItems.filter(
    r =>
      (tab === "All" || tab === "Enquiries") &&
      `${r.name} ${r.subject}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Screen
      title="Messages"
      wide
      action={
        isArtist ? (
          <button
            className="v3-icon-button"
            aria-label="Contacts"
            onClick={() => setTab(tab === "Contacts" ? "All" : "Contacts")}
          >
            <Plus />
          </button>
        ) : (
          <Link
            className="v3-icon-button"
            href="/discover"
            aria-label="Find an artist"
          >
            <Plus />
          </Link>
        )
      }
    >
      <div className={`v3-inbox ${selected ? "has-selection" : ""}`}>
        <section className="v3-inbox-list">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search conversations"
          />
          <div className="simple-inbox-filters" aria-label="Inbox views">
            {(["All", "Unread", "Enquiries"] as const).map(view => (
              <button
                key={view}
                aria-pressed={tab === view}
                onClick={() => setTab(view)}
              >
                {view}
              </button>
            ))}
            {tab === "Contacts" && (
              <button aria-pressed="true" onClick={() => setTab("Contacts")}>
                Contacts
              </button>
            )}
          </div>
          <Feedback
            loading={query.isLoading || requests.isLoading}
            error={query.error || requests.error || create.error}
            onRetry={() => {
              create.reset();
              void query.refetch();
              void requests.refetch();
            }}
          />
          {isArtist && next && tab === "All" && !search && (
            <Link
              className="simple-pin"
              href={
                next.conversationId
                  ? `/projects/${next.conversationId}?session=${next.id}`
                  : `/calendar?appointment=${next.id}`
              }
            >
              <span>
                <strong>{next.client?.name || next.title}</strong>
                <small>{bookingDate(next.startTime)} · Next sitting</small>
              </span>
            </Link>
          )}
          {leads.length > 0 && (
            <Section title="New requests">
              {leads.map(r => (
                <Row
                  key={`${r.type}-${r.id}`}
                  title={r.name}
                  detail={r.subject}
                  trailing={<Status tone="warning">New</Status>}
                  onClick={() => {
                    if (r.leadId) go(`/lead/${r.leadId}`);
                    else if (r.data?.conversationId)
                      go(
                        `/chat/${r.data.conversationId}?consultationId=${r.id}`
                      );
                    else if (r.data?.clientId && user)
                      create.mutate({
                        artistId: user.id,
                        clientId: r.data.clientId,
                      });
                  }}
                />
              ))}
            </Section>
          )}
          {conversations.map(c => (
            <Row
              key={c.id}
              title={c.otherUser?.name || "Conversation"}
              detail={messagePreview(
                c.lastMessage?.content,
                c.lastMessage?.messageType
              )}
              icon={
                <Avatar name={c.otherUser?.name} src={c.otherUser?.avatar} />
              }
              href={`/chat/${c.id}`}
              trailing={
                (c.unreadCount || 0) > 0 ? (
                  <Status>{c.unreadCount! > 9 ? "9+" : c.unreadCount}</Status>
                ) : undefined
              }
            />
          ))}
          {!query.isLoading &&
            !query.error &&
            !requests.error &&
            !requests.isLoading &&
            !leads.length &&
            !conversations.length && (
              <Feedback
                empty={
                  search
                    ? "No conversations match your search."
                    : "Your conversations will appear here."
                }
              />
            )}
        </section>
        <section className="v3-inbox-thread" aria-label="Conversation">
          {selected ? (
            <Thread key={selected} id={selected} />
          ) : (
            <div className="v3-thread-empty">
              <MessageCircle size={32} />
              <h2>Your conversations, in context</h2>
              <p>Select a conversation to see messages and open its booking.</p>
            </div>
          )}
        </section>
      </div>
    </Screen>
  );
}
