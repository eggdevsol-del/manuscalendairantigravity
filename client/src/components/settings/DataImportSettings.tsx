import { useState } from "react";
import Papa from "papaparse";
import { trpc } from "@/lib/trpc";
import { Button, Input, Label } from "@/components/ui";
import { PageHeader } from "@/components/ui/ssot";
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
export function DataImportSettings({ onBack }: { onBack: () => void }) {
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
      void utils.conversations.list.invalidate();
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
  const serviceNames = [
    ...new Set(
      rows.map(r => (r[mapping.serviceName] || "").trim()).filter(Boolean)
    ),
  ];
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Import your data"
        subtitle="Review matches and duplicates before adding anything."
      />
      <div className="overflow-y-auto touch-pan-y p-5 pb-32 space-y-6 max-w-3xl mx-auto w-full">
        <Button variant="ghost" onClick={onBack}>
          Back to settings
        </Button>
        <section className="border rounded-2xl p-5 space-y-4">
          <Label htmlFor="import-mode">What are you importing?</Label>
          <select
            id="import-mode"
            value={mode}
            disabled={busy}
            onChange={e => {
              setMode(e.target.value as typeof mode);
              invalidate();
            }}
            className="w-full min-h-12 rounded-xl bg-background border px-3"
          >
            <option value="clients">Clients</option>
            <option value="appointments">Appointments</option>
          </select>
          <Label htmlFor="csv">CSV file · up to 500 rows</Label>
          <Input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={e => read(e.target.files?.[0])}
          />
          {fileName && (
            <p className="text-sm">
              {fileName} · {rows.length} rows
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Use an email or phone for each client. Dates: YYYY-MM-DD or
            DD/MM/YYYY. Times: HH:mm or h:mm AM/PM. Appointments use the
            business timezone, Australia/Brisbane.
          </p>
        </section>
        {headers.length > 0 && (
          <section className="border rounded-2xl p-5 space-y-4">
            <h2 className="text-xl font-semibold">Match your columns</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {fields
                .filter(
                  f =>
                    mode === "appointments" ||
                    ["name", "email", "phone"].includes(f)
                )
                .map(f => (
                  <div key={f}>
                    <Label htmlFor={`map-${f}`}>{labels[f]}</Label>
                    <select
                      id={`map-${f}`}
                      disabled={busy}
                      value={mapping[f] || ""}
                      onChange={e => {
                        setMapping({ ...mapping, [f]: e.target.value });
                        invalidate();
                      }}
                      className="w-full min-h-12 rounded-xl bg-background border px-3 mt-2"
                    >
                      <option value="">Not included</option>
                      {headers.map(h => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
            {mode === "appointments" && serviceNames.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Match services</h3>
                {serviceNames.map(name => (
                  <div key={name}>
                    <Label>{name}</Label>
                    <select
                      aria-label={`Map service ${name}`}
                      value={serviceMap[name] || ""}
                      disabled={busy}
                      onChange={e => {
                        setServiceMap({
                          ...serviceMap,
                          [name]: e.target.value,
                        });
                        invalidate();
                      }}
                      className="w-full min-h-12 rounded-xl bg-background border px-3"
                    >
                      <option value="">Keep imported service name</option>
                      {services.map(s => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="w-full min-h-12"
              disabled={busy || !mapping.name || !rows.length}
              onClick={review}
            >
              {preview.isPending
                ? "Checking existing records…"
                : "Review matches & duplicates"}
            </Button>
          </section>
        )}
        {error && (
          <p role="alert" className="text-destructive border rounded-xl p-4">
            {error}
          </p>
        )}
        {results.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Review results</h2>
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
            <p className="text-sm text-muted-foreground">
              Duplicates are skipped. Existing profiles are never overwritten.
              Each row is checked again when imported.
            </p>
            <div className="max-h-96 overflow-y-auto border rounded-xl divide-y">
              {results.map(r => (
                <article key={r.index} className="p-4">
                  <div className="flex justify-between gap-3">
                    <strong>{r.name || "Missing name"}</strong>
                    <span className="capitalize">{r.status}</span>
                  </div>
                  <p className="text-sm mt-1">
                    Row {r.sourceRow || r.index + 2}: {r.detail}
                  </p>
                </article>
              ))}
            </div>
            <Button
              className="w-full min-h-12"
              onClick={importReady}
              disabled={busy || eligible === 0}
            >
              {commit.isPending
                ? "Importing…"
                : `Import / retry ${eligible} ready rows`}
            </Button>
          </section>
        )}
        <section className="border rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">External calendar</h2>
          <Label htmlFor="calendar-url">Calendar feed URL</Label>
          <Input
            id="calendar-url"
            value={calendarUrl}
            onChange={e => setCalendarUrl(e.target.value)}
            placeholder="https://…"
          />
          <Button
            variant="outline"
            disabled={calendar.isPending || !calendarUrl}
            onClick={() =>
              calendar.mutate({
                appleCalendarUrl: calendarUrl,
                workSchedule: settings.data?.workSchedule || "{}",
                services: settings.data?.services || "[]",
              })
            }
          >
            Save calendar link
          </Button>
          {calendar.isSuccess && <p role="status">Calendar link saved.</p>}
        </section>
      </div>
    </div>
  );
}
