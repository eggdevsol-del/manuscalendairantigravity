import { PracticeControls, type PracticeResolver } from "./PracticeControls";
import {
  queryPracticeControl,
  mutatePracticeControl,
} from "@shared/practiceControls";
import { useRef } from "react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Action, Screen, Section, Row } from "@/app-v3/design/primitives";
import { PRACTICE_CHAPTERS, type PracticeState } from "@shared/practice";
import "./practice.css";
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
  const requested = new URLSearchParams(useSearch()).get("chapter");
  const [state, setState] = useState<PracticeState>();
  const [error, setError] = useState("");
  const [catalogue, setCatalogue] = useState(false);
  const [filter, setFilter] = useState("");
  const current = useRef(state);
  current.current = state;
  const queue = useRef(Promise.resolve());
  const entered = useRef(false);
  useEffect(() => {
    if (
      sessionState &&
      (!current.current || sessionState.revision >= current.current.revision)
    ) {
      current.current = sessionState;
      setState(sessionState);
    }
  }, [sessionState]);
  const resolve: PracticeResolver = async (path, input, type) => {
    if (type === "query")
      return controlQuery
        ? controlQuery(path, input)
        : queryPracticeControl(current.current!, path, input);
    let data: unknown;
    const work = queue.current.then(async () => {
      const result = controlMutation
        ? await controlMutation(current.current!.revision, path, input)
        : mutatePracticeControl(current.current!, path, input);
      current.current = result.state;
      setState(result.state);
      data = result.data;
    });
    queue.current = work.catch(() => {});
    await work;
    return data;
  };
  async function start(chapterId: string) {
    setError("");
    try {
      const work = queue.current.then(async () => {
        const next = await save({
          revision: current.current!.revision,
          action: "start",
          chapterId,
          values: {},
          outcome: "success",
        });
        current.current = next;
        setState(next);
        setCatalogue(false);
      });
      queue.current = work.catch(() => {});
      await work;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not start practice. Please retry."
      );
    }
  }
  useEffect(() => {
    if (!state || entered.current) return;
    entered.current = true;
    if (requested && PRACTICE_CHAPTERS.some(c => c.id === requested))
      void start(requested);
    else if (!state.chapterId) void start("enquiry");
  }, [state, requested]);
  if (state?.chapterId && !catalogue)
    return (
      <>
        {error && (
          <div className="practice-notice" role="alert">
            {error}
            <button onClick={reload}>Reload practice</button>
          </div>
        )}
        <PracticeControls
          key={state.chapterId + ":" + (state.sandbox?.guideRun ?? "")}
          onStartGuide={chapterId => void start(chapterId)}
          state={state}
          resolve={resolve}
          onExit={() => go("/settings?section=how-tos")}
          onCatalogue={() => setCatalogue(true)}
        />
      </>
    );
  return (
    <Screen
      title="Practice guides"
      subtitle="Use the actual artist app with fictional clients, bookings and payments."
      back="/settings?section=how-tos"
    >
      <p className="practice-banner">
        Practice mode · No real payments or messages
      </p>
      {preview && <p>Progress is stored in this browser only.</p>}
      {error && <p role="alert">{error}</p>}
      {!state ? (
        <Section title="Loading practice">
          <p>
            {sessionError
              ? "Practice storage is unavailable. Retry to load your mock records."
              : "Loading your practice workspace…"}
          </p>
          <Action onClick={reload}>Retry</Action>
        </Section>
      ) : (
        <>
          {state.chapterId && (
            <Action tone="quiet" onClick={() => setCatalogue(false)}>
              Resume current guide
            </Action>
          )}
          <label className="v3-form">
            Find a workflow
            <input
              aria-label="Find a workflow"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </label>
          {PRACTICE_CHAPTERS.filter(c =>
            `${c.title} ${c.detail}`
              .toLowerCase()
              .includes(filter.toLowerCase())
          ).map(c => (
            <Row
              key={c.id}
              title={c.title}
              detail={c.detail}
              onClick={() => void start(c.id)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
