import { trpc } from "@/lib/trpc";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl, API_BASE_URL } from "./const";
import "./index.css";
import "./features/workspace/workspace.css";
import "./app-v3/design/system.css";
import "./app-v3/design/ivory.css";
import "./ui/original-ivory.css";
import { registerServiceWorker } from "./lib/pwa";
import { initializeAnalytics } from "./lib/analytics";
import { initGlobalErrorListeners } from "./lib/errorReporter";
import { APP_VERSION, compareVersions } from "./lib/version";

// Initialize global error listeners before anything else
initGlobalErrorListeners();
initializeAnalytics();

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Clear auth token and user data
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("user");

  // Prevent redirect loops on public/auth pages
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/set-password",
    "/complete-profile",
    "/forgot-password",
    "/auth/reset-password",
    "/auth/magic",
  ];
  // Normalize path by stripping trailing slash unless it's strictly "/"
  const normalizedPath =
    window.location.pathname.endsWith("/") &&
    window.location.pathname.length > 1
      ? window.location.pathname.slice(0, -1)
      : window.location.pathname;

  const isPublic =
    publicPaths.includes(normalizedPath) ||
    normalizedPath.startsWith("/start/") ||
    normalizedPath.startsWith("/deposit/") ||
    normalizedPath.startsWith("/balance/") ||
    normalizedPath.startsWith("/pay/") ||
    normalizedPath.startsWith("/studio/") ||
    normalizedPath.startsWith("/book/");

  if (!isPublic) {
    window.location.href = "/login";
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Flag to prevent version mismatch from firing update banner on every API call
let versionMismatchNotified = false;

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      transformer: superjson,
      async fetch(input, init) {
        // Get JWT token from localStorage OR sessionStorage
        const token =
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("authToken");

        // Add Authorization header if token exists
        const headers = {
          ...(init?.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });

        // Layer 4: X-App-Version interception.
        // Every API response carries the server's current version.
        // If the server is ahead of this client bundle, show the update banner
        // immediately — no need to wait for the 30-second /api/version poll.
        // Only dispatches once per page load to prevent the banner loop.
        const serverVersion = response.headers.get("X-App-Version");
        if (
          serverVersion &&
          !versionMismatchNotified &&
          compareVersions(APP_VERSION, serverVersion) < 0
        ) {
          versionMismatchNotified = true;
          console.log(
            `[VersionCheck] X-App-Version mismatch: client=${APP_VERSION} server=${serverVersion}`
          );
          window.dispatchEvent(new CustomEvent("pwa-update-available"));
          // Also trigger an immediate SW update check so the new sw.js is
          // fetched and installed ASAP — closing the race window between the
          // banner appearing and the waiting SW being ready.
          navigator.serviceWorker?.getRegistration().then(reg => {
            if (reg) reg.update().catch(() => {});
          });
        }

        return response;
      },
    }),
  ],
});

import { GoogleAuthWrapper } from "./lib/google-auth";

createRoot(document.getElementById("root")!).render(
  <GoogleAuthWrapper>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </GoogleAuthWrapper>
);

// NOTE: APP_VERSION is now imported from ./lib/version (baked in at build time by Vite)
console.log("[App] Starting version:", APP_VERSION);

// Register service worker for PWA
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// OneSignal is initialized by App after its providers mount.

// Match native foreground icons to the rendered theme, including theme changes.
if (Capacitor.isNativePlatform()) {
  const apply = () => {
    const dark = document.documentElement.classList.contains("dark");
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(
      err => console.warn("StatusBar style failed:", err)
    );
  };
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(err =>
    console.warn("StatusBar overlay failed:", err)
  );
  apply();
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}
