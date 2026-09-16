import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
type Message = { id: number; createdAt: string | Date | null };
export function mergeMessageHistory<T extends Message>(
  older: T[],
  latest: T[]
) {
  const unique = new Map(older.map(row => [row.id, row]));
  latest.forEach(row => unique.set(row.id, row));
  return [...unique.values()].sort(
    (a, b) =>
      +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0) || a.id - b.id
  );
}
const precedes = (a: Message, b: Message) =>
  +new Date(a.createdAt || 0) < +new Date(b.createdAt || 0) ||
  (+new Date(a.createdAt || 0) === +new Date(b.createdAt || 0) && a.id < b.id);
export function useMessageHistory<T extends Message>(
  conversationId: number,
  latest?: T[]
) {
  const utils = trpc.useUtils();
  const [history, setHistory] = useState<{
    id: number;
    rows: T[];
    exhausted: boolean;
  }>({ id: conversationId, rows: [], exhausted: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(conversationId);
  active.current = conversationId;
  const previous = useRef<{ id: number; rows: T[] }>({
    id: conversationId,
    rows: [],
  });
  const inFlight = useRef(false);
  useEffect(() => {
    const head = latest?.find(row => row.id > 0);
    // Retain rows pushed off the newest page by new arrivals, without retaining
    // failed pending rows or deleted messages inside the refreshed page range.
    if (head && previous.current.id === conversationId) {
      const displaced = previous.current.rows.filter(
        row => row.id > 0 && precedes(row, head)
      );
      if (displaced.length)
        setHistory(old => ({
          id: conversationId,
          exhausted: old.id === conversationId && old.exhausted,
          rows: mergeMessageHistory(
            old.id === conversationId ? old.rows : [],
            displaced
          ),
        }));
    }
    previous.current = { id: conversationId, rows: latest || [] };
  }, [latest, conversationId]);
  const messages = useMemo(
    () =>
      mergeMessageHistory(
        history.id === conversationId ? history.rows : [],
        latest || []
      ),
    [history, latest, conversationId]
  );
  const hasOlderMessages =
    !!messages.length &&
    !(history.id === conversationId && history.exhausted) &&
    messages.length >= 100;
  async function loadOlderMessages() {
    if (inFlight.current || !hasOlderMessages) return;
    const oldest = messages.find(row => row.id > 0);
    if (!oldest) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const rows = await utils.messages.list.fetch({
        conversationId,
        limit: 100,
        before: {
          id: oldest.id,
          createdAt:
            oldest.createdAt instanceof Date
              ? oldest.createdAt.toISOString()
              : oldest.createdAt,
        },
      });
      if (active.current !== conversationId) return;
      setHistory(old => ({
        id: conversationId,
        exhausted: rows.length < 100,
        rows: mergeMessageHistory(
          old.id === conversationId ? old.rows : [],
          rows as unknown as T[]
        ),
      }));
    } catch (e) {
      if (active.current === conversationId)
        setError("Couldn’t load older messages. Try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return {
    messages,
    hasOlderMessages,
    loadOlderMessages,
    loadingOlderMessages: pending,
    olderMessagesError: error,
  };
}
