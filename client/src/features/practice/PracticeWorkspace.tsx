import { PracticeControls, type PracticeResolver } from "./PracticeControls";
import {
  queryPracticeControl,
  mutatePracticeControl,
} from "@shared/practiceControls";
import { useRef } from "react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Action, Screen, Section } from "@/app-v3/design/primitives";
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
  const params = new URLSearchParams(useSearch());
  const requested = params.get("chapter");
  const returnPath = params.get("return");
  const exitPath =
    returnPath?.startsWith("/") &&
    !returnPath.startsWith("//") &&
    !returnPath.startsWith("/practice")
      ? returnPath
      : "/dashboard";
  const [state, setState] = useState<PracticeState>();
  const [error, setError] = useState("");
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
      });
      queue.current = work.catch(() => {});
      await work;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not start the guide. Please retry."
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
  if (state?.chapterId)
    return (
      <>
        {error && (
          <div className="practice-notice" role="alert">
            {error}
            <button onClick={reload}>Reload guide</button>
          </div>
        )}
        <PracticeControls
          key={state.chapterId + ":" + (state.sandbox?.guideRun ?? "")}
          onStartGuide={chapterId => void start(chapterId)}
          state={state}
          resolve={resolve}
          onExit={() => go(exitPath)}
        />
      </>
    );
  return (
    <Screen
      title="Guided tutorials"
      subtitle="Explore each flow, one step at a time."
      back="/settings?section=how-tos"
    >
      {error && <p role="alert">{error}</p>}
      <Section title="Loading guide">
        <p>
          {sessionError
            ? "This guide is unavailable. Please try again."
            : "Loading your walkthrough…"}
        </p>
        {sessionError && <Action onClick={reload}>Retry</Action>}
      </Section>
    </Screen>
  );
}
