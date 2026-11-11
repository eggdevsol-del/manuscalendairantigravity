import { UIDebugProvider } from "../client/src/_core/contexts/UIDebugContext";
import { ThemeProvider } from "../client/src/contexts/ThemeContext";
import {
  queryPracticeControl,
  mutatePracticeControl,
} from "../shared/practiceControls";
import React, { useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { observable } from "@trpc/server/observable";
import { trpc } from "../client/src/lib/trpc";
import { createRoot } from "react-dom/client";
import { PracticeView } from "../client/src/features/practice/PracticeWorkspace";
import {
  seedPractice,
  startPractice,
  advancePractice,
  previousPractice,
  type PracticeState,
} from "../shared/practice";
import "../client/src/app-v3/design/system.css";
import "../client/src/app-v3/design/ivory.css";
import "../client/src/app-v3/design/simple-ivory.css";
import "../client/src/app-v3/design/ios-modern.css";
import { applyWallpaper } from "../client/src/app-v3/design/wallpaper";
applyWallpaper();
// The preview is offline: any server call a shared component makes (such as "who is signed in")
// resolves to nothing, so screens render in their signed-out form.
const offlineLink = () => () =>
  observable<any>(observer => {
    observer.next({ result: { data: null } });
    observer.complete();
  });
const queryClient = new QueryClient();
const trpcClient = trpc.createClient({ links: [offlineLink as any] });
function Preview() {
  const storageKey = "tattoi:artist-practice-preview:v1";
  const [initial] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (stored?.version === 1 && stored.workspace)
        return stored as PracticeState;
    } catch {}
    return seedPractice();
  });
  const state = useRef(initial);
  const [pending, setPending] = useState(false);
  const [dark, setDark] = useState(false);
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          padding: "12px 24px",
          fontSize: 13,
        }}
      >
        <span>
          Offline tutorial preview · Real account data is inaccessible
        </span>
        <button
          onClick={() => {
            document.documentElement.classList.toggle("dark", !dark);
            setDark(!dark);
          }}
        >
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </div>
      <UIDebugProvider>
        <ThemeProvider forceTheme={dark ? "dark" : "light"}>
          <PracticeView
            preview
            sessionState={initial}
            pending={pending}
            reload={() => location.reload()}
            controlQuery={async (path, input) =>
              queryPracticeControl(state.current, path, input)
            }
            controlMutation={async (revision, path, input) => {
              if (revision !== state.current.revision)
                throw new Error("Preview changed. Reload to continue.");
              const result = mutatePracticeControl(state.current, path, input);
              state.current = result.state;
              localStorage.setItem(storageKey, JSON.stringify(result.state));
              return result;
            }}
            save={async input => {
              if (input.revision !== state.current.revision)
                throw new Error("Preview changed. Reload to continue.");
              setPending(true);
              try {
                const next =
                  input.action === "back"
                    ? previousPractice(state.current)
                    : input.action === "reset"
                      ? {
                          ...seedPractice(),
                          revision: state.current.revision + 1,
                        }
                      : input.action === "start"
                        ? startPractice(state.current, input.chapterId ?? "")
                        : advancePractice(
                            state.current,
                            input.stepId ?? "",
                            input.values,
                            input.outcome
                          );
                state.current = next;
                localStorage.setItem(storageKey, JSON.stringify(next));
                return next;
              } finally {
                setPending(false);
              }
            }}
          />
        </ThemeProvider>
      </UIDebugProvider>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <Preview />
    </QueryClientProvider>
  </trpc.Provider>
);
