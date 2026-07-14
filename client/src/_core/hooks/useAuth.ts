import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { setErrorUser } from "@/lib/errorReporter";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  // Silent token refresh — extends session on each app load
  const refreshTokenMutation = trpc.auth.refreshToken.useMutation();
  const hasRefreshed = useRef(false);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      // Also clear session storage just in case
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      // Detach hardware session from the backend OneSignal identity
      try {
        const { removeExternalUserId } = await import("@/lib/onesignal");
        await removeExternalUserId();
      } catch (err) {
        console.error("[Auth] Failed to detach OneSignal ID on logout:", err);
      }
    }
  }, [logoutMutation, utils]);

  /* useEffect to sync user info to local storage - prevent side effects in useMemo */
  useEffect(() => {
    if (meQuery.data) {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data)
      );
      setErrorUser({ id: meQuery.data.id, role: meQuery.data.role });
    } else {
      setErrorUser(null);
    }
  }, [meQuery.data]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      // true once the me query has completed at least once (success or error)
      // Use this instead of !loading to guard redirects — prevents the
      // single-frame gap where loading=false but data hasn't populated yet.
      isSessionChecked: meQuery.isFetched,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    meQuery.isFetched,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  // Silent token refresh — re-mint JWT once per mount when session is valid
  useEffect(() => {
    if (!meQuery.data || hasRefreshed.current) return;
    hasRefreshed.current = true;

    refreshTokenMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.token) {
          if (localStorage.getItem('authToken')) {
            localStorage.setItem('authToken', result.token);
          } else if (sessionStorage.getItem('authToken')) {
            sessionStorage.setItem('authToken', result.token);
          }
        }
      },
      onError: () => {},  // Silent failure — old token still works until expiry
    });
  }, [meQuery.data]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
