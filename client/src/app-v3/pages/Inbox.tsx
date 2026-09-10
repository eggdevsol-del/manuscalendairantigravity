import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { MessageCircle } from "lucide-react";
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
  Tabs,
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
  const requests = useInboxRequests();
  useArtistReferral();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"Clients" | "Contacts">("Clients");
  const create = trpc.conversations.getOrCreate.useMutation({
    onSuccess: c => {
      if (c) go(`/chat/${c.id}`);
    },
  });
  const conversations = (query.data || []).filter(
    c =>
      (!isArtist || (tab === "Clients") === (c.otherUser?.role === "client")) &&
      `${c.otherUser?.name} ${messagePreview(c.lastMessage?.content, c.lastMessage?.messageType)}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const leads = requests.requestItems.filter(
    r =>
      tab === "Clients" &&
      `${r.name} ${r.subject}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Screen title="Inbox" wide>
      <div className={`v3-inbox ${selected ? "has-selection" : ""}`}>
        <section className="v3-inbox-list">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search conversations"
          />
          {isArtist && (
            <Tabs
              items={["Clients", "Contacts"] as const}
              value={tab}
              onChange={setTab}
              label="Inbox views"
            />
          )}
          <Feedback
            loading={query.isLoading || requests.isLoading}
            error={query.error || create.error}
            onRetry={() => query.refetch()}
          />
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
