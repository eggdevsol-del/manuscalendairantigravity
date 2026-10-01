import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { invalidateWorkspace } from "@/lib/workspaceSync";

/** A single account-scoped freshness check catches remote payments and missed updates. */
export function WorkspaceSync() {
  const { user, isSessionChecked } = useAuth();
  const client = useQueryClient();
  const previous = useRef<string | null>(null);
  const account = useRef<string | null>(null);
  const revision = trpc.system.workspaceRevision.useQuery(undefined, {
    enabled: !!user && ["artist", "client"].includes(user.role),
    refetchInterval: 3000, refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always", refetchOnReconnect: "always", retry: false,
  });
  const subscribe = trpc.push.subscribe.useMutation();
  useEffect(() => {
    if (!isSessionChecked) return;
    if (account.current !== (user?.id || null)) {
      previous.current = null;
      void client.resetQueries({ predicate: q => Array.isArray(q.queryKey[0]) && !["auth", "system", "push"].includes(String(q.queryKey[0][0])) });
      account.current = user?.id || null;
    }
    let cancelled = false;
    async function bind() {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      if (cancelled) return;
      registration.active?.postMessage({ type: "NOTIFICATION_OWNER", userId: user?.id || "" });
      if (!user || user.role === "master_dev" || !("PushManager" in window)) return;
      const sub = await registration.pushManager.getSubscription();
      if (!sub || cancelled) return;
      const data = sub.toJSON();
      if (data.keys?.p256dh && data.keys.auth)
        await subscribe.mutateAsync({ endpoint: sub.endpoint, keys: { p256dh: data.keys.p256dh, auth: data.keys.auth } });
    }
    const retryBinding = () => { void bind().catch(() => {}); };
    retryBinding();
    window.addEventListener("online", retryBinding);
    window.addEventListener("focus", retryBinding);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retryBinding);
      window.removeEventListener("focus", retryBinding);
    };
  }, [user?.id, isSessionChecked, client]);
  useEffect(() => {
    if (!revision.data) return;
    const next = `${user?.id}:${revision.data.revision}`;
    if (previous.current && previous.current !== next) void invalidateWorkspace(client);
    previous.current = next;
  }, [revision.data, user?.id, client]);
  return null;
}
