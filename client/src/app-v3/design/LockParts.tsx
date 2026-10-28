/* The building blocks of the iOS Modern landing pages (artist, client and supplier): ring widgets,
   notification rows and expandable notification groups, plus small time and money helpers. */
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import { relativeStart } from "./lockHome";

export function Widget({
  href,
  value,
  label,
  caption,
}: {
  href: string;
  value: number;
  label: string;
  caption: string;
}) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, value));
  return (
    <Link href={href} className="iosm-widget">
      <span className="iosm-ring">
        <svg viewBox="0 0 58 58" aria-hidden="true">
          <circle cx="29" cy="29" r={r} className="bg" />
          {f > 0.01 && (
            <circle
              cx="29"
              cy="29"
              r={r}
              className="fg"
              strokeDasharray={`${c * f} ${c}`}
              transform="rotate(-90 29 29)"
            />
          )}
        </svg>
        <b>{label}</b>
      </span>
      <small>{caption}</small>
    </Link>
  );
}

export function Note({
  icon,
  title,
  detail,
  when,
  href,
  onClick,
  live,
}: {
  icon: ReactNode;
  title: string;
  detail?: string | null;
  when?: string;
  href?: string;
  onClick?: () => void;
  live?: boolean;
}) {
  const inner = (
    <>
      <span className="iosm-note-icon">{icon}</span>
      <span className="iosm-note-copy">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      {when && <small>{when}</small>}
    </>
  );
  const cls = `iosm-note${live ? " live" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

/** A notification group. Collapsed, it shows its first `peek` items and the page scrolls as normal.
 *  Open, it grows to about twice that height and scrolls on its own without bouncing; once it can't
 *  scroll further, the rest of the swipe moves the page. */
export function Group({
  id,
  icon,
  title,
  href,
  open,
  onToggle,
  peek = 2,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  href: string;
  open: boolean;
  onToggle: (id: string) => void;
  peek?: number;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ collapsed: 0, expanded: 0, more: false });

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      if (!kids.length) return;
      const last = kids[Math.min(peek, kids.length) - 1];
      const collapsed = last.offsetTop + last.offsetHeight - el.offsetTop;
      const full = Array.from(el.children).reduce(
        (h, k) =>
          Math.max(
            h,
            (k as HTMLElement).offsetTop +
              (k as HTMLElement).offsetHeight -
              el.offsetTop
          ),
        0
      );
      setSize({
        collapsed,
        expanded: Math.min(full, Math.max(collapsed * 2, 360)),
        more: full > collapsed + 4,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [peek, children]);

  useEffect(() => {
    const el = body.current;
    if (!el || !open) {
      if (el) el.scrollTop = 0;
      return;
    }
    const page = () =>
      (document.scrollingElement || document.documentElement) as HTMLElement;
    const atEdge = (dy: number) =>
      (dy > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) ||
      (dy < 0 && el.scrollTop <= 0);
    const onWheel = (e: WheelEvent) => {
      if (!atEdge(e.deltaY)) return;
      e.preventDefault();
      page().scrollTop += e.deltaY;
    };
    let y: number | null = null;
    const onStart = (e: TouchEvent) => (y = e.touches[0].clientY);
    const onMove = (e: TouchEvent) => {
      if (y === null) return;
      const ny = e.touches[0].clientY;
      const dy = y - ny;
      y = ny;
      if (!atEdge(dy)) return;
      e.preventDefault();
      page().scrollTop += dy;
    };
    const onEnd = () => (y = null);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  const count = body.current
    ? Math.max(0, body.current.children.length - peek)
    : 0;
  return (
    <section className={`iosm-group${open ? " open" : ""}`} aria-label={title}>
      <Link href={href} className="iosm-group-head">
        <i aria-hidden="true">{icon}</i>
        <strong>{title}</strong>
        <span>
          Open <ChevronRight size={12} />
        </span>
      </Link>
      <div
        ref={body}
        id={`group-${id}`}
        className="iosm-group-body"
        style={{
          maxHeight: size.collapsed
            ? open
              ? size.expanded
              : size.collapsed
            : undefined,
        }}
      >
        {children}
      </div>
      {size.more && (
        <button
          type="button"
          className="iosm-group-toggle"
          aria-expanded={open}
          aria-controls={`group-${id}`}
          onClick={() => onToggle(id)}
        >
          {open ? "Show less" : `Show more${count ? ` · ${count}` : ""}`}
          <ChevronDown size={13} />
        </button>
      )}
    </section>
  );
}

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0])
    .join("")
    .toUpperCase();
export const progress = (
  start: string | Date,
  end: string | Date | null | undefined,
  now: number
) => {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : s + 7200000;
  return Math.max(0, Math.min(1, (now - s) / (e - s)));
};
export const trimHours = (h: number) => h.toFixed(1).replace(/\.0$/, "");
export const compactMoney = (cents: number) =>
  cents >= 100000
    ? `$${(cents / 100000).toFixed(cents >= 1000000 ? 0 : 1)}k`
    : `$${Math.round(cents / 100)}`;
export function relativeDay(start: string | Date, now: number) {
  const d = new Date(start);
  if (d.toDateString() === new Date(now).toDateString())
    return relativeStart(start, now);
  const tomorrow = new Date(startOfDay(now) + 86400000).toDateString();
  return d.toDateString() === tomorrow
    ? "tomorrow"
    : d.toLocaleDateString("en-AU", { weekday: "short" });
}
