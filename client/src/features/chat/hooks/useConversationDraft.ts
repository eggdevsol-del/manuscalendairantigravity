import { useCallback, useState, type SetStateAction } from "react";
function read(key: string) {
  try {
    return key ? sessionStorage.getItem(key) || "" : "";
  } catch {
    return "";
  }
}
/** Drafts are scoped to account and conversation and stay in this browser session. */
export function useConversationDraft(conversationId?: number, userId?: string) {
  const key =
    conversationId && userId ? `tattoi:draft:${userId}:${conversationId}` : "";
  const [draft, setDraft] = useState(() => ({ key, text: read(key) }));
  const text = draft.key === key ? draft.text : read(key);
  const setText = useCallback(
    (value: SetStateAction<string>) => {
      const next = typeof value === "function" ? value(text) : value;
      try {
        if (key) {
          if (next) sessionStorage.setItem(key, next);
          else sessionStorage.removeItem(key);
        }
      } catch {}
      setDraft({ key, text: next });
    },
    [key, text]
  );
  return [text, setText] as const;
}
