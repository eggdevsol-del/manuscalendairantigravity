import { useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { bookingDate, money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  SearchField,
  Section,
  Status,
} from "../design/primitives";
type DraftSession = {
  date: string;
  time: string;
  duration: number;
  price: string;
  deposit: string;
};
type Service = {
  name: string;
  duration: number;
  price: number;
  sittings?: number;
};
export function BookingComposer({
  initialDate = new Date(),
  conversationId,
  onSuccess,
}: {
  initialDate?: Date;
  conversationId?: number;
  onSuccess: (id: number) => void;
}) {
  const { user } = useAuth();
  const settings = trpc.artistSettings.get.useQuery();
  const clients = trpc.conversations.getClients.useQuery(undefined, {
    enabled: !conversationId,
  });
  const conversation = trpc.conversations.getById.useQuery(
    conversationId || 0,
    { enabled: !!conversationId }
  );
  const [client, setClient] = useState("");
  const [search, setSearch] = useState("");
  const [service, setService] = useState("");
  const [sessions, setSessions] = useState<DraftSession[]>(() => {
    const start = new Date(initialDate);
    if (start.getHours() === 0) start.setHours(9, 0, 0, 0);
    if (isSameDay(start, new Date()) && start <= new Date())
      start.setTime(Math.ceil((Date.now() + 60000) / 1800000) * 1800000);
    return [
      {
        date: format(start, "yyyy-MM-dd"),
        time: format(start, "HH:mm"),
        duration: 60,
        price: "",
        deposit: "",
      },
    ];
  });
  const [frequency, setFrequency] = useState<
    "weekly" | "biweekly" | "monthly" | "consecutive"
  >("weekly");
  const [findingDates, setFindingDates] = useState(false);
  const [step, setStep] = useState<"details" | "review">("details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const getConversation = trpc.conversations.getOrCreate.useMutation();
  const create = trpc.sessionPlans.create.useMutation();
  const utils = trpc.useUtils();
  let services: Service[] = [];
  try {
    const parsed = JSON.parse(settings.data?.services || "[]");
    if (Array.isArray(parsed)) services = parsed;
  } catch {}
  const selectedClient = clients.data?.find(c => c?.id === client);
  const clientName =
    conversation.data?.otherUser?.name || selectedClient?.name || "Client";
  const clientId = conversation.data?.clientId || client;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tier = settings.data?.subscriptionTier?.toLowerCase();
  const fixedDeposit = !tier || tier === "free" || tier === "basic";
  async function findDates() {
    if (!user || !service || findingDates) return;
    const startDate = new Date(sessions[0].date + "T" + sessions[0].time);
    if (!Number.isFinite(startDate.getTime())) {
      setError("Choose a valid starting date and time.");
      return;
    }
    setFindingDates(true);
    setError("");
    try {
      const result = await utils.booking.checkAvailability.fetch({
        conversationId: conversationId || 0,
        artistId: user.id,
        serviceName: service,
        serviceDuration: sessions[0].duration,
        sittings: sessions.length,
        price: Number(sessions[0].price) || 0,
        frequency,
        startDate,
        timeZone: zone,
      });
      if (result.dates.length !== sessions.length)
        throw new Error(
          "Not enough available dates were found. Try a different starting date."
        );
      setSessions(current =>
        current.map((s, i) => ({
          ...s,
          date: format(new Date(result.dates[i]), "yyyy-MM-dd"),
          time: format(new Date(result.dates[i]), "HH:mm"),
        }))
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t check availability. Try again."
      );
    } finally {
      setFindingDates(false);
    }
  }
  const update = (index: number, patch: Partial<DraftSession>) => {
    setError("");
    if (fixedDeposit && patch.price !== undefined) {
      patch.deposit = String(Math.round(Number(patch.price) * 25) / 100);
    }
    setSessions(s => s.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };
  const asItems = () =>
    sessions.map((s, i) => ({
      sessionIndex: i + 1,
      startsAt: new Date(`${s.date}T${s.time}`).toISOString(),
      durationMinutes: s.duration,
      estimateCents: Math.round(Number(s.price) * 100),
      depositCents: Math.round(Number(s.deposit) * 100),
    }));
  const validate = () => {
    if (!clientId || !service) return "Choose a client and service.";
    for (const s of sessions) {
      if (
        !s.date ||
        !s.time ||
        !Number.isFinite(new Date(`${s.date}T${s.time}`).getTime())
      )
        return "Choose a date and time for every session.";
      if (new Date(`${s.date}T${s.time}`) <= new Date())
        return "New booking proposals need future dates.";
      if (
        s.price === "" ||
        s.deposit === "" ||
        !Number.isFinite(Number(s.price)) ||
        !Number.isFinite(Number(s.deposit)) ||
        Number(s.price) < 0 ||
        Number(s.deposit) < 0 ||
        Number(s.deposit) > Number(s.price)
      )
        return "Enter a valid price and deposit for each session. The deposit cannot exceed the price.";
      if (!Number.isInteger(s.duration) || s.duration <= 0 || s.duration > 1440)
        return "Enter a duration between 1 and 1440 minutes.";
    }
    const items = asItems().sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)
    );
    for (let i = 1; i < items.length; i++)
      if (
        +new Date(items[i].startsAt) <
        +new Date(items[i - 1].startsAt) + items[i - 1].durationMinutes * 60000
      )
        return "These sessions overlap. Choose separate times.";
    return "";
  };
  async function send() {
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      setStep("details");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let target = conversationId;
      if (!target) {
        const result = await getConversation.mutateAsync({
          artistId: user!.id,
          clientId: clientId!,
        });
        target = result?.id;
      }
      if (!target) throw new Error("Could not open the client conversation.");
      await create.mutateAsync({
        conversationId: target,
        clientId: clientId!,
        serviceName: service,
        sessions: asItems(),
      });
      await Promise.all([
        utils.messages.list.invalidate({ conversationId: target }),
        utils.sessionPlans.invalidate(),
        utils.projects.summary.invalidate({ conversationId: target }),
        utils.conversations.list.invalidate(),
      ]);
      onSuccess(target);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t send the proposal. Try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="v3-stack">
      <Status>
        {step === "review" ? "Review before sending" : "Plan the session"}
      </Status>
      <Feedback
        loading={settings.isLoading || conversation.isLoading}
        error={settings.error || conversation.error || clients.error}
        onRetry={() => {
          void settings.refetch();
          if (conversationId) void conversation.refetch();
          else void clients.refetch();
        }}
      />
      {step === "details" ? (
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            const problem = validate();
            setError(problem);
            if (!problem) setStep("review");
          }}
        >
          <fieldset className="v3-form" disabled={findingDates || busy}>
            {!conversationId && (
              <Section title="Client">
                {client ? (
                  <Row
                    title={clientName}
                    detail="Change client"
                    onClick={() => setClient("")}
                  />
                ) : (
                  <>
                    <SearchField
                      value={search}
                      onChange={setSearch}
                      label="Search clients"
                    />
                    {clients.data
                      ?.filter((c): c is NonNullable<typeof c> => !!c)
                      .filter(c =>
                        `${c.name} ${c.email}`
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      )
                      .map(c => (
                        <Row
                          key={c.id}
                          title={c.name || "Client"}
                          detail={c.email}
                          onClick={() => setClient(c.id)}
                        />
                      ))}
                    {!clients.isLoading && !clients.data?.length && (
                      <ActionLink href="/clients">
                        Add your first client
                      </ActionLink>
                    )}
                  </>
                )}
              </Section>
            )}
            <label>
              Service
              <select
                aria-label="Service"
                value={service}
                required
                onChange={e => {
                  setService(e.target.value);
                  const svc = services.find(s => s.name === e.target.value);
                  if (svc) {
                    const percentage = fixedDeposit
                      ? 25
                      : Number(settings.data?.depositPercentage ?? 25);
                    setSessions(s =>
                      Array.from(
                        {
                          length: Math.max(
                            1,
                            Math.min(52, Number(svc.sittings) || 1)
                          ),
                        },
                        (_, i) => ({
                          ...s[0],
                          date: format(
                            addDays(
                              new Date(s[0].date + "T" + s[0].time),
                              7 * i
                            ),
                            "yyyy-MM-dd"
                          ),
                          duration: svc.duration || 60,
                          price: String(svc.price || 0),
                          deposit: String(
                            Math.round((svc.price || 0) * percentage) / 100
                          ),
                        })
                      )
                    );
                  }
                }}
              >
                <option value="">Choose a service</option>
                {services.map((s, i) => (
                  <option key={`${s.name}-${i}`} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {!settings.isLoading && !services.length && (
              <ActionLink href="/settings?section=work-hours">
                Set up your services
              </ActionLink>
            )}
            {service && (
              <Panel>
                <div className="v3-form">
                  <label>
                    Space sessions
                    <select
                      aria-label="Space sessions"
                      value={frequency}
                      onChange={e =>
                        setFrequency(e.target.value as typeof frequency)
                      }
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every two weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="consecutive">
                        Consecutive working days
                      </option>
                    </select>
                  </label>
                  <Action
                    tone="secondary"
                    disabled={findingDates || busy}
                    onClick={findDates}
                  >
                    {findingDates ? "Finding dates…" : "Find available dates"}
                  </Action>
                  <small>
                    Uses your working hours and existing bookings, starting from
                    the first date below. You can adjust each date before
                    sending.
                  </small>
                </div>
              </Panel>
            )}
            {sessions.map((s, i) => (
              <Section
                key={i}
                title={`Session ${i + 1}`}
                action={
                  sessions.length > 1 ? (
                    <Action
                      tone="quiet"
                      aria-label={`Remove session ${i + 1}`}
                      onClick={() =>
                        setSessions(rows => rows.filter((_, n) => n !== i))
                      }
                    >
                      <Trash2 />
                    </Action>
                  ) : undefined
                }
              >
                <div className="v3-form">
                  <div className="v3-form-pair">
                    <label>
                      Date
                      <input
                        type="date"
                        required
                        value={s.date}
                        onChange={e => update(i, { date: e.target.value })}
                      />
                    </label>
                    <label>
                      Time
                      <input
                        type="time"
                        required
                        value={s.time}
                        onChange={e => update(i, { time: e.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    Duration in minutes
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      required
                      value={s.duration}
                      onChange={e =>
                        update(i, { duration: Number(e.target.value) })
                      }
                    />
                  </label>
                  <div className="v3-form-pair">
                    <label>
                      Session price · AUD
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={s.price}
                        onChange={e => update(i, { price: e.target.value })}
                      />
                    </label>
                    <label>
                      Deposit · AUD
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={s.deposit}
                        readOnly={fixedDeposit}
                        aria-describedby={
                          fixedDeposit ? "booking-deposit-policy" : undefined
                        }
                        onChange={e => update(i, { deposit: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              </Section>
            ))}
            <small>
              Times in {zone.replaceAll("_", " ")}. Availability is checked when
              the proposal is sent.
            </small>
            {fixedDeposit && (
              <small id="booking-deposit-policy">
                Your Free plan uses a 25% deposit for each session.
              </small>
            )}
            <Action
              tone="secondary"
              disabled={sessions.length >= 52}
              onClick={() => {
                const last = sessions[sessions.length - 1];
                const next = new Date(`${last.date}T${last.time}`);
                next.setDate(next.getDate() + 7);
                setSessions([
                  ...sessions,
                  { ...last, date: format(next, "yyyy-MM-dd") },
                ]);
              }}
            >
              <Plus />
              Add another session
            </Action>
            {error && <p role="alert">{error}</p>}
            <Action type="submit">Review proposal</Action>
          </fieldset>
        </form>
      ) : (
        <>
          <Panel>
            <h2>{service}</h2>
            <p>
              {clientName} · {sessions.length} session
              {sessions.length === 1 ? "" : "s"}
            </p>
            {asItems().map(s => (
              <Row
                key={s.sessionIndex}
                title={bookingDate(s.startsAt, zone)}
                detail={`${s.durationMinutes} minutes · Deposit ${money(s.depositCents)}`}
                trailing={<strong>{money(s.estimateCents)}</strong>}
              />
            ))}
            <dl className="v3-facts">
              <div>
                <dt>Total estimate</dt>
                <dd>
                  {money(
                    asItems().reduce((sum, s) => sum + s.estimateCents, 0)
                  )}
                </dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>
                  {money(asItems().reduce((sum, s) => sum + s.depositCents, 0))}
                </dd>
              </div>
            </dl>
          </Panel>
          <p className="v3-muted">
            Your client will receive this proposal in Messages and review the
            applicable fee and terms at checkout. Their booking is confirmed
            after payment.
          </p>
          {error && <p role="alert">{error}</p>}
          <Action disabled={busy} onClick={send}>
            {busy ? "Sending proposal…" : "Send proposal"}
          </Action>
          <Action
            tone="quiet"
            disabled={busy}
            onClick={() => setStep("details")}
          >
            Edit details
          </Action>
        </>
      )}
    </div>
  );
}
