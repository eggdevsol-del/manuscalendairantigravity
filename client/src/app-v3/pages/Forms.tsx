import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  Feedback,
  Panel,
  Row,
  Screen,
  SearchField,
  Section,
  Tabs,
} from "../design/primitives";
export default function Forms() {
  const [tab, setTab] = useState<"Procedure log" | "Medical" | "Consent">(
    "Procedure log"
  );
  const templates = trpc.forms.getTemplates.useQuery();
  const logs = trpc.forms.getProcedureLogs.useQuery(undefined, {
    enabled: tab === "Procedure log",
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const filtered =
    logs.data?.filter(log =>
      `${log.clientName} ${log.artistLicenceNumber} ${log.date}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) || [];
  const record = logs.data?.find(log => log.id === selected);
  return (
    <Screen
      title="Forms & procedure records"
      subtitle="Keep your paperwork close to the booking."
      back="/settings"
    >
      <Tabs
        label="Form sections"
        items={["Procedure log", "Medical", "Consent"] as const}
        value={tab}
        onChange={next => {
          setTab(next);
          setSelected(null);
        }}
      />
      {tab === "Procedure log" ? (
        <>
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search procedure records"
            placeholder="Client, date or licence"
          />
          <Feedback
            loading={logs.isLoading}
            error={logs.error}
            onRetry={() => logs.refetch()}
          />
          {!logs.isLoading && !logs.error && !filtered.length && (
            <Panel>
              <p>No matching procedure records.</p>
            </Panel>
          )}
          {record ? (
            <Section
              title={record.clientName}
              action={
                <Action tone="quiet" onClick={() => setSelected(null)}>
                  Back to records
                </Action>
              }
            >
              <Panel>
                <dl className="v3-facts">
                  <div>
                    <dt>Procedure date</dt>
                    <dd>{bookingDate(record.date)}</dd>
                  </div>
                  <div>
                    <dt>Artist licence</dt>
                    <dd>{record.artistLicenceNumber || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Amount paid</dt>
                    <dd>{money(record.amountPaid)}</dd>
                  </div>
                  <div>
                    <dt>Payment method</dt>
                    <dd>{record.paymentMethod}</dd>
                  </div>
                  <div>
                    <dt>Booking reference</dt>
                    <dd>{record.appointmentId}</dd>
                  </div>
                </dl>
                <p className="v3-muted">
                  Signed consent and medical forms are available in the client’s
                  booking workspace.
                </p>
              </Panel>
            </Section>
          ) : (
            filtered.map(log => (
              <Row
                key={log.id}
                title={log.clientName}
                detail={bookingDate(log.date)}
                trailing={<strong>{money(log.amountPaid)}</strong>}
                onClick={() => setSelected(log.id)}
              />
            ))
          )}
        </>
      ) : (
        <>
          <Feedback
            loading={templates.isLoading}
            error={templates.error}
            onRetry={() => templates.refetch()}
          />
          {templates.data && (
            <TemplateEditor
              key={tab}
              type={tab}
              initial={
                tab === "Medical"
                  ? templates.data.medicalTemplate
                  : templates.data.consentTemplate
              }
            />
          )}
        </>
      )}
    </Screen>
  );
}
function TemplateEditor({
  type,
  initial,
}: {
  type: "Medical" | "Consent";
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const utils = trpc.useUtils();
  const save = trpc.forms.updateTemplates.useMutation({
    onSuccess: () => void utils.forms.getTemplates.invalidate(),
  });
  return (
    <Section title={`${type} template`}>
      <p>
        Changes apply to forms created after saving. Forms already issued or
        signed keep their original wording.
      </p>
      {type === "Medical" && (
        <p className="v3-muted">
          Start each yes/no question with its number and a full stop, for
          example “1. Do you have any allergies?”. Clients answer every numbered
          question before signing.
        </p>
      )}
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          save.mutate(
            type === "Medical"
              ? { medicalTemplate: text }
              : { consentTemplate: text }
          );
        }}
      >
        <label>
          Template wording
          <textarea
            aria-label="Template wording"
            rows={18}
            required
            maxLength={50000}
            disabled={save.isPending}
            value={text}
            onChange={e => {
              save.reset();
              setText(e.target.value);
            }}
          />
        </label>
        {save.error && <p role="alert">{save.error.message}</p>}
        {save.isSuccess && <p role="status">Template saved for new forms.</p>}
        <Action type="submit" disabled={save.isPending || !text.trim()}>
          {save.isPending ? "Saving…" : "Save template"}
        </Action>
      </form>
    </Section>
  );
}
