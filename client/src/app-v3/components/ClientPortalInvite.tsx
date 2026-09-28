import { CLIENT_PORTAL_ENTRY } from "@shared/clientPortalRoute";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Action, Panel } from "../design/primitives";
export function ClientPortalInvite({ clientId, phone }: { clientId: string; phone?: string | null }) {
  const create = trpc.clientPortal.createLink.useMutation();
  const [copied, setCopied] = useState(false);
  const url = create.data ? `${location.origin}${CLIENT_PORTAL_ENTRY}#access=${encodeURIComponent(create.data.token)}` : "";
  return <Panel><h3>Private client portal · Pilot</h3><p>Bookings and payment requests, without registration. The private link lasts 24 hours.</p>
    <Action disabled={create.isPending} onClick={() => { setCopied(false); create.mutate({ clientId }); }}>Create test link</Action>
    {create.error && <p role="alert">{create.error.message}</p>}
    {url && <><a href={url} target="_blank" rel="noreferrer">Open client portal</a><Action onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy private link"}</Action>
      {phone && <a href={`sms:${phone.replace(/[^+0-9]/g, "")}?body=${encodeURIComponent(`Your tattoo details and payment requests: ${url}`)}`}>Prepare SMS</a>}
      <p>Prepare SMS opens your messaging app for review; nothing is sent automatically.</p></>}
  </Panel>;
}
