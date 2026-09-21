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
  const y = (value: number) => 16 + ((high - value) / range) * 58;
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
          <g key={d.date}>
            <rect
              x={i * width}
              y={
                d.netCents === 0
                  ? baseline - 1
                  : Math.min(y(d.netCents), baseline)
              }
              width={width}
              height={d.netCents === 0 ? 1 : Math.abs(y(d.netCents) - baseline)}
              rx="0"
              fill={
                d.netCents === 0
                  ? "var(--v3-muted)"
                  : d.netCents < 0
                    ? "var(--v3-red)"
                    : "var(--v3-green)"
              }
            >
              <title>
                {d.date}: {money(d.netCents)}
              </title>
            </rect>
            {(() => {
              const label = new Intl.NumberFormat("en-AU", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(d.netCents / 100);
              return (
                <text
                  x={(i + 0.5) * width}
                  y={Math.min(y(d.netCents), baseline) - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="var(--v3-ink)"
                  {...(label.length * 3.6 > width - 1
                    ? {
                        textLength: width - 1,
                        lengthAdjust: "spacingAndGlyphs" as const,
                      }
                    : {})}
                >
                  <title>{money(d.netCents)}</title>
                  {label}
                </text>
              );
            })()}
          </g>
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
