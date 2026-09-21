import { money } from "@/features/workspace/bookingPresentation";
export function EarningsChart({
  daily,
  timeZone,
}: {
  daily: { date: string; netCents: number }[];
  timeZone: string;
}) {
  if (!daily.length) return null;
  const high = Math.max(0, ...daily.map(d => d.netCents)),
    low = Math.min(0, ...daily.map(d => d.netCents)),
    range = high - low || 1;
  const y = (value: number) => 6 + ((high - value) / range) * 68;
  const baseline = y(0),
    width = 300 / daily.length;
  return (
    <figure
      className="v3-earnings-chart"
      data-tour-title="Daily net earnings"
      data-tour-description="Compare daily net earnings over the same period as the total above. Bars include artist fees and refunds; negative days extend below zero. This helps you see quieter periods and the impact of refunds without confusing bank payouts with new income."
    >
      <svg
        viewBox="0 0 300 80"
        role="img"
        aria-label="Daily net earnings, including refunds"
      >
        <title>
          {daily.map(d => `${d.date}: ${money(d.netCents)}`).join("; ")}
        </title>
        <line
          x1="0"
          x2="300"
          y1={baseline}
          y2={baseline}
          stroke="var(--v3-line)"
        />
        {daily.map((d, i) => (
          <rect
            key={d.date}
            x={i * width + 1}
            y={Math.min(y(d.netCents), baseline)}
            width={Math.max(1, width - 3)}
            height={Math.abs(y(d.netCents) - baseline)}
            rx="2"
            fill={d.netCents < 0 ? "var(--v3-red)" : "var(--v3-green)"}
          >
            <title>
              {d.date}: {money(d.netCents)}
            </title>
          </rect>
        ))}
      </svg>
      <figcaption>
        <span>{daily[0].date.slice(5)}</span>
        <span>Daily net · {timeZone}</span>
        <span>{daily.at(-1)!.date.slice(5)}</span>
      </figcaption>
      {daily.every(d => d.netCents === 0) && (
        <p className="v3-muted">No net earnings in this period.</p>
      )}
    </figure>
  );
}
