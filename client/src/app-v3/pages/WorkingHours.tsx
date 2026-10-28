import { useArtistSetup } from "@/features/onboarding/ArtistSetupContext";
import { NumericInput } from "@/components/ui/numeric-input";
import { DetailsSheet } from "../components/DetailsSheet";
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
import { PAYMENT_TIERS, resolvePaymentTier } from "@shared/fees";
import { LiveStage, StageNumber, TouchSlider } from "../design/live";
import { sittingSplit, weekWindows } from "../design/liveDisplays";
import { duration as minutesLabel } from "../design/calendarDays";
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
  const setup = useArtistSetup();
  const setupTab = setup
    ? setup.step === "services"
      ? "Services"
      : "Availability"
    : undefined;
  const query = trpc.artistSettings.get.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      void utils.artistSettings.invalidate();
      void utils.feed.invalidate();
      void setup?.onSaved();
    },
  });
  const [tab, setTab] = useState<"Availability" | "Services">(
    setupTab || "Availability"
  );
  const [days, setDays] = useState<WorkDay[]>(readSchedule(null));
  const [services, setServices] = useState<Service[]>([]);
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState<
    | (Omit<Service, "duration" | "price" | "sittings"> & {
        name: string;
        description: string;
        showInFunnel: boolean;
        duration: number | "";
        price: number | "";
        sittings: number | "";
      })
    | null
  >(null);
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
    if (setup && !days.some(d => d.enabled)) {
      setError("Choose at least one working day to continue.");
      return;
    }
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
      draft.duration === "" ||
      draft.price === "" ||
      draft.sittings === "" ||
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
        ? [...services, draft as Service]
        : services.map((s, i) => (i === edit ? (draft as Service) : s));
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
      back={setup ? undefined : "/business"}
      subheader={
        <Tabs
          items={
            setupTab ? [setupTab] : (["Availability", "Services"] as const)
          }
          value={tab}
          onChange={setTab}
          label="Schedule settings"
        />
      }
    >
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {query.data && (
        <>
          {tab === "Availability" ? (
            <>
              <WeekDisplay days={days} />
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
              <DepositSetting
                tier={resolvePaymentTier(query.data.subscriptionTier)}
                saved={query.data.depositPercentage}
                price={services.find(s => s.price > 0)?.price ?? 1000}
                saving={save.isPending}
                onSave={depositPercentage =>
                  save.mutate({ depositPercentage })
                }
              />
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
            <ServiceDisplay
              name={draft.name}
              duration={Number(draft.duration) || 0}
              price={Number(draft.price) || 0}
              sittings={Number(draft.sittings) || 1}
              tier={resolvePaymentTier(query.data?.subscriptionTier)}
              depositPercent={query.data?.depositPercentage}
            />
            <label>
              Service name
              <input
                required
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Service colour
              <input
                type="color"
                aria-label="Service colour"
                value={
                  typeof draft.color === "string" &&
                  /^#[0-9a-f]{6}$/i.test(draft.color)
                    ? draft.color
                    : "#c9a96e"
                }
                onChange={e => setDraft({ ...draft, color: e.target.value })}
              />
              <small>Used as an accent on calendar sessions.</small>
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
            <TouchSlider
              label="Length of each sitting"
              tone="time"
              value={Number(draft.duration) || 0}
              min={15}
              max={720}
              step={15}
              format={v => minutesLabel(v)}
              onChange={v => setDraft({ ...draft, duration: v })}
            />
            <TouchSlider
              label="Price per sitting"
              tone="money"
              value={Number(draft.price) || 0}
              min={0}
              max={5000}
              step={50}
              format={v => money(Math.round(v * 100)).replace(/\.00$/, "")}
              onChange={v => setDraft({ ...draft, price: v })}
            />
            <label>
              Exact price per sitting · AUD
              <NumericInput
                type="number"
                required
                min={0}
                step="0.01"
                value={draft.price}
                onChange={e =>
                  setDraft({
                    ...draft,
                    price: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </label>
            <TouchSlider
              label="Sittings"
              tone="time"
              value={Number(draft.sittings) || 1}
              min={1}
              max={12}
              format={v => `${v} sitting${v === 1 ? "" : "s"}`}
              onChange={v => setDraft({ ...draft, sittings: v })}
            />
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
              <DetailsSheet title={<> Remove service </>}>
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
              </DetailsSheet>
            )}
          </form>
        )}
      </SheetShell>
    </Screen>
  );
}

/** The week at a glance: each day's working window down a 24-hour column, with breaks cut out. */
function WeekDisplay({ days }: { days: WorkDay[] }) {
  const week = weekWindows(days);
  return (
    <LiveStage className="iosm-week" label="Your working week">
      <StageNumber
        over="Tattooing each week"
        value={`${Math.round(week.tattooHours * 10) / 10}h`}
        under={`${week.days.filter(d => d.on).length} working days`}
      />
      <span className="iosm-weekbars">
        {week.days.map(d => (
          <span key={d.day} className="iosm-weekbar">
            <span className="iosm-weekbar-col">
              {d.on && (
                <i
                  className={d.type}
                  style={{ top: `${d.top}%`, height: `${d.height}%` }}
                />
              )}
              {d.breaks.map((b, n) => (
                <s key={n} style={{ top: `${b.top}%`, height: `${b.height}%` }} />
              ))}
            </span>
            <small>{d.day.slice(0, 1).toUpperCase()}</small>
          </span>
        ))}
      </span>
      <span className="iosm-week-key">
        <span><i className="work" /> Tattooing</span>
        <span><i className="design" /> Design</span>
        <span><i className="personal" /> Personal</span>
      </span>
    </LiveStage>
  );
}

/** The service as a sitting: a card drawn to its length, with what the client pays and what you keep. */
function ServiceDisplay({
  name,
  duration,
  price,
  sittings,
  tier,
  depositPercent,
}: {
  name: string;
  duration: number;
  price: number;
  sittings: number;
  tier: ReturnType<typeof resolvePaymentTier>;
  depositPercent?: number | null;
}) {
  const cents = Math.round(price * 100);
  const split = sittingSplit(cents, tier, depositPercent);
  const end = new Date(2000, 0, 1, 10, duration);
  const whole = (c: number) => money(c).replace(/\.00$/, "");
  return (
    <LiveStage className="iosm-svc" label="This service as a sitting">
      <span
        className="iosm-svc-card"
        style={{ height: 44 + Math.min(duration, 720) / 60 * 16 }}
      >
        <i>
          10:00am –{" "}
          {end
            .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
            .replace(" ", "")
            .toLowerCase()}
        </i>
        <b>{name || "New service"}</b>
      </span>
      <span className="iosm-svc-facts">
        <span>
          <small>Per sitting</small>
          <b>{whole(cents)}</b>
        </span>
        <span>
          <small>{duration ? minutesLabel(duration) : "No length"}</small>
          <b>{duration ? `${whole(Math.round(cents / (duration / 60) / 100) * 100)}/h` : "–"}</b>
        </span>
        <span>
          <small>{split.percent}% to book</small>
          <b>{whole(split.depositClient)}</b>
        </span>
        <span>
          <small>You keep</small>
          <b>{whole(split.keep)}</b>
        </span>
        {sittings > 1 && (
          <span>
            <small>{sittings} sittings</small>
            <b>{whole(cents * sittings)}</b>
          </span>
        )}
      </span>
      <em className="iosm-svc-note">
        Clients pay the card fee on top
        {split.artistFee
          ? `. The Tattoi fee on your plan is ${whole(split.artistFee)}.`
          : ". No Tattoi fee on your plan."}
      </em>
    </LiveStage>
  );
}

/** Deposits: drag the bar to set how much clients pay to book, and watch the split of a sitting change.
 *  Free plans have a fixed deposit, so the slider previews other splits without saving. */
function DepositSetting({
  tier,
  saved,
  price,
  saving,
  onSave,
}: {
  tier: ReturnType<typeof resolvePaymentTier>;
  saved?: number | null;
  price: number;
  saving: boolean;
  onSave: (percent: number) => void;
}) {
  const locked = !PAYMENT_TIERS[tier].depositCustomisable;
  const current = locked
    ? PAYMENT_TIERS[tier].defaultDepositPercent
    : (saved ?? PAYMENT_TIERS[tier].defaultDepositPercent);
  const [percent, setPercent] = useState(current);
  // Preview the chosen split as if the plan allowed it.
  const split = sittingSplit(Math.round(price * 100), "pro", percent);
  const whole = (c: number) => money(c).replace(/\.00$/, "");
  return (
    <div className="v3-stack">
      <LiveStage className="iosm-split" label="How a sitting's payment splits">
        <StageNumber
          over={`A ${whole(Math.round(price * 100))} sitting`}
          value={`${percent}% to book`}
          under={
            locked && percent !== current
              ? `Preview · your plan uses ${current}%`
              : percent === current
                ? "Your current deposit"
                : "Not saved yet"
          }
        />
        <span className="iosm-split-bar" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </span>
        <span className="iosm-svc-facts">
          <span>
            <small>Client pays to book</small>
            <b>{whole(split.depositClient)}</b>
          </span>
          <span>
            <small>On the day</small>
            <b>{whole(split.balanceClient)}</b>
          </span>
        </span>
      </LiveStage>
      <TouchSlider
        label="Deposit"
        tone="money"
        value={percent}
        min={10}
        max={50}
        step={5}
        format={v => `${v}%`}
        onChange={setPercent}
      />
      {locked ? (
        <p className="v3-muted">
          Your plan takes a fixed {current}% deposit. Pro lets you choose your
          own.
        </p>
      ) : (
        <Action
          disabled={saving || percent === current}
          onClick={() => onSave(percent)}
        >
          {saving ? "Saving…" : `Save ${percent}% deposit`}
        </Action>
      )}
    </div>
  );
}
