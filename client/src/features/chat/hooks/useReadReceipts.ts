import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { hasReadMessage } from "../readReceipt";

export function useReadReceipts(
  conversationId: number,
  userId: string | undefined,
  messages:
    | Array<{ id: number; senderId: string; readBy?: string | null }>
    | undefined
) {
  const utils = trpc.useUtils();
  const mark = trpc.conversations.markAsRead.useMutation();
  useEffect(() => {
    if (!userId || !messages?.length) return;
    const unread = new Set(
      messages
        .filter(
          m =>
            m.id > 0 &&
            m.senderId !== userId &&
            !hasReadMessage(m.readBy, userId)
        )
        .map(m => m.id)
    );
    if (!unread.size) return;
    const visible = new Set<number>();
    let pending = false;
    const flush = () => {
      if (document.visibilityState !== "visible" || pending || !visible.size)
        return;
      const messageIds = [...visible]
        .filter(id => unread.has(id))
        .slice(0, 100);
      if (!messageIds.length) return;
      pending = true;
      mark.mutate(
        { conversationId, messageIds },
        {
          onSuccess: () => {
            messageIds.forEach(id => unread.delete(id));
            void utils.messages.list.invalidate({ conversationId });
            void utils.conversations.list.invalidate();
            void utils.consultations.list.invalidate();
          },
          onSettled: () => {
            pending = false;
          },
        }
      );
    };
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const id = Number((entry.target as HTMLElement).dataset.messageId);
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        flush();
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-message-id]").forEach(el => {
      if (unread.has(Number((el as HTMLElement).dataset.messageId)))
        observer.observe(el);
    });
    document.addEventListener("visibilitychange", flush);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", flush);
    };
  }, [conversationId, userId, messages, mark.mutate, utils]);
}
