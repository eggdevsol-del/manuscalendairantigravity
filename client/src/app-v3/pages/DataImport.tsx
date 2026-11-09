import { usePractice } from "@/features/practice/PracticeContext";
import { ImportProgressSheet } from "../components/ImportProgressSheet";
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
import {
  importedPayment,
  type ImportInput,
  type ImportResult,
} from "@shared/importData";
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
  const practice = usePractice();
  const [progressOpen, setProgressOpen] = useState(false);
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
  // Appointment options: deposits on future sittings, and what to do with overlapping bookings.
  const [depositPercent, setDepositPercent] = useState<number | null>(null),
    [depositsPaid, setDepositsPaid] = useState(true),
    [saveDefaultDeposit, setSaveDefaultDeposit] = useState(false),
    [replaceExisting, setReplaceExisting] = useState(false),
    [notice, setNotice] = useState("");
  const deposit =
    depositPercent ??
    (settings.data as { depositPercentage?: number } | undefined)
      ?.depositPercentage ??
    25;
  const utils = trpc.useUtils();
  const preview = trpc.dataImport.preview.useMutation({
    onSuccess: setResults,
    onError: e => setError(e.message),
  });
  const commit = trpc.dataImport.commit.useMutation({
    onSuccess: data => {
      if (data.defaultDeposit)
        setNotice(
          data.defaultDeposit.saved
            ? `${data.defaultDeposit.percent}% is now your standard deposit for new bookings.`
            : `Your plan uses a fixed ${data.defaultDeposit.percent}% deposit for new bookings, so that didn’t change. The imported sittings use ${deposit}%.`
        );
      void utils.artistSettings.invalidate();
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
            date: [
              "date",
              "appointment date",
              "start date",
              "date & time",
              "date and time",
              "datetime",
              "when",
              "appointment",
            ],
            startTime: [
              "start time",
              "time",
              "start",
              "starts",
              "starts at",
              "start date time",
              "from",
            ],
            endTime: ["end time", "end", "ends", "ends at", "finish", "to"],
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
    ...(mode === "appointments"
      ? {
          depositPercent: deposit,
          depositsPaid,
          replaceExisting,
          saveDefaultDeposit,
        }
      : {}),
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
    setNotice("");
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
    setProgressOpen(true);
    commit.mutate(next);
  };
  const eligible = results.filter(r =>
    ["new", "matched", "failed"].includes(r.status)
  ).length;
  const samplePrice =
    rows
      .map(r => Number((r[mapping.price] || "").replace(/[$,]/g, "")))
      .find(n => Number.isFinite(n) && n > 0) ?? 1000;
  const sample = importedPayment(
    Math.round(samplePrice * 100),
    false,
    deposit,
    depositsPaid
  );
  const money = (cents: number) =>
    "$" + (cents / 100).toLocaleString("en-AU", { maximumFractionDigits: 2 });
  const past = results.filter(
    r => r.timing === "past" && r.status !== "duplicate"
  ).length;
  const future = results.filter(
    r => r.timing === "future" && r.status !== "duplicate"
  ).length;
  const replacing = results.reduce((n, r) => n + (r.replaces || 0), 0);
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
      <ImportProgressSheet
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        kind="calendar"
        title={
          mode === "appointments"
            ? "Bringing your sittings over"
            : "Bringing your clients over"
        }
        task="Checking and importing records…"
        complete={commit.isSuccess}
        error={commit.error?.message}
        detail={
          commit.isSuccess
            ? "Review the row results below, including any skipped or failed records."
            : "Please keep this page open until the import finishes."
        }
      />
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
          Each client needs an email or phone. Dates and times are converted
          automatically from most formats (25/12/2026, 2026-12-25, 25 Dec 2026,
          2:30 PM, 14:30, or date and time in one column). Appointment imports
          use Australia/Brisbane time.
        </p>
      </Section>
      {practice && (
        <Action
          tone="secondary"
          onClick={() => {
            setRows([
              { Name: "Casey Morgan", Email: "casey@example.test" },
              { Name: "Casey Morgan", Email: "casey@example.test" },
            ]);
            setHeaders(["Name", "Email"]);
            setMapping({ name: "Name", email: "Email" });
            setFileName("clients.csv");
            setResults([]);
          }}
        >
          Choose client list
        </Action>
      )}
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
              {mode === "appointments" && (
                <Section title="Payments and existing bookings">
                  <div className="import-deposit" aria-live="polite">
                    <p className="import-deposit-rule">
                      <b>Past sittings</b>
                      <span>Marked completed and paid in full.</span>
                    </p>
                    <div className="import-deposit-preview">
                      <small>
                        A {money(Math.round(samplePrice * 100))} sitting from
                        your file
                      </small>
                      <div className="import-deposit-bar">
                        <i style={{ width: `${deposit}%` }}>
                          {deposit > 12 && <b>{deposit}%</b>}
                        </i>
                        <span>{100 - deposit > 12 && `${100 - deposit}%`}</span>
                      </div>
                      <p>
                        <b>{money(Math.round(samplePrice * deposit))}</b>{" "}
                        deposit {depositsPaid ? "already paid" : "to request"} ·{" "}
                        <b>{money(sample.remainingBalanceCents)}</b> on the day
                      </p>
                    </div>
                    <label className="import-deposit-slider">
                      Deposit on upcoming sittings
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={deposit}
                        aria-valuetext={`${deposit}% of each sitting's price`}
                        onChange={e => {
                          setDepositPercent(Number(e.target.value));
                          invalidate();
                        }}
                      />
                    </label>
                    <label className="import-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={depositsPaid}
                        onChange={e => {
                          setDepositsPaid(e.target.checked);
                          invalidate();
                        }}
                      />
                      <span>
                        <b>Clients have already paid these deposits</b>
                        <small>
                          Turn off to request them through Tattoi instead.
                        </small>
                      </span>
                    </label>
                    <label className="import-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={saveDefaultDeposit}
                        onChange={e => setSaveDefaultDeposit(e.target.checked)}
                      />
                      <span>
                        <b>Make {deposit}% my standard deposit</b>
                        <small>
                          Used for new bookings made in Tattoi, if your plan
                          lets you choose.
                        </small>
                      </span>
                    </label>
                    <label className="import-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={replaceExisting}
                        onChange={e => {
                          setReplaceExisting(e.target.checked);
                          invalidate();
                        }}
                      />
                      <span>
                        <b>Replace overlapping bookings</b>
                        <small>
                          Bookings already in Tattoi that clash with an imported
                          one are cancelled, and the imported one is used. Off:
                          clashing rows are skipped.
                        </small>
                      </span>
                    </label>
                  </div>
                </Section>
              )}
              <Action
                disabled={!mapping.name || !rows.length}
                onClick={review}
                data-tour-description="Check mapped rows against existing records to preview matches, duplicates and conflicts. This review does not import records."
              >
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
            {mode === "appointments" && past + future > 0 && (
              <p>
                {past} past {past === 1 ? "sitting" : "sittings"} paid in full ·{" "}
                {future} upcoming with a {deposit}% deposit
                {replacing > 0 &&
                  ` · replaces ${replacing} existing ${replacing === 1 ? "booking" : "bookings"}`}
              </p>
            )}
            <p className="v3-muted">
              Duplicates are skipped. Existing profiles are not overwritten.
              Each row is checked again at import.
            </p>
            {notice && <p role="status">{notice}</p>}
            <Action
              onClick={importReady}
              disabled={busy || eligible === 0}
              data-tour-description="Import the ready rows or retry failed rows from this preview. Duplicates, invalid rows and conflicts are excluded. Existing profiles are not overwritten, and each row is checked again before import."
            >
              {commit.isPending
                ? "Importing…"
                : `Import / retry ${eligible} ready rows`}
            </Action>
          </Panel>
          {results.map(r => (
            <div
              key={r.index}
              data-tour-title={`Import row ${r.sourceRow || r.index + 2}: ${r.status}`}
              data-tour-description={`Read this row’s result: ${r.detail}. ${["new", "matched", "failed"].includes(r.status) ? "This row is eligible for import or retry; review it before importing." : r.status === "imported" ? "This row has already been imported and is not retried." : "This row is excluded from import. Correct invalid data or conflicts before reviewing again; duplicates are skipped."}`}
            >
              <Row
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
            </div>
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
