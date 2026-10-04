import { PracticeControls, type PracticeResolver } from "./PracticeControls";
import {
  queryPracticeControl,
  mutatePracticeControl,
} from "@shared/practiceControls";
import { useRef } from "react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Check, ArrowLeft, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Action, Screen, Section, Row } from "@/app-v3/design/primitives";
import { PRACTICE_CHAPTERS, type PracticeState } from "@shared/practice";
import "./practice.css";
const money = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100
  );
type PracticeCommand = {
  revision: number;
  action: "start" | "advance" | "reset" | "back";
  chapterId?: string;
  stepId?: string;
  values: Record<string, string>;
  outcome: "success" | "decline" | "failure";
};
export default function PracticeWorkspace() {
  const session = trpc.practice.session.useQuery(undefined, { retry: false });
  const command = trpc.practice.command.useMutation();
  const controlMutation = trpc.practice.controlMutation.useMutation();
  const api = trpc.useUtils().client;
  return (
    <PracticeView
      sessionState={session.data}
      sessionError={session.isError}
      pending={command.isPending}
      save={input => command.mutateAsync(input)}
      reload={() => void session.refetch()}
      controlQuery={(path, input) =>
        api.practice.controlQuery.query({ path: path as any, input })
      }
      controlMutation={(revision, path, input) =>
        controlMutation.mutateAsync({ revision, path: path as any, input })
      }
    />
  );
}
export function PracticeView({
  sessionState,
  sessionError = false,
  pending = false,
  save,
  reload,
  preview = false,
  controlQuery,
  controlMutation,
}: {
  sessionState?: PracticeState;
  sessionError?: boolean;
  pending?: boolean;
  save: (input: PracticeCommand) => Promise<PracticeState>;
  reload: () => void;
  preview?: boolean;
  controlQuery?: (path: string, input: unknown) => Promise<unknown>;
  controlMutation?: (
    revision: number,
    path: string,
    input: unknown
  ) => Promise<{ state: PracticeState; data: unknown }>;
}) {
  const [, go] = useLocation();
  const search = useSearch();
  const requested = new URLSearchParams(search).get("chapter");
  const entered = useRef(false);
  const [state, setState] = useState<PracticeState>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [catalogue, setCatalogue] = useState(false);
  const [filter, setFilter] = useState("");
  const [controls, setControls] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const controlQueue = useRef(Promise.resolve());
  const resolve: PracticeResolver = async (path, input, type) => {
    if (type === "query")
      return controlQuery
        ? controlQuery(path, input)
        : queryPracticeControl(stateRef.current!, path, input);
    let result: unknown;
    const work = controlQueue.current.then(async () => {
      const current = stateRef.current!;
      const changed = controlMutation
        ? await controlMutation(current.revision, path, input)
        : mutatePracticeControl(current, path, input);
      stateRef.current = changed.state;
      setState(changed.state);
      result = changed.data;
    });
    controlQueue.current = work.catch(() => {});
    await work;
    return result;
  };
  useEffect(() => {
    if (sessionState) setState(sessionState);
  }, [sessionState]);
  const chapter = PRACTICE_CHAPTERS.find(c => c.id === state?.chapterId);
  const step = chapter?.steps[state?.cursor ?? 0];
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    setValues(
      Object.fromEntries(
        (step?.fields ?? []).map(f => [
          f.key,
          (f.key === "client" ? state?.client.name : f.initial) ||
            (f.type === "date"
              ? today
              : f.key === "month"
                ? today.slice(0, 7)
                : ""),
        ])
      )
    );
    setError("");
  }, [state?.chapterId, state?.cursor]);
  async function run(
    action: "start" | "advance" | "reset" | "back",
    chapterId?: string,
    outcome: "success" | "decline" | "failure" = "success"
  ) {
    if (!state || pending) return;
    setError("");
    try {
      const work = controlQueue.current.then(async () => {
        const next = await save({
          revision: stateRef.current!.revision,
          action,
          chapterId,
          stepId: step?.id,
          values,
          outcome,
        });
        stateRef.current = next;
        setState(next);
      });
      controlQueue.current = work.catch(() => {});
      await work;
      if (action === "start") setCatalogue(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save practice progress."
      );
    }
  }
  useEffect(() => {
    if (
      !state ||
      entered.current ||
      !requested ||
      !PRACTICE_CHAPTERS.some(c => c.id === requested)
    )
      return;
    entered.current = true;
    void run("start", requested);
  }, [state, requested]);
  const Frame = preview ? PreviewFrame : Screen;
  return (
    <Frame
      title="Practice"
      subtitle="Learn with a mock client, at your own pace."
      back="/settings?section=how-tos"
    >
      <Action tone="secondary" onClick={() => setControls(!controls)}>
        {controls ? "Hide app controls" : "Practise with app controls"}
      </Action>
      {controls && state && (
        <PracticeControls
          state={state}
          resolve={resolve}
          onExit={() => setControls(false)}
        />
      )}
      <div className="practice-banner" role="status">
        Practice mode · No real payments or messages
      </div>
      {!state ? (
        <Section title="Practice workspace">
          <p>
            {sessionError
              ? "Practice storage is not available. The artist practice migration must be installed before testing."
              : "Loading your practice session…"}
          </p>
          <Action onClick={reload}>Retry</Action>
        </Section>
      ) : (
        <>
          <div className="practice-toolbar">
            <Action tone="quiet" onClick={() => setCatalogue(!catalogue)}>
              <ArrowLeft size={16} />{" "}
              {catalogue ? "Resume chapter" : "All chapters"}
            </Action>
            <Action
              tone="quiet"
              onClick={() =>
                preview ? setCatalogue(true) : go("/settings?section=how-tos")
              }
            >
              Exit practice
            </Action>
          </div>
          {!chapter || catalogue ? (
            <>
              <p className="v3-muted">
                Each chapter uses a private copy of the mock client.{" "}
                {preview
                  ? "Progress is stored in this browser only."
                  : "Your progress is saved to your account."}{" "}
                Client responses, imports, notifications and payments are
                simulated.
              </p>
              <label className="practice-field">
                Find a workflow
                <input
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
              </label>
              <Section
                title={`${state.completed.length} of ${PRACTICE_CHAPTERS.length} chapters complete`}
              >
                {PRACTICE_CHAPTERS.filter(c =>
                  (c.title + " " + c.detail)
                    .toLowerCase()
                    .includes(filter.toLowerCase())
                ).map(c => (
                  <Row
                    key={c.id}
                    title={
                      (state.completed.includes(c.id) ? "✓ " : "") + c.title
                    }
                    detail={`${c.steps.length} actions · ${c.detail}`}
                    onClick={() => void run("start", c.id)}
                  />
                ))}
              </Section>
              <Action
                tone="danger"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Reset all mock records and tutorial progress? Your real account is unaffected."
                    )
                  )
                    void run("reset");
                }}
              >
                Reset all practice
              </Action>
            </>
          ) : (
            <>
              <div className="practice-heading">
                <h2>{chapter.title}</h2>
                <Action
                  tone="quiet"
                  disabled={pending}
                  onClick={() => void run("start", chapter.id)}
                >
                  <RefreshCw size={16} /> Restart chapter
                </Action>
              </div>
              <Action
                tone="quiet"
                disabled={pending || !state.checkpoints?.length}
                onClick={() => void run("back")}
              >
                Back to previous step
              </Action>
              <progress
                max={chapter.steps.length}
                value={state.cursor}
                aria-label="Chapter progress"
              />
              {step ? (
                <section
                  className="practice-guide"
                  aria-label="Guided practice step"
                  key={`${chapter.id}-${state.cursor}`}
                >
                  <span className="v3-muted">
                    {state.cursor + 1} / {chapter.steps.length}
                    {step.simulation ? " · Simulated client" : ""}
                  </span>
                  <h2>{step.title}</h2>
                  <p>{step.instruction}</p>
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void run("advance");
                    }}
                  >
                    {(step.fields ?? []).map(f => (
                      <label key={f.key} className="practice-field">
                        {f.type === "checkbox" ? (
                          <>
                            <input
                              type="checkbox"
                              checked={values[f.key] === "true"}
                              onChange={e =>
                                setValues({
                                  ...values,
                                  [f.key]: String(e.target.checked),
                                })
                              }
                            />
                            {f.label}
                          </>
                        ) : (
                          <>
                            {f.label}
                            {f.type === "select" ? (
                              <select
                                value={values[f.key] ?? ""}
                                onChange={e =>
                                  setValues({
                                    ...values,
                                    [f.key]: e.target.value,
                                  })
                                }
                              >
                                {f.options?.map(o => (
                                  <option key={o}>{o}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={f.type ?? "text"}
                                step={f.type === "number" ? "any" : undefined}
                                min={f.type === "number" ? 0 : undefined}
                                required={f.required}
                                value={values[f.key] ?? ""}
                                onChange={e =>
                                  setValues({
                                    ...values,
                                    [f.key]: e.target.value,
                                  })
                                }
                              />
                            )}
                          </>
                        )}
                      </label>
                    ))}
                    <div className="practice-actions">
                      <Action type="submit" disabled={pending}>
                        {pending ? "Saving…" : step.button}
                      </Action>
                      <Action
                        tone="quiet"
                        disabled={pending}
                        onClick={() =>
                          void run("advance", undefined, "failure")
                        }
                      >
                        Test failure & retry
                      </Action>
                      {step.simulation && (
                        <Action
                          tone="quiet"
                          disabled={pending}
                          onClick={() =>
                            void run("advance", undefined, "decline")
                          }
                        >
                          Simulate decline
                        </Action>
                      )}
                    </div>
                  </form>
                </section>
              ) : (
                <section className="practice-guide">
                  <Check aria-hidden="true" />
                  <h2>Chapter complete</h2>
                  <p>
                    Your practice records are updated. Choose another workflow
                    or replay this chapter.
                  </p>
                  <Action onClick={() => setCatalogue(true)}>
                    Choose another chapter
                  </Action>
                </section>
              )}
              <Section title="Mock client & booking">
                <dl className="practice-metrics">
                  <div>
                    <dt>Client</dt>
                    <dd>{state.client.name}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{state.booking.status}</dd>
                  </div>
                  <div>
                    <dt>Estimate</dt>
                    <dd>{money(state.booking.price)}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>{money(state.booking.paid)}</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>
                      {money(
                        Math.max(0, state.booking.price - state.booking.paid)
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Forms</dt>
                    <dd>{state.booking.forms}</dd>
                  </div>
                </dl>
                {state.booking.dates.map((d, i) => (
                  <Row
                    key={i}
                    title={`Sitting ${i + 1} · ${d}`}
                    detail="09:00–17:00 · Practice calendar"
                  />
                ))}
                {state.booking.proposedDate && (
                  <p>
                    Awaiting agreement: {state.booking.proposedDate}
                    {state.booking.proposedPrice !== undefined
                      ? ` · New estimate ${money(state.booking.proposedPrice)}`
                      : ""}
                    . Original date and payments remain unchanged.
                  </p>
                )}
              </Section>
              {!!state.offers.length && (
                <Section title="Mock offer recipients">
                  {state.offers.map(o => (
                    <Row
                      key={o.client}
                      title={o.client}
                      detail={`${o.status} · Expires ${new Date(o.expiresAt).toLocaleString()}`}
                    />
                  ))}
                </Section>
              )}
              <Section title="Practice workspace records">
                {Object.entries(state.workspace).map(([key, value]) => (
                  <Row key={key} title={key} detail={value} />
                ))}
              </Section>
              <Section title="Messages & design references">
                {state.messages.length ? (
                  state.messages.map((m, i) => (
                    <div className="practice-message" key={i}>
                      <strong>{m.from}</strong>
                      <p>{m.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="v3-muted">
                    Messages from this chapter will appear here.
                  </p>
                )}
                {state.client.reference && (
                  <div className="practice-reference">
                    <span aria-hidden="true">✦</span>
                    <p>
                      Mock botanical forearm reference · Shared from Messages
                    </p>
                  </div>
                )}
                {state.client.brief && <p>{state.client.brief}</p>}
              </Section>
              {!!state.notifications.length && (
                <Section title="Notification previews">
                  {state.notifications.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                </Section>
              )}
              {state.voucher && (
                <Section title="Mock voucher">
                  <p>
                    {state.voucher.owner} · {money(state.voucher.balance)}{" "}
                    unspent
                  </p>
                </Section>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <div className="practice-error" role="alert">
          <p>{error}</p>
          <Action tone="quiet" onClick={reload}>
            Reload saved progress
          </Action>
        </div>
      )}
    </Frame>
  );
}

function PreviewFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="v3-screen v3-screen-artist">
      <header className="v3-header">
        <div className="v3-masthead">
          <div className="v3-heading-lockup">
            <span className="v3-wordmark">tattoi</span>
            <h1 className="v3-inline-title">{title}</h1>
          </div>
        </div>
        <p className="v3-subtitle">{subtitle}</p>
      </header>
      <main className="v3-scroll">
        <div className="v3-content">{children}</div>
      </main>
    </div>
  );
}
