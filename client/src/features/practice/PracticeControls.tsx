import { PracticeActionGuide } from "./PracticeActionGuide";
import { PracticeScreens, PRACTICE_SCREENS } from "./PracticeScreens";
import { Component, type ReactNode } from "react";
class PracticeBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <p role="alert">
        Practice screen could not load. Choose another screen or retry.
      </p>
    ) : (
      this.props.children
    );
  }
}
import Bank from "@/app-v3/pages/Bank";
import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { Router, useLocation, useSearch } from "wouter";
function PracticeRouteObserver({onRoute}:{onRoute:(route:string)=>void}){ const [path]=useLocation(),search=useSearch();useEffect(()=>onRoute(path+(search?"?"+search:"")),[path,search,onRoute]); return null; }
import { memoryLocation } from "wouter/memory-location";
import { trpc } from "@/lib/trpc";
import { PracticeContext } from "./PracticeContext";
import { BookingComposer } from "@/app-v3/pages/BookingComposer";
import { Thread } from "@/app-v3/pages/Thread";
import { PromotionsManager } from "@/app-v3/components/Offers";
import { SessionActions } from "@/app-v3/pages/SessionActions";
import Clients from "@/app-v3/pages/Clients";
import WorkingHours from "@/app-v3/pages/WorkingHours";
import Forms from "@/app-v3/pages/Forms";
import Booking from "@/app-v3/pages/Booking";
import { Action } from "@/app-v3/design/primitives";
import { practiceSessions } from "@shared/practiceControls";
import type { PracticeState } from "@shared/practice";
export type PracticeResolver = (
  path: string,
  input: unknown,
  type: "query" | "mutation"
) => Promise<unknown>;
/** This tRPC client has no HTTP link and cannot fall through to production endpoints. */
export function PracticeControls({
  state,
  resolve,
  onExit,
}: {
  state: PracticeState;
  resolve: PracticeResolver;
  onExit: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState("Booking wizard");
  const [view, setView] = useState("Booking wizard");
  const [notice, setNotice] = useState("");
  const current = useRef(resolve);
  current.current = resolve;
  const cache = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
    []
  );
  const client = useMemo(
    () =>
      trpc.createClient({
        links: [
          () =>
            ({ op }) =>
              observable(observer => {
                let alive = true;
                if (op.type === "subscription") {
                  observer.error(
                    TRPCClientError.from(
                      new Error("Live subscriptions are disabled in practice.")
                    )
                  );
                  return;
                }
                current.current(op.path, op.input, op.type).then(
                  data => {
                    if (alive) {
                      observer.next({ result: { data } });
                      observer.complete();
                      if (op.type === "mutation") {
                        if (!op.path.startsWith("practice."))
                          void cache.invalidateQueries();
                        document.dispatchEvent(
                          new CustomEvent("practice-mutation-success", {
                            detail: op.path,
                          })
                        );
                      }
                    }
                  },
                  error => {
                    if (alive) observer.error(TRPCClientError.from(error));
                  }
                );
                return () => {
                  alive = false;
                };
              }),
        ],
      }),
    [cache]
  );
  const location = useMemo(() => memoryLocation({ path: "/projects/1" }), []);
  useEffect(() => {
    if (!state.sandbox?.lastAction?.startsWith("practice.recordAction"))
      void cache.invalidateQueries();
  }, [state.revision, cache]);
  useEffect(
    () => () => {
      cache.clear();
    },
    [cache]
  );
  const context = useMemo(
    () => ({
      exit: onExit,
      cart: state.sandbox?.cart ?? {},
      saveCart: (quantities: Record<number, number>) => {
        void current
          .current("practice.saveCart", { quantities }, "mutation")
          .catch(error => setNotice(error.message));
      },
      simulate: async (action: string) => {
        setNotice(`${action} · Simulated only. No external request was made.`);
        if (action === "Complete practice payment") {
          await current.current("practice.completeExternal", {}, "mutation");
          await cache.invalidateQueries();
        }
        if (action === "Verify practice payment account")
          void current
            .current("artistSettings.submitStripeOnboarding", {}, "mutation")
            .then(() => cache.invalidateQueries())
            .catch(error =>
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Could not save practice verification."
              )
            );
      },
    }),
    [onExit, cache, state.sandbox?.cart]
  );
  return (
    <section
      className="practice-real-controls"
      aria-label="Artist app controls in practice"
    >
      <p className="v3-muted">
        These are the app’s real controls, connected only to your private mock
        records.
      </p>
      <div
        className="practice-control-tabs"
        role="group"
        aria-label="Choose practice screen"
      >
        {[
          "Booking wizard",
          "Messages",
          "Promotions",
          "Sitting actions",
          "Clients",
          "Services & hours",
          "Forms",
          "Bank & payouts",
          "Project",
        ].map(name => (
          <Action
            key={name}
            tone={view === name ? "primary" : "quiet"}
            onClick={() => {
              setView(name);
              setRoute(name);
            }}
          >
            {name}
          </Action>
        ))}
      </div>
      <label>
        Explore another artist screen
        <select
          aria-label="Explore artist screen"
          value={view === "Explore" ? undefined : ""}
          onChange={e => {
            location.navigate(e.target.value);
            setRoute(e.target.value);
            setView("Explore");
          }}
        >
          <option value="">Choose a screen</option>
          {PRACTICE_SCREENS.map(([label, path]) => (
            <option key={path} value={path}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div
        className="practice-control-tabs"
        aria-label="Practice studio permissions"
      >
        {["owner", "manager", "artist"].map(role => (
          <Action
            key={role}
            tone="quiet"
            onClick={() => {
              void current
                .current("practice.setStudioRole", { role }, "mutation")
                .then(() => cache.invalidateQueries())
                .catch(e => setNotice(e.message));
            }}
          >
            View as studio {role}
          </Action>
        ))}
      </div>
      <div
        className="practice-control-tabs"
        aria-label="Simulated client responses"
      >
        {[
          ["deposit", "Client accepts & pays deposit"],
          ["forms", "Client signs forms"],
          ["balance", "Client pays final balance"],
          ["approve", "Client approves reschedule"],
          ["decline", "Client declines reschedule"],
        ].map(([outcome, label]) => (
          <Action
            key={outcome}
            tone="quiet"
            onClick={() => {
              void current
                .current("practice.clientOutcome", { outcome }, "mutation")
                .then(() => cache.invalidateQueries())
                .catch(e => setNotice(e.message));
            }}
          >
            {label}
          </Action>
        ))}
      </div>
      <PracticeActionGuide
        frame={frame}
        screen={route}
        resolve={resolve}
        completed={state.sandbox?.actionProgress ?? {}}
      />
      <trpc.Provider client={client} queryClient={cache}>
        <QueryClientProvider client={cache}>
          <PracticeContext.Provider value={context}>
            <Router hook={location.hook} searchHook={location.searchHook}>
              {view === "Explore" && <PracticeRouteObserver onRoute={setRoute}/>}
              <div ref={frame} className="practice-screen-frame" key={view}>
                <div className="practice-banner practice-controls-banner">Practice only · Alex Taylor · No real charges or notifications</div><PracticeBoundary key={route}>
                  {view === "Explore" ? (
                    <PracticeScreens />
                  ) : view === "Booking wizard" ? (
                    <BookingComposer
                      conversationId={1}
                      offer={state.sandbox?.issued?.[0]}
                      initialDate={(() => {
                        const date = new Date(Date.now() + 86400000);
                        date.setHours(9, 0, 0, 0);
                        return date;
                      })()}
                      onSuccess={() => {
                        setNotice(
                          "Practice proposal sent. Continue the guide to simulate client acceptance and deposit."
                        );
                        setView("Messages");
                      }}
                    />
                  ) : view === "Messages" ? (
                    <Thread id={1} />
                  ) : view === "Promotions" ? (
                    <PromotionsManager />
                  ) : view === "Sitting actions" ? (
                    <SessionActions
                      session={practiceSessions(state)[0]}
                      onChange={() => setNotice("Practice sitting updated.")}
                    />
                  ) : view === "Clients" ? (
                    <Clients />
                  ) : view === "Services & hours" ? (
                    <WorkingHours />
                  ) : view === "Forms" ? (
                    <Forms />
                  ) : view === "Bank & payouts" ? (
                    <Bank />
                  ) : (
                    <Booking />
                  )}
                </PracticeBoundary>
              </div>
            </Router>
          </PracticeContext.Provider>
        </QueryClientProvider>
      </trpc.Provider>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
