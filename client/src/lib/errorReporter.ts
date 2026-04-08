/**
 * Error Reporter — fire-and-forget error logging to server.
 *
 * Module-level currentUser is a documented exception to the no-shadow-state rule.
 * Error reporting runs outside the React tree (window.onerror) and cannot
 * depend on React context.
 *
 * IMPORTANT: Do NOT import trpc in this file. The entire point is that error
 * reporting works even when tRPC is broken. Uses raw fetch only.
 */

let currentUser: { id: string | number; role: string } | null = null;

export function setErrorUser(user: { id: string | number; role: string } | null) {
    currentUser = user;
}

// ── Client-side dedup: prevent render loops from flooding our own server ──
const recentErrors = new Set<string>();

export async function reportError(
    error: Error,
    extra?: { boundary?: string; componentStack?: string }
) {
    const key = `${error.message}:${extra?.boundary || ""}`;
    if (recentErrors.has(key)) return;
    recentErrors.add(key);
    setTimeout(() => recentErrors.delete(key), 60_000);

    try {
        // Raw fetch — NOT tRPC client. tRPC itself may be the thing that broke.
        await fetch("/api/trpc/errorLog.log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                json: {
                    message: error.message || "Unknown error",
                    stack: error.stack?.substring(0, 10000),
                    componentStack: extra?.componentStack?.substring(0, 10000),
                    boundary: extra?.boundary,
                    url: window.location.href,
                    userId: typeof currentUser?.id === "number" ? currentUser.id : undefined,
                    userRole: currentUser?.role,
                    userAgent: navigator.userAgent.substring(0, 500),
                    appVersion: import.meta.env.VITE_APP_VERSION || "dev",
                },
                meta: { values: {} }, // Required by superjson transformer
            }),
        });
    } catch {
        // Error reporting must NEVER crash the app. Fail silently.
        console.warn("[ErrorReporter] Failed to send error to server");
    }
}

// Global listeners for non-React errors
export function initGlobalErrorListeners() {
    window.addEventListener("error", (event) => {
        reportError(event.error || new Error(event.message), {
            boundary: "window.onerror",
        });
    });

    window.addEventListener("unhandledrejection", (event) => {
        const error =
            event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason));
        reportError(error, { boundary: "unhandledrejection" });
    });
}
