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
import { registerServiceWorker } from "./lib/pwa";
import { initializeOneSignal } from "./lib/onesignal";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Clear auth token and redirect to login
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("user");
  window.location.href = "/login";
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

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        // Get JWT token from localStorage OR sessionStorage
        const token =
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("authToken");

        // Add Authorization header if token exists
        const headers = {
          ...(init?.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });
      },
    }),
  ],
});

import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </GoogleOAuthProvider>
);

// Current app version (baked in at build time)
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.0.0";
console.log("[App] Starting version:", APP_VERSION);

// Register service worker for PWA
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// Initialize OneSignal for push notifications
initializeOneSignal().catch(err => {
  console.error("[OneSignal] Failed to initialize:", err);
});

// Configure Status Bar for Native/PWA
if (Capacitor.isNativePlatform()) {
  try {
    // Make status bar transparent and overlay the webview content underneath
    StatusBar.setOverlaysWebView({ overlay: true });
    // Set style to Dark so the white time/battery text contrasts well with the dark theme
    StatusBar.setStyle({ style: Style.Dark });
  } catch (err) {
    // Silently fail on environments that don't fully support this
    console.warn("StatusBar setup failed:", err);
  }
}
