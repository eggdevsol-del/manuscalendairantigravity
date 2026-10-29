/* Live displays for detail screens, as in the prototype: each detail opens with a stage that shows its
   subject the way it really is (a voucher, a split payment, an order on its way, a jar of stock) before
   the controls. Every value is passed in from data the screen already loads. */
import type { CSSProperties, ReactNode } from "react";
import { LiveStage, StageNumber } from "../design/live";

/** One bar split into labelled parts, sized by value: who gets what from a payment. */
export function SplitBar({
  parts,
}: {
  parts: { label: string; value: number; tone?: "ok" }[];
}) {
  const shown = parts.filter(p => p.value > 0);
  if (!shown.length) return null;
  return (
    <span className="iosm-sbar" aria-hidden="true">
      {shown.map(p => (
        <i key={p.label} className={p.tone} style={{ flex: p.value }}>
          <b>{p.label}</b>
        </i>
      ))}
    </span>
  );
}

/** A ring that fills to a fraction, with a short label inside. */
export function StageRing({
  fraction,
  label,
  size = 92,
}: {
  fraction: number;
  label: ReactNode;
  size?: number;
}) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <span className="iosm-sring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="bg" />
        {f > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="fg"
            strokeDasharray={`${c * f} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <b>{label}</b>
    </span>
  );
}

/** A picture, ring or jar beside a small headline: the layout of most item stages. */
export function StageFigure({
  visual,
  over,
  value,
  under,
}: {
  visual: ReactNode;
  over?: ReactNode;
  value: ReactNode;
  under?: ReactNode;
}) {
  return (
    <div className="iosm-sitem">
      {visual}
      <StageNumber over={over} value={value} under={under} />
    </div>
  );
}

const hue = (seed: string | number) => {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};

/** A supply as a jar that fills with its stock. */
export function Jar({
  fill,
  seed,
  big = false,
}: {
  fill: number;
  seed: string | number;
  big?: boolean;
}) {
  return (
    <span
      className={`iosm-jar${big ? " big" : ""}`}
      style={{ "--h": hue(seed) } as CSSProperties}
      aria-hidden="true"
    >
      <i style={{ height: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
    </span>
  );
}

/** An order moving along its steps. Each step lights up once the order reaches it. */
export function OrderTrack({
  steps,
  reached,
}: {
  steps: string[];
  reached: number;
}) {
  return (
    <ol className="iosm-strack" aria-label={`Order: ${steps[reached] ?? steps[0]}`}>
      {steps.map((s, i) => (
        <li key={s} className={i <= reached ? "on" : ""}>
          <i aria-hidden="true" />
          <small>{s}</small>
        </li>
      ))}
    </ol>
  );
}

/** The voucher a client receives, on the wallpaper. */
export function Voucher({
  label,
  from,
  value,
  title,
  valid,
  foot,
}: {
  label: string;
  from: ReactNode;
  value: ReactNode;
  title: ReactNode;
  valid: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <LiveStage className="iosm-voucher-stage" label={label}>
      <span className="iosm-voucher">
        <small>{from}</small>
        <b>{value}</b>
        <em>{title}</em>
        <span>{valid}</span>
        {foot && (
          <>
            <i aria-hidden="true" />
            <s>{foot}</s>
          </>
        )}
      </span>
    </LiveStage>
  );
}

export type ProposalSitting = {
  key: string | number;
  label: string;
  state: "confirmed" | "completed" | "todo";
};

/** A booking proposal as the client will receive it: who, what, each sitting's date, and how the price
 *  splits between the deposit and the days. Fills in as the details are chosen. */
export function ProposalStage({
  face,
  who,
  title,
  summary,
  sittings,
  depositLabel,
  laterLabel,
  depositCents,
  laterCents,
}: {
  face: ReactNode;
  who: string;
  title: string;
  summary: string;
  sittings: ProposalSitting[];
  depositLabel: string;
  laterLabel: string;
  depositCents: number;
  laterCents: number;
}) {
  return (
    <LiveStage className="iosm-detail-stage iosm-proposal" label={`${title} for ${who}: ${summary}`}>
      <StageFigure visual={face} over={who} value={title} under={summary} />
      {sittings.length > 0 && (
        <ol className="iosm-sprog">
          {sittings.map((s, i) => (
            <li key={s.key} className={s.state}>
              <b>{i + 1}</b>
              <small>{s.label}</small>
            </li>
          ))}
        </ol>
      )}
      <SplitBar
        parts={[
          { label: depositLabel, value: depositCents, tone: "ok" },
          { label: laterLabel, value: laterCents },
        ]}
      />
    </LiveStage>
  );
}
