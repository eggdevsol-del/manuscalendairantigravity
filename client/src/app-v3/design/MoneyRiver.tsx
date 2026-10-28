import { useId } from "react";

type Week = { w: number; earned: number; booked: number };

/** The money river: what was earned each week up to today (solid), then what is still to come from
 *  sittings already booked (hatched). `scrub` marks one week, for a slider that moves through time. */
export function MoneyRiver({
  weeks,
  width = 340,
  height = 110,
  scrub,
}: {
  weeks: Week[];
  width?: number;
  height?: number;
  scrub?: number;
}) {
  const id = useId().replace(/:/g, "");
  const pad = 20;
  const top = 14;
  const max = Math.max(1, ...weeks.map(w => Math.max(w.earned, w.booked)));
  const X = (i: number) => 8 + (i / Math.max(1, weeks.length - 1)) * (width - 16);
  const Y = (v: number) => height - pad - (v / max) * (height - pad - top);
  const i0 = Math.max(0, weeks.findIndex(w => w.w === 0));
  const past = weeks.slice(0, i0 + 1).map((w, i) => [X(i), Y(w.earned)]);
  const future = weeks.slice(i0).map((w, i) => [X(i + i0), Y(w.w === 0 ? w.earned + w.booked : w.booked)]);
  const line = (p: number[][]) =>
    p.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
  const area = (p: number[][]) =>
    p.length
      ? `M${p[0][0].toFixed(1)} ${height - pad} ${p.map(q => `L${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ")} L${p[p.length - 1][0].toFixed(1)} ${height - pad} Z`
      : "";
  const si = scrub === undefined ? -1 : weeks.findIndex(w => w.w === scrub);
  const sv = si >= 0 ? (weeks[si].w <= 0 ? weeks[si].earned : weeks[si].booked) : 0;
  return (
    <svg
      className="iosm-river"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Earnings for the last ${i0 + 1} weeks and money booked for the next ${weeks.length - i0 - 1} weeks`}
    >
      <defs>
        <pattern id={`${id}h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="6" fill="rgb(255 255 255 / 45%)" />
        </pattern>
        <linearGradient id={`${id}g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity=".05" />
        </linearGradient>
      </defs>
      <path d={area(past)} fill={`url(#${id}g)`} />
      <path d={line(past)} className="earned" />
      <path d={area(future)} fill={`url(#${id}h)`} />
      <path d={line(future)} className="booked" />
      <line x1={X(i0)} x2={X(i0)} y1={6} y2={height - pad} className="today" />
      <text x={X(i0)} y={height - 5} textAnchor="middle">Today</text>
      <text x={8} y={height - 5}>{i0} weeks ago</text>
      <text x={width - 8} y={height - 5} textAnchor="end">{weeks.length - i0 - 1} weeks ahead</text>
      {si >= 0 && (
        <>
          <line x1={X(si)} x2={X(si)} y1={6} y2={height - pad} className="scrub" />
          <circle cx={X(si)} cy={Y(sv)} r={6} className="dot" />
        </>
      )}
    </svg>
  );
}
