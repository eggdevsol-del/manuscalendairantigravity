import { useLayoutEffect, useRef, type RefObject } from "react";

/** Preserve a visible message, or follow the bottom, when media/history resizes. */
export function useMessageScroll(
  viewport: RefObject<HTMLDivElement | null>,
  messages: unknown,
  follow: boolean
) {
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const remember = () => {
      const top = el.getBoundingClientRect().top;
      const row = [
        ...el.querySelectorAll<HTMLElement>("[data-message-id]"),
      ].find(row => row.getBoundingClientRect().bottom > top);
      anchor.current = row
        ? {
            id: row.dataset.messageId!,
            offset: row.getBoundingClientRect().top - top,
          }
        : null;
    };
    const restore = () => {
      if (follow) {
        if (Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) > 0.5)
          el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
      } else if (anchor.current) {
        const row = [
          ...el.querySelectorAll<HTMLElement>("[data-message-id]"),
        ].find(row => row.dataset.messageId === anchor.current!.id);
        if (row) {
          const delta =
            row.getBoundingClientRect().top -
            el.getBoundingClientRect().top -
            anchor.current.offset;
          // Even assigning the same scrollTop can cancel native momentum.
          if (Math.abs(delta) > 0.5) el.scrollTop += delta;
        }
      }
      remember();
    };
    restore();
    el.addEventListener("scroll", remember, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(restore);
    observer?.observe(el);
    const stream = el.querySelector(".v3-message-stream");
    if (stream) observer?.observe(stream);
    el.addEventListener("load", restore, true);
    return () => {
      observer?.disconnect();
      el.removeEventListener("load", restore, true);
      el.removeEventListener("scroll", remember);
    };
  }, [viewport, messages, follow]);
}
