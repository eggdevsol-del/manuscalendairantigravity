import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { getAssetUrl } from "@/lib/assets";
import {
  Action,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
export default function Lead() {
  const [, params] = useRoute("/lead/:id");
  const [, go] = useLocation();
  const id = Number(params?.id);
  const query = trpc.funnel.getLead.useQuery(
    { leadId: id },
    { enabled: Number.isSafeInteger(id) && id > 0, retry: false }
  );
  const [archive, setArchive] = useState(false);
  const utils = trpc.useUtils();
  const update = trpc.funnel.updateLeadStatus.useMutation({
    onSuccess: () => {
      void query.refetch();
      void utils.funnel.getLeads.invalidate();
      void utils.dashboard.invalidate();
      setArchive(false);
    },
  });
  const lead = query.data;
  async function openConversation() {
    if (!lead?.conversationId) return;
    if (lead.status === "new") {
      try {
        await update.mutateAsync({ leadId: lead.id, status: "contacted" });
      } catch {
        return;
      }
    }
    go(`/chat/${lead.conversationId}`);
  }
  return (
    <Screen
      title="Booking request"
      subtitle={lead?.clientName}
      back="/conversations"
      wide
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {lead && (
        <div className="v3-grid">
          <section className="v3-stack">
            <Row
              title={lead.clientName}
              icon={<Avatar name={lead.clientName} />}
              trailing={<Status>{lead.status.replaceAll("_", " ")}</Status>}
            />
            <Panel>
              <h2>{lead.projectType || "Their idea"}</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {lead.projectDescription || "No description supplied."}
              </p>
              <dl className="v3-facts">
                {[
                  ["Placement", lead.placement],
                  ["Size", lead.estimatedSize],
                  ["Styles", lead.stylePreferences.join(", ")],
                  ["Budget", lead.budgetLabel],
                  ["Timeframe", lead.preferredTimeframe],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </Panel>
            <Section title="References & placement">
              <div className="v3-file-grid">
                {[...lead.referenceImages, ...lead.bodyPlacementImages].map(
                  (url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={getAssetUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={getAssetUrl(url)}
                        alt={`Client reference ${index + 1}`}
                        loading="lazy"
                      />
                    </a>
                  )
                )}
              </div>
              {!lead.referenceImages.length &&
                !lead.bodyPlacementImages.length && (
                  <p className="v3-muted">No images supplied.</p>
                )}
            </Section>
          </section>
          <section className="v3-stack">
            <Panel>
              <h2>Next step</h2>
              {lead.conversationId ? (
                <>
                  <p>
                    Discuss the idea with your client, then send a booking plan
                    when the details are agreed.
                  </p>
                  <Action
                    disabled={update.isPending}
                    onClick={openConversation}
                  >
                    Open conversation
                  </Action>
                </>
              ) : (
                <p>
                  This older request has no linked conversation. Use the
                  supplied contact details to follow up.
                </p>
              )}
              <div className="v3-stack">
                <a
                  className="v3-action v3-action-secondary"
                  href={`mailto:${lead.clientEmail}?subject=${encodeURIComponent("Your tattoo booking request")}`}
                >
                  Email {lead.clientName}
                </a>
                {lead.clientPhone && (
                  <a
                    className="v3-action v3-action-secondary"
                    href={`tel:${lead.clientPhone}`}
                  >
                    Call {lead.clientPhone}
                  </a>
                )}
              </div>
            </Panel>
            {update.error && <p role="alert">{update.error.message}</p>}
            {lead.status !== "archived" && (
              <Action
                tone="quiet"
                disabled={update.isPending}
                onClick={() => setArchive(true)}
              >
                Archive request
              </Action>
            )}
          </section>
        </div>
      )}
      <SheetShell
        isOpen={archive}
        title="Archive this request?"
        onClose={() => {
          if (!update.isPending) setArchive(false);
        }}
      >
        <div className="v3-stack">
          <p>
            The request leaves the new-enquiry list. Existing conversations and
            bookings remain available.
          </p>
          {update.error && <p role="alert">{update.error.message}</p>}
          <Action
            disabled={update.isPending || !lead}
            onClick={() =>
              lead && update.mutate({ leadId: lead.id, status: "archived" })
            }
          >
            {update.isPending ? "Archiving…" : "Archive request"}
          </Action>
        </div>
      </SheetShell>
    </Screen>
  );
}
