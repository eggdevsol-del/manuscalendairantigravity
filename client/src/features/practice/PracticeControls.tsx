import { PracticeFlowGuide } from "./PracticeFlowGuide";
import { ArtistRoutes } from "@/shells/ArtistRoutes";
import Navigation from "@/app-v3/design/Navigation";
import { BottomNavProvider } from "@/contexts/BottomNavContext";
import { PRACTICE_TOURS } from "@shared/practiceTours";
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
        This page could not load. Choose another guide or retry.
      </p>
    ) : (
      this.props.children
    );
  }
}
import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { Router, useLocation, useSearch } from "wouter";
function PracticeRouteObserver({
  onRoute,
}: {
  onRoute: (route: string) => void;
}) {
  const [path] = useLocation(),
    search = useSearch();
  useEffect(
    () => onRoute(path + (search ? "?" + search : "")),
    [path, search, onRoute]
  );
  return null;
}
import { memoryLocation } from "wouter/memory-location";
import { trpc } from "@/lib/trpc";
import { PracticeContext } from "./PracticeContext";
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
  onCatalogue = onExit,
  onStartGuide,
  initialRoute,
}: {
  state: PracticeState;
  resolve: PracticeResolver;
  onExit: () => void;
  onCatalogue?: () => void;
  onStartGuide?: (chapterId: string) => void;
  initialRoute?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState("Booking wizard");
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
                        document.dispatchEvent(
                          new CustomEvent("practice-operation-success", {
                            detail: { path: op.path, input: op.input, data },
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
  const location = useMemo(
    () =>
      memoryLocation({
        path:
          initialRoute ||
          PRACTICE_TOURS[state.chapterId || "enquiry"]?.route ||
          "/dashboard",
      }),
    []
  );
  useEffect(() => {
    if (
      !["practice.recordAction", "practice.guideProgress"].some(path =>
        state.sandbox?.lastAction?.startsWith(path)
      )
    )
      void cache.invalidateQueries();
  }, [state.revision, cache]);
  useEffect(
    () => () => {
      cache.clear();
    },
    [cache]
  );
  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const link = (event.target as HTMLElement)?.closest<HTMLAnchorElement>(
        "a[href]"
      );
      if (!link || link.closest("[data-practice-guide]")) return;
      const href = link.getAttribute("href") || "";
      if (
        /^(https?:|sms:|mailto:|tel:|data:|blob:)/i.test(href) ||
        link.hasAttribute("download")
      ) {
        event.preventDefault();
        event.stopPropagation();
        setNotice("Continue in the guide to review the next step.");
      }
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, []);
  const context = useMemo(
    () => ({
      exit: onExit,
      startGuide: onStartGuide,
      cart: state.sandbox?.cart ?? {},
      saveCart: (quantities: Record<number, number>) => {
        void current
          .current("practice.saveCart", { quantities }, "mutation")
          .catch(error => setNotice(error.message));
      },
      simulate: async (action: string) => {
        setNotice("Step completed.");
        if (action === "Complete practice payment") {
          await current.current("practice.completeExternal", {}, "mutation");
          await cache.invalidateQueries();
        }
        if (action === "Verify practice payment account") {
          await current.current(
            "artistSettings.submitStripeOnboarding",
            {},
            "mutation"
          );
          await cache.invalidateQueries();
          document.dispatchEvent(
            new CustomEvent("practice-operation-success", {
              detail: {
                path: "artistSettings.submitStripeOnboarding",
                data: { success: true },
              },
            })
          );
        }
      },
    }),
    [onExit, onStartGuide, cache, state.sandbox?.cart]
  );
  return (
    <trpc.Provider client={client} queryClient={cache}>
      <QueryClientProvider client={cache}>
        <PracticeContext.Provider value={context}>
          <BottomNavProvider>
            <Router hook={location.hook} searchHook={location.searchHook}>
              <PracticeRouteObserver onRoute={setRoute} />
              <div
                className="practice-app artist-workspace"
                data-practice-app
                ref={frame}
              >
                <div className="practice-app-banner" data-practice-guide>
                  <span>Guided walkthrough</span>
                  <button onClick={onExit}>Exit guide</button>
                </div>
                <PracticeBoundary key={route}>
                  <ArtistRoutes />
                </PracticeBoundary>
                <Navigation />
                <PracticeFlowGuide
                  state={state}
                  resolve={resolve}
                  onCatalogue={onCatalogue}
                />
                {notice && (
                  <div role="status" className="practice-notice">
                    {notice}
                  </div>
                )}
              </div>
            </Router>
          </BottomNavProvider>
        </PracticeContext.Provider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
