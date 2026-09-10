import { useState } from "react";
import Papa from "papaparse";
import { trpc } from "@/lib/trpc";
import {
  Action,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
import type { ImportInput, ImportResult, ImportRow } from "@shared/importData";
const fields = [
  "name",
  "email",
  "phone",
  "date",
  "startTime",
  "endTime",
  "serviceName",
  "price",
] as const;
const labels = {
  name: "Client name",
  email: "Email",
  phone: "Phone",
  date: "Date",
  startTime: "Start time",
  endTime: "End time",
  serviceName: "Service",
  price: "Price (AUD)",
};
export default function DataImport() {
  const [mode, setMode] = useState<"clients" | "appointments">("clients");
  const [rows, setRows] = useState<Record<string, string>[]>([]),
    [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}),
    [serviceMap, setServiceMap] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState<ImportInput | null>(null),
    [results, setResults] = useState<ImportResult[]>([]),
    [error, setError] = useState("");
  const [fileName, setFileName] = useState(""),
    [calendarUrl, setCalendarUrl] = useState("");
  const settings = trpc.artistSettings.get.useQuery();
  const utils = trpc.useUtils();
  const preview = trpc.dataImport.preview.useMutation({
    onSuccess: setResults,
    onError: e => setError(e.message),
  });
  const commit = trpc.dataImport.commit.useMutation({
    onSuccess: data => {
      setResults(previous =>
        previous.map(old => {
          const updated = data.rows.find(r => r.sourceRow === old.sourceRow);
          return updated ? { ...updated, index: old.index } : old;
        })
      );
      void utils.conversations.invalidate();
      void utils.appointments.invalidate();
    },
    onError: e => setError(e.message),
  });
  const calendar = trpc.artistSettings.upsert.useMutation({
    onError: e => setError(e.message),
  });
  let services: { id: string; name: string }[] = [];
  try {
    services = JSON.parse(settings.data?.services || "[]");
  } catch {}
  const busy = preview.isPending || commit.isPending;
  const invalidate = () => {
    setPayload(null);
    setResults([]);
    setError("");
  };
  const read = (file?: File) => {
    if (!file) return;
    invalidate();
    setRows([]);
    setHeaders([]);
    setMapping({});
    setServiceMap({});
    if (file.size > 5 * 1024 * 1024) {
      setError("Use a CSV smaller than 5 MB.");
      return;
    }
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: ({ data, meta, errors }) => {
        if (errors.length) {
          setError(errors[0].message);
          return;
        }
        if (data.length > 500) {
          setError(
            "Import up to 500 rows at a time. Split this file into smaller files."
          );
          return;
        }
        setRows(data);
        setHeaders(meta.fields || []);
        const guess: Record<string, string> = {};
        for (const field of fields) {
          const candidates = {
            name: ["client name", "full name", "name"],
            email: ["email", "email address"],
            phone: ["phone", "mobile", "phone number"],
            date: ["date", "appointment date"],
            startTime: ["start time", "time", "start"],
            endTime: ["end time", "end"],
            serviceName: ["service", "treatment", "service name"],
            price: ["price", "cost", "amount"],
          }[field];
          guess[field] =
            (meta.fields || []).find(h =>
              candidates.includes(h.toLowerCase().trim())
            ) || "";
        }
        setMapping(guess);
      },
      error: e => setError(e.message),
    });
  };
  const getPayload = (): ImportInput => ({
    mode,
    serviceMap,
    rows: rows.map((row, index) => {
      const text = (key: string) => (row[mapping[key]] || "").trim();
      const raw = text("price").replace(/[$,]/g, "");
      if (raw && !Number.isFinite(Number(raw)))
        throw new Error(
          "A price is not a valid number. Check the Price column mapping."
        );
      return {
        sourceRow: index + 2,
        name: text("name"),
        email: text("email"),
        phone: text("phone"),
        date: text("date"),
        startTime: text("startTime"),
        endTime: text("endTime"),
        serviceName: text("serviceName"),
        price: raw ? Number(raw) : undefined,
      };
    }),
  });
  const review = () => {
    setError("");
    try {
      const p = getPayload();
      setPayload(p);
      preview.mutate(p);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const importReady = () => {
    if (!payload) return;
    const selected = results
      .filter(r => ["new", "matched", "failed"].includes(r.status))
      .map(r => payload.rows[r.index]);
    const next = { ...payload, rows: selected };
    commit.mutate(next);
  };
  const eligible = results.filter(r =>
    ["new", "matched", "failed"].includes(r.status)
  ).length;
  const serviceNames = Array.from(
    new Set(
      rows.map(r => (r[mapping.serviceName] || "").trim()).filter(Boolean)
    )
  );
  return (
    <Screen
      title="Import your data"
      subtitle="Review matches and duplicates before adding anything."
      back="/settings"
    >
      <Feedback
        loading={settings.isLoading}
        error={settings.error}
        onRetry={() => settings.refetch()}
      />
      <Section title="Choose your file">
        <form className="v3-form" onSubmit={e => e.preventDefault()}>
          <fieldset disabled={busy}>
            <label>
              What are you importing?
              <select
                aria-label="What are you importing?"
                value={mode}
                onChange={e => {
                  setMode(e.target.value as typeof mode);
                  invalidate();
                }}
              >
                <option value="clients">Clients</option>
                <option value="appointments">Appointments</option>
              </select>
            </label>
            <label>
              CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={e => read(e.target.files?.[0])}
              />
              <small>Up to 500 rows and 5 MB.</small>
            </label>
            {fileName && (
              <p>
                {fileName} · {rows.length} rows
              </p>
            )}
          </fieldset>
        </form>
        <p className="v3-muted">
          Each client needs an email or phone. Use YYYY-MM-DD or DD/MM/YYYY
          dates and HH:mm or h:mm AM/PM times. Appointment imports use
          Australia/Brisbane time.
        </p>
      </Section>
      {headers.length > 0 && (
        <Section title="Match your columns">
          <div className="v3-form">
            <fieldset disabled={busy}>
              <div className="v3-form-pair">
                {fields
                  .filter(
                    f =>
                      mode === "appointments" ||
                      ["name", "email", "phone"].includes(f)
                  )
                  .map(f => (
                    <label key={f}>
                      {labels[f]}
                      <select
                        aria-label={`Map ${labels[f]}`}
                        value={mapping[f] || ""}
                        onChange={e => {
                          setMapping({ ...mapping, [f]: e.target.value });
                          invalidate();
                        }}
                      >
                        <option value="">Not included</option>
                        {headers.map(h => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
              </div>
              {mode === "appointments" && serviceNames.length > 0 && (
                <Section title="Match services">
                  {serviceNames.map(name => (
                    <label key={name}>
                      {name}
                      <select
                        aria-label={`Map service ${name}`}
                        value={serviceMap[name] || ""}
                        onChange={e => {
                          setServiceMap({
                            ...serviceMap,
                            [name]: e.target.value,
                          });
                          invalidate();
                        }}
                      >
                        <option value="">Keep imported service name</option>
                        {services.map(s => (
                          <option
                            value={String(s.id || s.name)}
                            key={s.id || s.name}
                          >
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </Section>
              )}
              <Action disabled={!mapping.name || !rows.length} onClick={review}>
                {preview.isPending
                  ? "Checking records…"
                  : "Review matches & duplicates"}
              </Action>
            </fieldset>
          </div>
        </Section>
      )}
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && (
        <Section title="Review your import">
          <Panel>
            <p>
              {results.filter(r => r.status === "imported").length} imported ·{" "}
              {results.filter(r => r.status === "duplicate").length} duplicates
              ·{" "}
              {
                results.filter(r =>
                  ["invalid", "conflict", "failed"].includes(r.status)
                ).length
              }{" "}
              need attention
            </p>
            <p className="v3-muted">
              Duplicates are skipped. Existing profiles are not overwritten.
              Each row is checked again at import.
            </p>
            <Action onClick={importReady} disabled={busy || eligible === 0}>
              {commit.isPending
                ? "Importing…"
                : `Import / retry ${eligible} ready rows`}
            </Action>
          </Panel>
          {results.map(r => (
            <Row
              key={r.index}
              title={r.name || "Missing name"}
              detail={`Row ${r.sourceRow || r.index + 2}: ${r.detail}`}
              trailing={
                <Status
                  tone={
                    r.status === "imported"
                      ? "success"
                      : ["invalid", "conflict", "failed"].includes(r.status)
                        ? "warning"
                        : "neutral"
                  }
                >
                  {r.status}
                </Status>
              }
            />
          ))}
        </Section>
      )}
      <Section title="Connect an external calendar">
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            calendar.mutate({ appleCalendarUrl: calendarUrl });
          }}
        >
          <label>
            Calendar feed URL
            <input
              type="url"
              required
              value={calendarUrl}
              disabled={calendar.isPending}
              onChange={e => {
                calendar.reset();
                setCalendarUrl(e.target.value);
              }}
              placeholder="https://…"
            />
          </label>
          <p className="v3-muted">
            External events appear alongside your Tattoi calendar. Edit those
            events in their original calendar.
          </p>
          <Action type="submit" disabled={calendar.isPending || !calendarUrl}>
            {calendar.isPending ? "Saving…" : "Save calendar link"}
          </Action>
          {calendar.isSuccess && <p role="status">Calendar link saved.</p>}
        </form>
      </Section>
    </Screen>
  );
}
