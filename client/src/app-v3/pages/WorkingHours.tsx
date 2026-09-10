import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  Feedback,
  Row,
  Screen,
  Section,
  Tabs,
} from "../design/primitives";
import { readSchedule, writeSchedule, type WorkDay } from "../data/schedule";
type Service = {
  name: string;
  duration: number;
  price: number;
  description: string;
  sittings: number;
  showInFunnel: boolean;
  [key: string]: unknown;
};
export default function WorkingHours() {
  const query = trpc.artistSettings.get.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      void utils.artistSettings.invalidate();
    },
  });
  const [tab, setTab] = useState<"Availability" | "Services">("Availability");
  const [days, setDays] = useState<WorkDay[]>(readSchedule(null));
  const [services, setServices] = useState<Service[]>([]);
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState<Service | null>(null);
  const [error, setError] = useState("");
  const [scheduleUnreadable, setScheduleUnreadable] = useState(false);
  const [servicesUnreadable, setServicesUnreadable] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (!query.data || initialized.current) return;
    initialized.current = true;
    try {
      const parsed = JSON.parse(query.data.workSchedule || "{}");
      if (!parsed || typeof parsed !== "object") throw new Error();
      const entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
      if (
        entries.some(
          (day: any) =>
            !day ||
            typeof day !== "object" ||
            (day.breaks !== undefined && !Array.isArray(day.breaks))
        )
      )
        throw new Error();
      setDays(readSchedule(query.data.workSchedule));
    } catch {
      setScheduleUnreadable(true);
      setError(
        "Your saved schedule could not be read. It has not been changed."
      );
    }
    try {
      const parsed = JSON.parse(query.data.services || "[]");
      if (!Array.isArray(parsed)) throw new Error("Invalid services");
      setServices(parsed);
    } catch {
      setServicesUnreadable(true);
      setError(
        "Your saved services could not be read. Contact support before replacing them."
      );
    }
  }, [query.data]);
  const updateDay = (i: number, patch: Partial<WorkDay>) => {
    save.reset();
    setDays(current =>
      current.map((d, n) => (i === n ? { ...d, ...patch } : d))
    );
  };
  function saveHours() {
    if (scheduleUnreadable) return;
    for (const day of days) {
      if (day.enabled && (!day.start || !day.end || day.end <= day.start)) {
        setError(`Choose an end time after the start on ${day.day}.`);
        return;
      }
      const pauses = [...(day.breaks || [])].sort((a, b) =>
        a.start.localeCompare(b.start)
      );
      if (
        day.enabled &&
        pauses.some(
          (pause, i) =>
            !pause.start ||
            !pause.end ||
            pause.start < day.start ||
            pause.end > day.end ||
            pause.end <= pause.start ||
            (i > 0 && pause.start < pauses[i - 1].end)
        )
      ) {
        setError(
          `Choose non-overlapping breaks within ${day.day}’s working hours.`
        );
        return;
      }
    }
    setError("");
    save.mutate({ workSchedule: writeSchedule(days) });
  }
  function saveService() {
    if (servicesUnreadable) return;
    if (
      !draft?.name.trim() ||
      !Number.isInteger(draft.duration) ||
      draft.duration <= 0 ||
      draft.duration > 1440 ||
      !Number.isFinite(draft.price) ||
      draft.price < 0 ||
      !Number.isInteger(draft.sittings) ||
      draft.sittings < 1 ||
      draft.sittings > 52
    ) {
      setError(
        "Enter a name, positive duration and valid price and session count."
      );
      return;
    }
    const list =
      edit === null
        ? [...services, draft]
        : services.map((s, i) => (i === edit ? draft : s));
    save.mutate(
      { services: JSON.stringify(list) },
      {
        onSuccess: () => {
          setServices(list);
          setDraft(null);
          setError("");
        },
      }
    );
  }
  return (
    <Screen
      title="Working hours & services"
      subtitle="Make your availability work for you"
      back="/business"
    >
      <Tabs
        items={["Availability", "Services"] as const}
        value={tab}
        onChange={setTab}
        label="Schedule settings"
      />
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data && (
        <>
          {tab === "Availability" ? (
            <>
              <p className="v3-muted">
                Your regular week. Design and personal days stay separate from
                tattooing availability.
              </p>
              <div className="v3-stack">
                {days.map((d, i) => (
                  <fieldset
                    key={d.day}
                    className="v3-hours-row"
                    disabled={save.isPending || scheduleUnreadable}
                  >
                    <label className="v3-inline">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={e =>
                          updateDay(i, { enabled: e.target.checked })
                        }
                      />
                      <strong style={{ textTransform: "capitalize" }}>
                        {d.day}
                      </strong>
                    </label>
                    {d.enabled ? (
                      <div className="v3-form v3-hours-fields">
                        <label>
                          <span className="sr-only">{d.day} start</span>
                          <input
                            aria-label={`${d.day} start`}
                            type="time"
                            value={d.start}
                            onChange={e =>
                              updateDay(i, { start: e.target.value })
                            }
                          />
                        </label>
                        <span>to</span>
                        <label>
                          <span className="sr-only">{d.day} end</span>
                          <input
                            aria-label={`${d.day} end`}
                            type="time"
                            value={d.end}
                            onChange={e =>
                              updateDay(i, { end: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span className="sr-only">{d.day} type</span>
                          <select
                            aria-label={`${d.day} type`}
                            value={d.type}
                            onChange={e =>
                              updateDay(i, { type: e.target.value })
                            }
                          >
                            <option value="work">Tattooing</option>
                            <option value="design">Design</option>
                            <option value="personal">Personal</option>
                          </select>
                        </label>
                      </div>
                    ) : (
                      <span className="v3-muted">Day off</span>
                    )}
                    {d.enabled && d.type === "work" && (
                      <div className="v3-hours-breaks v3-form">
                        {(d.breaks || []).map((pause, index) => (
                          <div className="v3-inline" key={index}>
                            <label>
                              Break start
                              <input
                                aria-label={`${d.day} break ${index + 1} start`}
                                type="time"
                                value={pause.start}
                                onChange={e =>
                                  updateDay(i, {
                                    breaks: d.breaks?.map((p, n) =>
                                      n === index
                                        ? {
                                            ...p,
                                            start: e.target.value,
                                            startTime: e.target.value,
                                          }
                                        : p
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Break end
                              <input
                                aria-label={`${d.day} break ${index + 1} end`}
                                type="time"
                                value={pause.end}
                                onChange={e =>
                                  updateDay(i, {
                                    breaks: d.breaks?.map((p, n) =>
                                      n === index
                                        ? {
                                            ...p,
                                            end: e.target.value,
                                            endTime: e.target.value,
                                          }
                                        : p
                                    ),
                                  })
                                }
                              />
                            </label>
                            <Action
                              tone="quiet"
                              aria-label={`Remove ${d.day} break ${index + 1}`}
                              onClick={() =>
                                updateDay(i, {
                                  breaks: d.breaks?.filter(
                                    (_, n) => n !== index
                                  ),
                                })
                              }
                            >
                              <Trash2 size={18} />
                            </Action>
                          </div>
                        ))}
                        <Action
                          tone="quiet"
                          disabled={save.isPending || scheduleUnreadable}
                          onClick={() =>
                            updateDay(i, {
                              breaks: [
                                ...(d.breaks || []),
                                { start: "12:00", end: "13:00" },
                              ],
                            })
                          }
                        >
                          Add {d.day} break
                        </Action>
                      </div>
                    )}
                  </fieldset>
                ))}
              </div>
              <Action
                disabled={save.isPending || scheduleUnreadable}
                onClick={saveHours}
              >
                {save.isPending ? "Saving…" : "Save availability"}
              </Action>
            </>
          ) : (
            <Section
              title="Services"
              action={
                <Action
                  disabled={servicesUnreadable}
                  onClick={() => {
                    setEdit(null);
                    setDraft({
                      name: "",
                      duration: 60,
                      price: 0,
                      description: "",
                      sittings: 1,
                      showInFunnel: true,
                    });
                    setError("");
                  }}
                >
                  <Plus />
                  Add service
                </Action>
              }
            >
              {services.map((s, i) => (
                <Row
                  key={i}
                  title={s.name}
                  detail={`${s.duration} minutes · ${money(Math.round(s.price * 100))} · ${s.sittings || 1} session${s.sittings > 1 ? "s" : ""}`}
                  onClick={() => {
                    setEdit(i);
                    setDraft({
                      ...s,
                      sittings: s.sittings || 1,
                      showInFunnel: s.showInFunnel !== false,
                    });
                    setError("");
                  }}
                />
              ))}
              {!services.length && (
                <Feedback empty="Add your first service to start creating proposals." />
              )}
            </Section>
          )}
          {error && <p role="alert">{error}</p>}
          {save.error && <p role="alert">{save.error.message}</p>}
          {save.isSuccess && <p role="status">Saved.</p>}
        </>
      )}
      <SheetShell
        isOpen={!!draft}
        onClose={() => !save.isPending && setDraft(null)}
        title={edit === null ? "Add service" : "Edit service"}
      >
        {draft && (
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              saveService();
            }}
          >
            <label>
              Service name
              <input
                required
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={draft.description || ""}
                onChange={e =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label>
              Duration per session · minutes
              <input
                type="number"
                required
                min={1}
                max={1440}
                value={draft.duration}
                onChange={e =>
                  setDraft({ ...draft, duration: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Price per session · AUD
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={draft.price}
                onChange={e =>
                  setDraft({ ...draft, price: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Number of sessions
              <input
                type="number"
                required
                min={1}
                max={52}
                value={draft.sittings}
                onChange={e =>
                  setDraft({ ...draft, sittings: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>
                <input
                  style={{ width: "auto", minHeight: 0 }}
                  type="checkbox"
                  checked={draft.showInFunnel}
                  onChange={e =>
                    setDraft({ ...draft, showInFunnel: e.target.checked })
                  }
                />{" "}
                Show on your booking page
              </span>
            </label>
            {error && <p role="alert">{error}</p>}
            {save.error && <p role="alert">{save.error.message}</p>}
            <Action type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save service"}
            </Action>
            {edit !== null && (
              <details>
                <summary className="v3-row">Remove service</summary>
                <p>
                  Existing bookings keep their details. This service will no
                  longer be available for new bookings.
                </p>
                <Action
                  tone="danger"
                  disabled={save.isPending}
                  onClick={() => {
                    const list = services.filter((_, i) => i !== edit);
                    save.mutate(
                      { services: JSON.stringify(list) },
                      {
                        onSuccess: () => {
                          setServices(list);
                          setDraft(null);
                        },
                      }
                    );
                  }}
                >
                  <Trash2 />
                  Remove service
                </Action>
              </details>
            )}
          </form>
        )}
      </SheetShell>
    </Screen>
  );
}
