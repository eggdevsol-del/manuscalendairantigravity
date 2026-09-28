import { activateWaitingSWForPublicPage } from "@/lib/pwa";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Action, ActionLink, Feedback, Panel, Screen, Section, Status } from "../design/primitives";
export default function ClientPortal() {
  useEffect(() => { void activateWaitingSWForPublicPage(); }, []);
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get("access") || sessionStorage.getItem("tattoi-portal-access") || "");
  useEffect(() => { if (token) { sessionStorage.setItem("tattoi-portal-access", token); history.replaceState(null, "", location.pathname); } }, [token]);
  const query = trpc.clientPortal.view.useMutation();
  const messages = trpc.clientPortal.messages.useMutation();
  const [text, setText] = useState("");
  const reply = trpc.clientPortal.reply.useMutation({ onSuccess: () => { setText(""); messages.mutate({ token }); } });
  useEffect(() => { if (token) query.mutate({ token }); }, [token]);
  return <Screen title="Your tattoo" subtitle={query.data?.artist?.name ? `With ${query.data.artist.name}` : "Your private booking page"}>
    {!token && <Panel><h2>Open your private link</h2><p>Use the link your artist sent you. Links expire after 24 hours.</p></Panel>}
    <Feedback loading={query.isPending && !!token} error={query.error} onRetry={() => query.mutate({ token })} />
    {query.data && <>
      <Section title="Needs your attention">{query.data.payments.length ? query.data.payments.map(p => <Panel key={p.id}><h3>{query.data.sittings.find(s => s.id === p.appointmentId)?.projectName || "Sitting payment"}</h3><p>{(p.amountCents / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })} requested</p><ActionLink href={`/pay/${encodeURIComponent(p.token)}`}>Review payment</ActionLink><small>Review applicable fees and terms before paying.</small></Panel>) : <p>No outstanding payment requests.</p>}</Section>
      <Section title="Your sittings">{query.data.sittings.length ? query.data.sittings.map(s => <Panel key={s.id}><h3>{s.projectName || s.title}</h3><p>{s.startTime.replace("T", " ")} · {s.timeZone}</p><Status>{s.status}</Status><p>{s.paymentStatus?.replaceAll("_", " ")}</p></Panel>) : <p>Your artist has not booked a sitting yet.</p>}</Section>
      <Section title="Message your artist">
        <Action disabled={messages.isPending} onClick={() => messages.mutate({ token })}>{messages.data ? "Refresh conversation" : "Open conversation"}</Action>
        <Feedback error={messages.error} onRetry={() => messages.mutate({ token })} />
        {messages.data?.map(m => <Panel key={m.id}><small>{m.mine ? "You" : query.data?.artist?.name}</small><p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p></Panel>)}
        <form className="v3-form" onSubmit={e => { e.preventDefault(); reply.mutate({ token, text }); }}><label>Your message<textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} required /></label><Action type="submit" disabled={reply.isPending || !text.trim()}>{reply.isPending ? "Sending…" : "Send message"}</Action></form>
        {reply.error && <p role="alert">{reply.error.message}</p>}
        {reply.isSuccess && <p role="status">Message sent.</p>}
      </Section>
      <Action onClick={() => query.mutate({ token })}>Refresh details</Action>
      <p className="v3-muted">Private link · Do not forward. No download or registration required.</p>
    </>}
  </Screen>;
}
